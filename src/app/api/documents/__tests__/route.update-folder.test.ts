import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

function createUpdateDbMock(returningRows: unknown[]) {
    const returning = vi.fn().mockResolvedValue(returningRows);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    const update = vi.fn().mockReturnValue({ set });

    return {
        db: { update },
        mocks: { update, set, where, returning },
    };
}

describe('PATCH /api/documents/[id]', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    it('sets folderName when payload is valid', async () => {
        const requireAdmin = vi.fn().mockResolvedValue({
            ok: true,
            user: { id: 'admin-id', email: 'admin@example.com', role: 'admin' },
        });
        const { db, mocks } = createUpdateDbMock([{ id: 'doc-1', folderName: 'Finance 2026' }]);
        const eq = vi.fn((left: unknown, right: unknown) => ({ op: 'eq', left, right }));
        const documents = {
            id: 'documents.id',
            folderName: 'documents.folder_name',
        };

        vi.doMock('@/lib/auth/request-auth', () => ({ requireAdmin }));
        vi.doMock('@/lib/db', () => ({ db }));
        vi.doMock('@/lib/db/schema', () => ({ documents }));
        vi.doMock('drizzle-orm', () => ({ eq }));

        const { PATCH } = await import('@/app/api/documents/[id]/route');
        const request = new NextRequest('http://localhost/api/documents/doc-1', {
            method: 'PATCH',
            body: JSON.stringify({ folderName: '  Finance 2026  ' }),
            headers: { 'content-type': 'application/json' },
        });

        const response = await PATCH(request, { params: Promise.resolve({ id: 'doc-1' }) });
        expect(response.status).toBe(200);

        const payload = await response.json();
        expect(payload.success).toBe(true);
        expect(payload.data.folderName).toBe('Finance 2026');
        expect(mocks.set).toHaveBeenCalledWith(expect.objectContaining({ folderName: 'Finance 2026' }));
        expect(eq).toHaveBeenCalledTimes(1);
    });

    it('clears folderName when payload uses null', async () => {
        const requireAdmin = vi.fn().mockResolvedValue({
            ok: true,
            user: { id: 'admin-id', email: 'admin@example.com', role: 'admin' },
        });
        const { db, mocks } = createUpdateDbMock([{ id: 'doc-1', folderName: null }]);
        const eq = vi.fn((left: unknown, right: unknown) => ({ op: 'eq', left, right }));
        const documents = {
            id: 'documents.id',
            folderName: 'documents.folder_name',
        };

        vi.doMock('@/lib/auth/request-auth', () => ({ requireAdmin }));
        vi.doMock('@/lib/db', () => ({ db }));
        vi.doMock('@/lib/db/schema', () => ({ documents }));
        vi.doMock('drizzle-orm', () => ({ eq }));

        const { PATCH } = await import('@/app/api/documents/[id]/route');
        const request = new NextRequest('http://localhost/api/documents/doc-1', {
            method: 'PATCH',
            body: JSON.stringify({ folderName: null }),
            headers: { 'content-type': 'application/json' },
        });

        const response = await PATCH(request, { params: Promise.resolve({ id: 'doc-1' }) });
        expect(response.status).toBe(200);

        const payload = await response.json();
        expect(payload.success).toBe(true);
        expect(payload.data.folderName).toBeNull();
        expect(mocks.set).toHaveBeenCalledWith(expect.objectContaining({ folderName: null }));
    });

    it('clears folderName when payload uses empty string', async () => {
        const requireAdmin = vi.fn().mockResolvedValue({
            ok: true,
            user: { id: 'admin-id', email: 'admin@example.com', role: 'admin' },
        });
        const { db, mocks } = createUpdateDbMock([{ id: 'doc-1', folderName: null }]);
        const eq = vi.fn((left: unknown, right: unknown) => ({ op: 'eq', left, right }));
        const documents = {
            id: 'documents.id',
            folderName: 'documents.folder_name',
        };

        vi.doMock('@/lib/auth/request-auth', () => ({ requireAdmin }));
        vi.doMock('@/lib/db', () => ({ db }));
        vi.doMock('@/lib/db/schema', () => ({ documents }));
        vi.doMock('drizzle-orm', () => ({ eq }));

        const { PATCH } = await import('@/app/api/documents/[id]/route');
        const request = new NextRequest('http://localhost/api/documents/doc-1', {
            method: 'PATCH',
            body: JSON.stringify({ folderName: '   ' }),
            headers: { 'content-type': 'application/json' },
        });

        const response = await PATCH(request, { params: Promise.resolve({ id: 'doc-1' }) });
        expect(response.status).toBe(200);
        const payload = await response.json();
        expect(payload.success).toBe(true);
        expect(payload.data.folderName).toBeNull();
        expect(mocks.set).toHaveBeenCalledWith(expect.objectContaining({ folderName: null }));
    });

    it('returns 400 for invalid payload', async () => {
        const requireAdmin = vi.fn().mockResolvedValue({
            ok: true,
            user: { id: 'admin-id', email: 'admin@example.com', role: 'admin' },
        });
        const { db, mocks } = createUpdateDbMock([{ id: 'doc-1', folderName: 'Finance 2026' }]);
        const eq = vi.fn((left: unknown, right: unknown) => ({ op: 'eq', left, right }));
        const documents = {
            id: 'documents.id',
            folderName: 'documents.folder_name',
        };

        vi.doMock('@/lib/auth/request-auth', () => ({ requireAdmin }));
        vi.doMock('@/lib/db', () => ({ db }));
        vi.doMock('@/lib/db/schema', () => ({ documents }));
        vi.doMock('drizzle-orm', () => ({ eq }));

        const { PATCH } = await import('@/app/api/documents/[id]/route');
        const request = new NextRequest('http://localhost/api/documents/doc-1', {
            method: 'PATCH',
            body: JSON.stringify({ wrong: true }),
            headers: { 'content-type': 'application/json' },
        });

        const response = await PATCH(request, { params: Promise.resolve({ id: 'doc-1' }) });
        expect(response.status).toBe(400);

        const payload = await response.json();
        expect(payload.success).toBe(false);
        expect(payload.code).toBe('DOCUMENT_UPDATE_INVALID_PAYLOAD');
        expect(mocks.update).not.toHaveBeenCalled();
    });

    it('returns 400 when folderName exceeds 128 chars', async () => {
        const requireAdmin = vi.fn().mockResolvedValue({
            ok: true,
            user: { id: 'admin-id', email: 'admin@example.com', role: 'admin' },
        });
        const { db, mocks } = createUpdateDbMock([{ id: 'doc-1', folderName: 'Finance 2026' }]);
        const eq = vi.fn((left: unknown, right: unknown) => ({ op: 'eq', left, right }));
        const documents = {
            id: 'documents.id',
            folderName: 'documents.folder_name',
        };

        vi.doMock('@/lib/auth/request-auth', () => ({ requireAdmin }));
        vi.doMock('@/lib/db', () => ({ db }));
        vi.doMock('@/lib/db/schema', () => ({ documents }));
        vi.doMock('drizzle-orm', () => ({ eq }));

        const { PATCH } = await import('@/app/api/documents/[id]/route');
        const request = new NextRequest('http://localhost/api/documents/doc-1', {
            method: 'PATCH',
            body: JSON.stringify({ folderName: 'a'.repeat(129) }),
            headers: { 'content-type': 'application/json' },
        });

        const response = await PATCH(request, { params: Promise.resolve({ id: 'doc-1' }) });
        expect(response.status).toBe(400);
        const payload = await response.json();
        expect(payload.success).toBe(false);
        expect(payload.code).toBe('DOCUMENT_FOLDER_INVALID');
        expect(mocks.update).not.toHaveBeenCalled();
    });

    it('returns 404 when document is not found', async () => {
        const requireAdmin = vi.fn().mockResolvedValue({
            ok: true,
            user: { id: 'admin-id', email: 'admin@example.com', role: 'admin' },
        });
        const { db } = createUpdateDbMock([]);
        const eq = vi.fn((left: unknown, right: unknown) => ({ op: 'eq', left, right }));
        const documents = {
            id: 'documents.id',
            folderName: 'documents.folder_name',
        };

        vi.doMock('@/lib/auth/request-auth', () => ({ requireAdmin }));
        vi.doMock('@/lib/db', () => ({ db }));
        vi.doMock('@/lib/db/schema', () => ({ documents }));
        vi.doMock('drizzle-orm', () => ({ eq }));

        const { PATCH } = await import('@/app/api/documents/[id]/route');
        const request = new NextRequest('http://localhost/api/documents/missing', {
            method: 'PATCH',
            body: JSON.stringify({ folderName: 'Finance 2026' }),
            headers: { 'content-type': 'application/json' },
        });

        const response = await PATCH(request, { params: Promise.resolve({ id: 'missing' }) });
        expect(response.status).toBe(404);
        const payload = await response.json();
        expect(payload.success).toBe(false);
        expect(payload.code).toBe('DOCUMENT_NOT_FOUND');
    });
});
