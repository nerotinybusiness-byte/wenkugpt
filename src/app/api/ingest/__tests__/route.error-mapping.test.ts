import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadMapIngestErrorMessage() {
    vi.doMock('@/lib/ingest/pipeline', () => ({ processPipeline: vi.fn() }));
    vi.doMock('@/lib/auth/request-auth', () => ({ requireAdmin: vi.fn() }));
    vi.doMock('@/lib/db/schema-health', () => ({
        assertIngestSchemaHealth: vi.fn(),
        isIngestSchemaHealthError: vi.fn((error: unknown) => {
            return error instanceof Error && error.name === 'IngestSchemaHealthError';
        }),
    }));

    const mod = await import('@/app/api/ingest/route');
    return mod.mapIngestErrorMessage;
}

describe('mapIngestErrorMessage', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    it('maps PG 42703 highlight_text to actionable migration message', async () => {
        const mapIngestErrorMessage = await loadMapIngestErrorMessage();
        const message = mapIngestErrorMessage({
            code: '42703',
            message: 'column "highlight_text" does not exist',
        });

        expect(message).toContain('chunks.highlight_text');
        expect(message).toContain('drizzle/0004_chunks_highlight_text.sql');
    });

    it('preserves DOMMatrix mapping behavior', async () => {
        const mapIngestErrorMessage = await loadMapIngestErrorMessage();
        const message = mapIngestErrorMessage(new Error('PDF runtime polyfill init failed: Missing DOMMatrix'));

        expect(message).toContain('PDF parser runtime is not configured correctly');
        expect(message).toContain('DOMMatrix');
    });
});
