import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

function createPreviewDbMock(options: {
    documentRows: unknown[];
    chunkRows?: unknown[];
}) {
    const chunkRows = options.chunkRows ?? [];

    const documentLimit = vi.fn().mockResolvedValue(options.documentRows);
    const documentWhere = vi.fn().mockReturnValue({ limit: documentLimit });
    const documentFrom = vi.fn().mockReturnValue({ where: documentWhere });

    const chunkOrderBy = vi.fn().mockResolvedValue(chunkRows);
    const chunkWhere = vi.fn().mockReturnValue({ orderBy: chunkOrderBy });
    const chunkFrom = vi.fn().mockReturnValue({ where: chunkWhere });

    const select = vi.fn()
        .mockReturnValueOnce({ from: documentFrom })
        .mockReturnValueOnce({ from: chunkFrom });

    return {
        db: { select },
        mocks: {
            documentLimit,
            documentWhere,
            chunkOrderBy,
        },
    };
}

describe('GET /api/documents/[id]/preview', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    it('returns DOCUMENT_PREVIEW_EMPTY for failed document with zero chunks', async () => {
        const requireAdmin = vi.fn().mockResolvedValue({
            ok: true,
            user: { id: 'admin-id', email: 'admin@example.com', role: 'admin' },
        });
        const { db } = createPreviewDbMock({
            documentRows: [{
                id: 'doc-1',
                processingStatus: 'failed',
                processingError: 'No indexable text extracted from document (OCR produced no usable text).',
            }],
            chunkRows: [],
        });
        const eq = vi.fn((left: unknown, right: unknown) => ({ op: 'eq', left, right }));
        const asc = vi.fn((value: unknown) => ({ op: 'asc', value }));
        const documents = { id: 'documents.id' };
        const chunks = {
            documentId: 'chunks.document_id',
            chunkIndex: 'chunks.chunk_index',
            content: 'chunks.content',
            pageNumber: 'chunks.page_number',
        };

        vi.doMock('@/lib/auth/request-auth', () => ({ requireAdmin }));
        vi.doMock('@/lib/db', () => ({ db }));
        vi.doMock('@/lib/db/schema', () => ({ documents, chunks }));
        vi.doMock('drizzle-orm', () => ({ eq, asc }));

        const { GET } = await import('@/app/api/documents/[id]/preview/route');
        const request = new NextRequest('http://localhost/api/documents/doc-1/preview');

        const response = await GET(request, { params: Promise.resolve({ id: 'doc-1' }) });
        expect(response.status).toBe(409);
        const payload = await response.json();
        expect(payload.success).toBe(false);
        expect(payload.code).toBe('DOCUMENT_PREVIEW_EMPTY');
        expect(payload.error).toContain('No indexable text extracted');
    });

    it('returns combined chunk content when document chunks exist', async () => {
        const requireAdmin = vi.fn().mockResolvedValue({
            ok: true,
            user: { id: 'admin-id', email: 'admin@example.com', role: 'admin' },
        });
        const { db } = createPreviewDbMock({
            documentRows: [{
                id: 'doc-2',
                processingStatus: 'completed',
                processingError: null,
            }],
            chunkRows: [
                { content: 'Prvni cast', pageNumber: 1 },
                { content: 'Druha cast', pageNumber: 2 },
            ],
        });
        const eq = vi.fn((left: unknown, right: unknown) => ({ op: 'eq', left, right }));
        const asc = vi.fn((value: unknown) => ({ op: 'asc', value }));
        const documents = { id: 'documents.id' };
        const chunks = {
            documentId: 'chunks.document_id',
            chunkIndex: 'chunks.chunk_index',
            content: 'chunks.content',
            pageNumber: 'chunks.page_number',
        };

        vi.doMock('@/lib/auth/request-auth', () => ({ requireAdmin }));
        vi.doMock('@/lib/db', () => ({ db }));
        vi.doMock('@/lib/db/schema', () => ({ documents, chunks }));
        vi.doMock('drizzle-orm', () => ({ eq, asc }));

        const { GET } = await import('@/app/api/documents/[id]/preview/route');
        const request = new NextRequest('http://localhost/api/documents/doc-2/preview');

        const response = await GET(request, { params: Promise.resolve({ id: 'doc-2' }) });
        expect(response.status).toBe(200);
        const payload = await response.json();
        expect(payload.success).toBe(true);
        expect(payload.data.content).toContain('[Page 1]');
        expect(payload.data.content).toContain('Prvni cast');
        expect(payload.data.content).toContain('Druha cast');
    });

    it('returns DOCUMENT_NOT_FOUND when document does not exist', async () => {
        const requireAdmin = vi.fn().mockResolvedValue({
            ok: true,
            user: { id: 'admin-id', email: 'admin@example.com', role: 'admin' },
        });
        const documentLimit = vi.fn().mockResolvedValue([]);
        const documentWhere = vi.fn().mockReturnValue({ limit: documentLimit });
        const documentFrom = vi.fn().mockReturnValue({ where: documentWhere });
        const select = vi.fn().mockReturnValueOnce({ from: documentFrom });

        const db = { select };
        const eq = vi.fn((left: unknown, right: unknown) => ({ op: 'eq', left, right }));
        const asc = vi.fn((value: unknown) => ({ op: 'asc', value }));
        const documents = { id: 'documents.id' };
        const chunks = {
            documentId: 'chunks.document_id',
            chunkIndex: 'chunks.chunk_index',
            content: 'chunks.content',
            pageNumber: 'chunks.page_number',
        };

        vi.doMock('@/lib/auth/request-auth', () => ({ requireAdmin }));
        vi.doMock('@/lib/db', () => ({ db }));
        vi.doMock('@/lib/db/schema', () => ({ documents, chunks }));
        vi.doMock('drizzle-orm', () => ({ eq, asc }));

        const { GET } = await import('@/app/api/documents/[id]/preview/route');
        const request = new NextRequest('http://localhost/api/documents/missing/preview');

        const response = await GET(request, { params: Promise.resolve({ id: 'missing' }) });
        expect(response.status).toBe(404);
        const payload = await response.json();
        expect(payload.success).toBe(false);
        expect(payload.code).toBe('DOCUMENT_NOT_FOUND');
    });
});
