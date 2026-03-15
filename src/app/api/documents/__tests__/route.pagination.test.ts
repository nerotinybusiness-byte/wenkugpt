import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

function createDocumentsDbMock(options: { limitRows: unknown[]; whereRows?: unknown[] }) {
    const limitRows = options.limitRows;
    const whereRows = options.whereRows ?? options.limitRows;

    const limit = vi.fn().mockResolvedValue(limitRows);
    const whereLimit = vi.fn().mockResolvedValue(whereRows);
    const where = vi.fn().mockReturnValue({ limit: whereLimit });
    const orderBy = vi.fn().mockReturnValue({ limit, where });
    const from = vi.fn().mockReturnValue({ orderBy });
    const select = vi.fn().mockReturnValue({ from });

    return {
        db: { select },
        mocks: {
            limit,
            where,
            whereLimit,
        },
    };
}

function makeDoc(id: string, createdAtIso: string) {
    return {
        id,
        filename: `${id}.pdf`,
        fileSize: 1024,
        pageCount: 3,
        processingStatus: 'completed',
        processingError: null,
        folderName: 'Kontakty',
        templateProfileId: 'wenku-manual-v1',
        templateMatched: true,
        templateMatchScore: 0.9,
        templateBoilerplateChunks: 1,
        templateDetectionMode: 'text',
        templateWarnings: null,
        ocrRescueApplied: true,
        ocrRescueEngine: 'gemini',
        ocrRescueFallbackEngine: null,
        ocrRescueChunksRecovered: 4,
        ocrRescueWarnings: null,
        createdAt: new Date(createdAtIso),
    };
}

describe('GET /api/documents pagination', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    it('returns truncated page and nextCursor when rows exceed limit', async () => {
        const requireAdmin = vi.fn().mockResolvedValue({
            ok: true,
            user: { id: 'admin-id', email: 'admin@example.com', role: 'admin' },
        });
        const docs = [
            makeDoc('doc-1', '2026-01-03T00:00:00.000Z'),
            makeDoc('doc-2', '2026-01-02T00:00:00.000Z'),
            makeDoc('doc-3', '2026-01-01T00:00:00.000Z'),
        ];
        const { db, mocks } = createDocumentsDbMock({ limitRows: docs });
        const desc = vi.fn((value: unknown) => ({ op: 'desc', value }));
        const lt = vi.fn((left: unknown, right: unknown) => ({ op: 'lt', left, right }));
        const documents = { createdAt: 'createdAt' };

        vi.doMock('@/lib/auth/request-auth', () => ({ requireAdmin }));
        vi.doMock('@/lib/db', () => ({ db }));
        vi.doMock('@/lib/db/schema', () => ({ documents }));
        vi.doMock('drizzle-orm', () => ({ desc, lt }));

        const { GET } = await import('@/app/api/documents/route');
        const request = new NextRequest('http://localhost/api/documents?limit=2');

        const response = await GET(request);
        expect(response.status).toBe(200);

        const payload = await response.json();
        expect(payload.success).toBe(true);
        expect(payload.data.documents).toHaveLength(2);
        expect(payload.data.documents[0].id).toBe('doc-1');
        expect(payload.data.documents[0].ocrRescueApplied).toBe(true);
        expect(payload.data.documents[0].ocrRescueEngine).toBe('gemini');
        expect(payload.data.documents[0].ocrRescueFallbackEngine).toBeNull();
        expect(payload.data.documents[0].ocrRescueChunksRecovered).toBe(4);
        expect(payload.data.documents[0].folderName).toBe('Kontakty');
        expect(payload.data.nextCursor).toBe('2026-01-02T00:00:00.000Z');
        expect(mocks.limit).toHaveBeenCalledWith(3);
        expect(mocks.where).not.toHaveBeenCalled();
        expect(lt).not.toHaveBeenCalled();
    });

    it('uses cursor filter when cursor is a valid date', async () => {
        const requireAdmin = vi.fn().mockResolvedValue({
            ok: true,
            user: { id: 'admin-id', email: 'admin@example.com', role: 'admin' },
        });
        const docs = [
            makeDoc('doc-4', '2026-01-01T00:00:00.000Z'),
            makeDoc('doc-5', '2025-12-31T00:00:00.000Z'),
        ];
        const { db, mocks } = createDocumentsDbMock({
            limitRows: [],
            whereRows: docs,
        });
        const desc = vi.fn((value: unknown) => ({ op: 'desc', value }));
        const lt = vi.fn((left: unknown, right: unknown) => ({ op: 'lt', left, right }));
        const documents = { createdAt: 'createdAt' };

        vi.doMock('@/lib/auth/request-auth', () => ({ requireAdmin }));
        vi.doMock('@/lib/db', () => ({ db }));
        vi.doMock('@/lib/db/schema', () => ({ documents }));
        vi.doMock('drizzle-orm', () => ({ desc, lt }));

        const { GET } = await import('@/app/api/documents/route');
        const request = new NextRequest(
            'http://localhost/api/documents?limit=1&cursor=2026-01-02T00:00:00.000Z'
        );

        const response = await GET(request);
        expect(response.status).toBe(200);

        const payload = await response.json();
        expect(payload.success).toBe(true);
        expect(payload.data.documents).toHaveLength(1);
        expect(payload.data.documents[0].id).toBe('doc-4');
        expect(mocks.where).toHaveBeenCalledTimes(1);
        expect(mocks.whereLimit).toHaveBeenCalledWith(2);
        expect(mocks.limit).not.toHaveBeenCalled();
        expect(lt).toHaveBeenCalledTimes(1);

        const ltCursorArg = lt.mock.calls[0]?.[1];
        expect(ltCursorArg).toBeInstanceOf(Date);
        expect((ltCursorArg as Date).toISOString()).toBe('2026-01-02T00:00:00.000Z');
    });
});
