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
                    { table_name: 'chunks', column_name: 'highlight_boxes' },
                    { table_name: 'chunks', column_name: 'highlight_text' },
                    { table_name: 'chunks', column_name: 'embedding' },
                    { table_name: 'chunks', column_name: 'fts_vector' },
                    { table_name: 'chunks', column_name: 'is_template_boilerplate' },
                    { table_name: 'documents', column_name: 'template_profile_id' },
                    { table_name: 'documents', column_name: 'template_matched' },
                    { table_name: 'documents', column_name: 'template_match_score' },
                    { table_name: 'documents', column_name: 'template_boilerplate_chunks' },
                    { table_name: 'documents', column_name: 'template_detection_mode' },
                    { table_name: 'documents', column_name: 'template_warnings' },
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
                    { table_name: 'chunks', column_name: 'highlight_boxes' },
                    { table_name: 'chunks', column_name: 'embedding' },
                    { table_name: 'documents', column_name: 'template_profile_id' },
                ],
            },
            {
                rows: [],
            },
        ]);

        const { checkIngestSchemaHealth } = await import('@/lib/db/schema-health');
        const result = await checkIngestSchemaHealth();

        expect(result.ok).toBe(false);
        expect(result.missingColumns).toContain('chunks.highlight_text');
        expect(result.missingColumns).toContain('chunks.fts_vector');
        expect(result.missingColumns).toContain('documents.template_matched');
        expect(result.missingExtensions).toContain('vector');
    });

    it('assert throws IngestSchemaHealthError with actionable message', async () => {
        mockDbExecute([
            {
                rows: [
                    { table_name: 'chunks', column_name: 'highlight_boxes' },
                    { table_name: 'chunks', column_name: 'embedding' },
                    { table_name: 'chunks', column_name: 'fts_vector' },
                    { table_name: 'chunks', column_name: 'is_template_boilerplate' },
                    { table_name: 'documents', column_name: 'template_profile_id' },
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
        await expect(assertIngestSchemaHealth()).rejects.toThrow(/chunks.highlight_text/);
    });
});
