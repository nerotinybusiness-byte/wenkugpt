import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('GET /api/ingest smoke', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    it('returns endpoint metadata in unified API envelope', async () => {
        vi.doMock('@/lib/ingest/pipeline', () => ({ processPipeline: vi.fn() }));
        vi.doMock('@/lib/auth/request-auth', () => ({ requireAdmin: vi.fn() }));
        vi.doMock('@/lib/db/schema-health', () => ({
            assertIngestSchemaHealth: vi.fn(),
            isIngestSchemaHealthError: vi.fn(() => false),
        }));

        const { GET } = await import('@/app/api/ingest/route');
        const response = await GET();

        expect(response.status).toBe(200);

        const payload = await response.json();
        expect(payload).toMatchObject({
            success: true,
            error: null,
            code: null,
            data: {
                name: 'WENKUGPT Ingest API',
                version: '1.0.0',
            },
        });
        expect(payload.data.endpoints.POST.description).toBe('Upload and process a document');
        expect(payload.data.limits.allowedTypes).toEqual(['application/pdf', 'text/plain']);
        expect(payload.data.endpoints.POST.fields.options).toContain('emptyChunkOcrEnabled');
        expect(payload.data.endpoints.POST.fields.options).toContain('emptyChunkOcrEngine');
        expect(payload.data.endpoints.POST.fields.options).toContain('folderName');
    });
});
