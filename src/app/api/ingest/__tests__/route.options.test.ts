import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadParseIngestOptions() {
    vi.doMock('@/lib/ingest/pipeline', () => ({ processPipeline: vi.fn() }));
    vi.doMock('@/lib/auth/request-auth', () => ({ requireAdmin: vi.fn() }));
    vi.doMock('@/lib/db/schema-health', () => ({
        assertIngestSchemaHealth: vi.fn(),
        isIngestSchemaHealthError: vi.fn(() => false),
    }));

    const mod = await import('@/app/api/ingest/route');
    return mod.parseIngestOptions;
}

describe('parseIngestOptions', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    it('accepts emptyChunkOcrEnabled and emptyChunkOcrEngine in JSON options payload', async () => {
        const parseIngestOptions = await loadParseIngestOptions();
        const formData = new FormData();
        formData.append('options', JSON.stringify({
            accessLevel: 'team',
            skipEmbedding: false,
            templateProfileId: 'wenku-manual-v1',
            emptyChunkOcrEnabled: true,
            emptyChunkOcrEngine: 'tesseract',
        }));

        const parsed = parseIngestOptions(formData);
        expect(parsed.accessLevel).toBe('team');
        expect(parsed.skipEmbedding).toBe(false);
        expect(parsed.templateProfileId).toBe('wenku-manual-v1');
        expect(parsed.emptyChunkOcrEnabled).toBe(true);
        expect(parsed.emptyChunkOcrEngine).toBe('tesseract');
    });

    it('sanitizes invalid emptyChunkOcrEngine to gemini', async () => {
        const parseIngestOptions = await loadParseIngestOptions();
        const formData = new FormData();
        formData.append('options', JSON.stringify({
            emptyChunkOcrEngine: 'bad-engine',
        }));

        const parsed = parseIngestOptions(formData);
        expect(parsed.emptyChunkOcrEngine).toBe('gemini');
    });

    it('defaults missing emptyChunkOcrEngine to gemini', async () => {
        const parseIngestOptions = await loadParseIngestOptions();
        const formData = new FormData();
        formData.append('options', JSON.stringify({
            accessLevel: 'private',
        }));

        const parsed = parseIngestOptions(formData);
        expect(parsed.emptyChunkOcrEngine).toBe('gemini');
    });

    it('parses and trims folderName from JSON options', async () => {
        const parseIngestOptions = await loadParseIngestOptions();
        const formData = new FormData();
        formData.append('options', JSON.stringify({
            folderName: '  Finance 2026  ',
        }));

        const parsed = parseIngestOptions(formData);
        expect(parsed.folderName).toBe('Finance 2026');
    });

    it('sanitizes empty folderName to undefined', async () => {
        const parseIngestOptions = await loadParseIngestOptions();
        const formData = new FormData();
        formData.append('options', JSON.stringify({
            folderName: '   ',
        }));

        const parsed = parseIngestOptions(formData);
        expect(parsed.folderName).toBeUndefined();
    });

    it('sanitizes folderName longer than 128 chars to undefined', async () => {
        const parseIngestOptions = await loadParseIngestOptions();
        const formData = new FormData();
        formData.append('options', JSON.stringify({
            folderName: 'a'.repeat(129),
        }));

        const parsed = parseIngestOptions(formData);
        expect(parsed.folderName).toBeUndefined();
    });
});
