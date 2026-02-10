import { beforeEach, describe, expect, it, vi } from 'vitest';

type ExecuteMockResult = { rows: unknown[] } | unknown[];

function mockDbExecute(sequence: ExecuteMockResult[]) {
    const execute = vi.fn();
    for (const result of sequence) {
        execute.mockResolvedValueOnce(result);
    }

    vi.doMock('@/lib/db', () => ({
        db: { execute },
    }));
}

describe('ingest schema health', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    it('returns ok when required columns and vector extension exist', async () => {
        mockDbExecute([
            {
                rows: [
                    { column_name: 'highlight_boxes' },
                    { column_name: 'highlight_text' },
                    { column_name: 'embedding' },
                    { column_name: 'fts_vector' },
                ],
            },
            {
                rows: [{ extname: 'vector' }],
            },
        ]);

        const { checkIngestSchemaHealth } = await import('@/lib/db/schema-health');
        const result = await checkIngestSchemaHealth();

        expect(result.ok).toBe(true);
        expect(result.missingColumns).toEqual([]);
        expect(result.missingExtensions).toEqual([]);
    });

    it('reports missing columns and extensions', async () => {
        mockDbExecute([
            {
                rows: [
                    { column_name: 'highlight_boxes' },
                    { column_name: 'embedding' },
                ],
            },
            {
                rows: [],
            },
        ]);

        const { checkIngestSchemaHealth } = await import('@/lib/db/schema-health');
        const result = await checkIngestSchemaHealth();

        expect(result.ok).toBe(false);
        expect(result.missingColumns).toContain('highlight_text');
        expect(result.missingColumns).toContain('fts_vector');
        expect(result.missingExtensions).toContain('vector');
    });

    it('assert throws IngestSchemaHealthError with actionable message', async () => {
        mockDbExecute([
            {
                rows: [
                    { column_name: 'highlight_boxes' },
                    { column_name: 'embedding' },
                    { column_name: 'fts_vector' },
                ],
            },
            {
                rows: [{ extname: 'vector' }],
            },
        ]);

        const { assertIngestSchemaHealth } = await import('@/lib/db/schema-health');

        await expect(assertIngestSchemaHealth()).rejects.toMatchObject({
            name: 'IngestSchemaHealthError',
        });
        await expect(assertIngestSchemaHealth()).rejects.toThrow(/highlight_text/);
    });
});
