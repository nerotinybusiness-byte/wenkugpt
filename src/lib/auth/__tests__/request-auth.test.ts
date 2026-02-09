import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

type Role = 'user' | 'admin';

interface DbUserRow {
    id: string;
    email: string;
    role: Role;
}

function createDbMock(options?: { selectedRows?: DbUserRow[]; createdUser?: DbUserRow }) {
    const selectedRows = options?.selectedRows ?? [];
    const createdUser = options?.createdUser ?? {
        id: 'created-user-id',
        email: 'created@example.com',
        role: 'user' as const,
    };

    const selectLimit = vi.fn().mockResolvedValue(selectedRows);
    const selectWhere = vi.fn().mockReturnValue({ limit: selectLimit });
    const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
    const select = vi.fn().mockReturnValue({ from: selectFrom });

    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
    const update = vi.fn().mockReturnValue({ set: updateSet });

    const insertReturning = vi.fn().mockResolvedValue([createdUser]);
    const insertValues = vi.fn().mockReturnValue({ returning: insertReturning });
    const insert = vi.fn().mockReturnValue({ values: insertValues });

    return {
        db: { select, update, insert },
        mocks: {
            selectLimit,
            updateWhere,
            insertReturning,
        },
    };
}

const originalEnv = { ...process.env };

describe('request auth', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('returns AUTH_UNAUTHORIZED when identity header is missing in production', async () => {
        process.env = { ...process.env, NODE_ENV: 'production' };
        delete process.env.DEV_DEFAULT_USER_EMAIL;
        delete process.env.ADMIN_EMAILS;

        const { db, mocks } = createDbMock();
        const eq = vi.fn((left: unknown, right: unknown) => ({ left, right }));

        vi.doMock('@/lib/db', () => ({ db }));
        vi.doMock('@/lib/db/schema', () => ({
            users: { id: 'id', email: 'email', role: 'role', updatedAt: 'updatedAt' },
        }));
        vi.doMock('drizzle-orm', () => ({ eq }));

        const { requireUser } = await import('@/lib/auth/request-auth');
        const request = new NextRequest('http://localhost/api/history');

        const result = await requireUser(request);
        expect(result.ok).toBe(false);
        if (result.ok) {
            throw new Error('Expected auth to fail');
        }

        expect(result.response.status).toBe(401);
        const payload = await result.response.json();
        expect(payload).toMatchObject({
            success: false,
            code: 'AUTH_UNAUTHORIZED',
            error: 'Missing identity header. Set x-user-email.',
        });
        expect(mocks.selectLimit).not.toHaveBeenCalled();
    });

    it('returns AUTH_FORBIDDEN when authenticated user is not admin', async () => {
        process.env = { ...process.env, NODE_ENV: 'production' };
        process.env.ADMIN_EMAILS = 'admin@example.com';

        const { db, mocks } = createDbMock({
            selectedRows: [{ id: 'user-1', email: 'member@example.com', role: 'user' }],
        });
        const eq = vi.fn((left: unknown, right: unknown) => ({ left, right }));

        vi.doMock('@/lib/db', () => ({ db }));
        vi.doMock('@/lib/db/schema', () => ({
            users: { id: 'id', email: 'email', role: 'role', updatedAt: 'updatedAt' },
        }));
        vi.doMock('drizzle-orm', () => ({ eq }));

        const { requireAdmin } = await import('@/lib/auth/request-auth');
        const request = new NextRequest('http://localhost/api/documents', {
            headers: { 'x-user-email': 'member@example.com' },
        });

        const result = await requireAdmin(request);
        expect(result.ok).toBe(false);
        if (result.ok) {
            throw new Error('Expected admin auth to fail');
        }

        expect(result.response.status).toBe(403);
        const payload = await result.response.json();
        expect(payload).toMatchObject({
            success: false,
            code: 'AUTH_FORBIDDEN',
            error: 'Admin role is required for this endpoint.',
        });
        expect(mocks.updateWhere).not.toHaveBeenCalled();
    });

    it('promotes allowlisted user to admin and passes requireAdmin', async () => {
        process.env = { ...process.env, NODE_ENV: 'production' };
        process.env.ADMIN_EMAILS = 'admin@example.com';

        const { db, mocks } = createDbMock({
            selectedRows: [{ id: 'user-2', email: 'admin@example.com', role: 'user' }],
        });
        const eq = vi.fn((left: unknown, right: unknown) => ({ left, right }));

        vi.doMock('@/lib/db', () => ({ db }));
        vi.doMock('@/lib/db/schema', () => ({
            users: { id: 'id', email: 'email', role: 'role', updatedAt: 'updatedAt' },
        }));
        vi.doMock('drizzle-orm', () => ({ eq }));

        const { requireAdmin } = await import('@/lib/auth/request-auth');
        const request = new NextRequest('http://localhost/api/documents', {
            headers: { 'x-user-email': 'admin@example.com' },
        });

        const result = await requireAdmin(request);
        expect(result.ok).toBe(true);
        if (!result.ok) {
            throw new Error('Expected admin auth to pass');
        }

        expect(result.user.email).toBe('admin@example.com');
        expect(result.user.role).toBe('admin');
        expect(mocks.updateWhere).toHaveBeenCalledTimes(1);
    });
});
