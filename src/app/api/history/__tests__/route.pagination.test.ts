import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

function createHistoryDbMock(rows: unknown[]) {
    const limit = vi.fn().mockResolvedValue(rows);
    const orderBy = vi.fn().mockReturnValue({ limit });
    const where = vi.fn().mockReturnValue({ orderBy });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    const delWhere = vi.fn().mockResolvedValue(undefined);
    const del = vi.fn().mockReturnValue({ where: delWhere });

    return {
        db: {
            select,
            delete: del,
        },
        mocks: {
            where,
            limit,
        },
    };
}

function makeChat(id: string, updatedAtIso: string) {
    return {
        id,
        title: `Chat ${id}`,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date(updatedAtIso),
    };
}

describe('GET /api/history pagination', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    it('falls back to user-only filter when cursor is invalid', async () => {
        const requireUser = vi.fn().mockResolvedValue({
            ok: true,
            user: { id: 'user-1', email: 'user@example.com', role: 'user' },
        });
        const rows = [
            makeChat('chat-1', '2026-01-03T00:00:00.000Z'),
            makeChat('chat-2', '2026-01-02T00:00:00.000Z'),
            makeChat('chat-3', '2026-01-01T00:00:00.000Z'),
        ];
        const { db, mocks } = createHistoryDbMock(rows);

        const eq = vi.fn((left: unknown, right: unknown) => ({ op: 'eq', left, right }));
        const and = vi.fn((left: unknown, right: unknown) => ({ op: 'and', left, right }));
        const lt = vi.fn((left: unknown, right: unknown) => ({ op: 'lt', left, right }));
        const desc = vi.fn((value: unknown) => ({ op: 'desc', value }));
        const chats = {
            id: 'id',
            userId: 'userId',
            title: 'title',
            createdAt: 'createdAt',
            updatedAt: 'updatedAt',
        };

        vi.doMock('@/lib/auth/request-auth', () => ({ requireUser }));
        vi.doMock('@/lib/db', () => ({ db }));
        vi.doMock('@/lib/db/schema', () => ({ chats }));
        vi.doMock('drizzle-orm', () => ({ eq, and, lt, desc }));

        const { GET } = await import('@/app/api/history/route');
        const request = new NextRequest('http://localhost/api/history?limit=2&cursor=not-a-date');

        const response = await GET(request);
        expect(response.status).toBe(200);

        const payload = await response.json();
        expect(payload.success).toBe(true);
        expect(payload.data.history).toHaveLength(2);
        expect(payload.data.history[0].id).toBe('chat-1');
        expect(payload.data.nextCursor).toBe('2026-01-02T00:00:00.000Z');

        expect(mocks.limit).toHaveBeenCalledWith(3);
        expect(mocks.where).toHaveBeenCalledTimes(1);
        const whereArg = mocks.where.mock.calls[0]?.[0] as { op: string };
        expect(whereArg.op).toBe('eq');
        expect(lt).not.toHaveBeenCalled();
        expect(and).not.toHaveBeenCalled();
    });

    it('applies lt cursor constraint when cursor is valid', async () => {
        const requireUser = vi.fn().mockResolvedValue({
            ok: true,
            user: { id: 'user-1', email: 'user@example.com', role: 'user' },
        });
        const rows = [
            makeChat('chat-4', '2026-01-01T00:00:00.000Z'),
            makeChat('chat-5', '2025-12-31T00:00:00.000Z'),
        ];
        const { db, mocks } = createHistoryDbMock(rows);

        const eq = vi.fn((left: unknown, right: unknown) => ({ op: 'eq', left, right }));
        const and = vi.fn((left: unknown, right: unknown) => ({ op: 'and', left, right }));
        const lt = vi.fn((left: unknown, right: unknown) => ({ op: 'lt', left, right }));
        const desc = vi.fn((value: unknown) => ({ op: 'desc', value }));
        const chats = {
            id: 'id',
            userId: 'userId',
            title: 'title',
            createdAt: 'createdAt',
            updatedAt: 'updatedAt',
        };

        vi.doMock('@/lib/auth/request-auth', () => ({ requireUser }));
        vi.doMock('@/lib/db', () => ({ db }));
        vi.doMock('@/lib/db/schema', () => ({ chats }));
        vi.doMock('drizzle-orm', () => ({ eq, and, lt, desc }));

        const { GET } = await import('@/app/api/history/route');
        const request = new NextRequest(
            'http://localhost/api/history?limit=1&cursor=2026-01-02T00:00:00.000Z'
        );

        const response = await GET(request);
        expect(response.status).toBe(200);

        const payload = await response.json();
        expect(payload.success).toBe(true);
        expect(payload.data.history).toHaveLength(1);
        expect(payload.data.history[0].id).toBe('chat-4');

        expect(mocks.where).toHaveBeenCalledTimes(1);
        expect(mocks.limit).toHaveBeenCalledWith(2);
        expect(lt).toHaveBeenCalledTimes(1);
        expect(and).toHaveBeenCalledTimes(1);

        const ltCursorArg = lt.mock.calls[0]?.[1];
        expect(ltCursorArg).toBeInstanceOf(Date);
        expect((ltCursorArg as Date).toISOString()).toBe('2026-01-02T00:00:00.000Z');

        const whereArg = mocks.where.mock.calls[0]?.[0] as { op: string };
        expect(whereArg.op).toBe('and');
    });
});
