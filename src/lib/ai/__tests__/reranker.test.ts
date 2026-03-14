import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SearchResult } from '@/lib/db/queries';

function makeResult(overrides: Partial<SearchResult> = {}): SearchResult {
    return {
        id: 'chunk-1',
        documentId: 'doc-1',
        content: 'Test content',
        pageNumber: 1,
        boundingBox: null,
        parentHeader: null,
        vectorScore: 0.9,
        textScore: 0.5,
        combinedScore: 0.8,
        tokenCount: 100,
        filename: 'test.pdf',
        ...overrides,
    };
}

const originalEnv = { ...process.env };

describe('reranker', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('calls Cohere rerank when COHERE_API_KEY is set', async () => {
        process.env.COHERE_API_KEY = 'test-key';

        const mockRerank = vi.fn().mockResolvedValue({
            results: [
                { index: 0, relevanceScore: 0.95 },
                { index: 1, relevanceScore: 0.8 },
            ],
        });

        vi.doMock('cohere-ai', () => {
            const Cls = function (this: Record<string, unknown>) {
                this.v2 = { rerank: mockRerank };
            } as unknown as typeof import('cohere-ai').CohereClient;
            return { CohereClient: Cls };
        });

        vi.doMock('@/lib/logger', () => ({
            devLog: vi.fn(),
            logError: vi.fn(),
        }));

        const { rerankResults } = await import('../reranker');

        const results = [
            makeResult({ id: 'a', content: 'First' }),
            makeResult({ id: 'b', content: 'Second' }),
        ];

        const reranked = await rerankResults('query', results, {
            topK: 2,
            minRelevance: 0.3,
            model: 'rerank-v3.5',
        });

        expect(mockRerank).toHaveBeenCalledTimes(1);
        expect(reranked).toHaveLength(2);
        expect(reranked[0].id).toBe('a');
        expect(reranked[0].relevanceScore).toBe(0.95);
    });

    it('falls back to original ranking when Cohere is not configured', async () => {
        delete process.env.COHERE_API_KEY;

        vi.doMock('cohere-ai', () => ({
            CohereClient: vi.fn(),
        }));

        vi.doMock('@/lib/logger', () => ({
            devLog: vi.fn(),
            logError: vi.fn(),
        }));

        const { rerankResults } = await import('../reranker');

        const results = [
            makeResult({ id: 'a', combinedScore: 0.9 }),
            makeResult({ id: 'b', combinedScore: 0.7 }),
            makeResult({ id: 'c', combinedScore: 0.5 }),
        ];

        const reranked = await rerankResults('query', results, {
            topK: 2,
            minRelevance: 0.3,
            model: 'rerank-v3.5',
        });

        expect(reranked).toHaveLength(2);
        expect(reranked[0].id).toBe('a');
        expect(reranked[0].relevanceScore).toBe(0.9);
    });

    it('returns empty array for empty input', async () => {
        vi.doMock('cohere-ai', () => ({
            CohereClient: vi.fn(),
        }));

        vi.doMock('@/lib/logger', () => ({
            devLog: vi.fn(),
            logError: vi.fn(),
        }));

        const { rerankResults } = await import('../reranker');

        const reranked = await rerankResults('query', []);
        expect(reranked).toEqual([]);
    });
});
