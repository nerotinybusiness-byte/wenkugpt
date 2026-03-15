import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const originalEnv = { ...process.env };

function mockLogger() {
    vi.doMock('@/lib/logger', () => ({
        devLog: vi.fn(),
        logError: vi.fn(),
        logWarn: vi.fn(),
    }));
}

function mockEmbedder() {
    vi.doMock('@/lib/ingest/embedder', () => ({
        embedText: vi.fn().mockResolvedValue(new Array(768).fill(0.1)),
    }));
}

const fakeChunk = {
    id: 'chunk-1',
    documentId: 'doc-1',
    content: 'Test chunk content about Czech law',
    pageNumber: 1,
    boundingBox: null,
    parentHeader: null,
    vectorScore: 0.9,
    textScore: 0.5,
    combinedScore: 0.8,
    tokenCount: 50,
    filename: 'test.pdf',
};

describe('agents - executeRAG', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        process.env = { ...originalEnv };
        process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test-google-key';
        process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('returns cached response when cache hits, skipping all agents', async () => {
        const cachedResponse = {
            id: 'cache-1',
            queryText: 'test query',
            answerText: 'Cached answer [1]',
            citations: [{ id: '1', chunkId: 'chunk-1', page: 1, confidence: 0.9 }],
            confidence: 0.95,
            chunkIds: ['chunk-1'],
            hitCount: 5,
            createdAt: new Date(),
        };

        vi.doMock('@/lib/ai/cache', () => ({
            lookupCache: vi.fn().mockResolvedValue(cachedResponse),
            storeInCache: vi.fn(),
        }));

        vi.doMock('@/lib/ai/reranker', () => ({
            rerankResults: vi.fn(),
            DEFAULT_RERANKER_CONFIG: { topK: 5, minRelevance: 0.3, model: 'rerank-v3.5' },
        }));

        vi.doMock('@/lib/db/queries', () => ({
            hybridSearch: vi.fn(),
            getChunkById: vi.fn().mockResolvedValue({
                id: 'chunk-1',
                documentId: 'doc-1',
                content: 'Chunk content',
                pageNumber: 1,
                boundingBox: null,
                parentHeader: null,
                vectorScore: 1,
                textScore: 0,
                combinedScore: 1,
                tokenCount: 50,
                filename: 'test.pdf',
            }),
            DEFAULT_SEARCH_CONFIG: { limit: 20, minScore: 0.3, vectorWeight: 0.7, textWeight: 0.3 },
        }));

        vi.doMock('@/lib/db', () => ({ db: {} }));
        vi.doMock('@/lib/db/schema', () => ({ documents: {} }));
        vi.doMock('ai', () => ({ generateText: vi.fn(), streamText: vi.fn() }));
        vi.doMock('@ai-sdk/google', () => ({ createGoogleGenerativeAI: vi.fn() }));
        vi.doMock('@ai-sdk/anthropic', () => ({ createAnthropic: vi.fn() }));
        mockLogger();
        mockEmbedder();

        const { executeRAG } = await import('../agents');
        const result = await executeRAG('test query');

        expect(result.response).toBe('Cached answer [1]');
        expect(result.verified).toBe(true);
        expect(result.verification.assessment).toContain('cache');
    });

    it('runs full pipeline: Retriever + Generator + Auditor + cache store', async () => {
        const mockStoreInCache = vi.fn().mockResolvedValue('cache-id');

        vi.doMock('@/lib/ai/cache', () => ({
            lookupCache: vi.fn().mockResolvedValue(null),
            storeInCache: mockStoreInCache,
        }));

        vi.doMock('@/lib/ai/reranker', () => ({
            rerankResults: vi.fn().mockResolvedValue([
                { ...fakeChunk, relevanceScore: 0.95, originalRank: 1 },
            ]),
            DEFAULT_RERANKER_CONFIG: { topK: 5, minRelevance: 0.3, model: 'rerank-v3.5' },
        }));

        vi.doMock('@/lib/db/queries', () => ({
            hybridSearch: vi.fn().mockResolvedValue([fakeChunk]),
            getChunkById: vi.fn(),
            DEFAULT_SEARCH_CONFIG: { limit: 20, minScore: 0.3, vectorWeight: 0.7, textWeight: 0.3 },
        }));

        vi.doMock('@/lib/db', () => ({
            db: { select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'doc-1' }]) }) }) },
        }));
        vi.doMock('@/lib/db/schema', () => ({ documents: {} }));

        const mockGenerateText = vi.fn().mockResolvedValue({
            text: 'Generated response about Czech law [1]',
        });

        vi.doMock('ai', () => ({
            generateText: mockGenerateText,
            streamText: vi.fn(),
        }));

        const mockGoogleModel = vi.fn();
        vi.doMock('@ai-sdk/google', () => ({
            createGoogleGenerativeAI: vi.fn().mockReturnValue(mockGoogleModel),
        }));

        const mockAnthropicModel = vi.fn();
        vi.doMock('@ai-sdk/anthropic', () => ({
            createAnthropic: vi.fn().mockReturnValue(mockAnthropicModel),
        }));

        mockLogger();
        mockEmbedder();

        const { executeRAG } = await import('../agents');
        const result = await executeRAG('What does Czech law say?');

        // Generator was called
        expect(mockGenerateText).toHaveBeenCalledTimes(2); // Generator + Auditor
        expect(result.sources).toHaveLength(1);
        expect(result.stats.chunksUsed).toBe(1);
    });

    it('returns "not found" Czech message when no chunks found but DB has documents', async () => {
        vi.doMock('@/lib/ai/cache', () => ({
            lookupCache: vi.fn().mockResolvedValue(null),
            storeInCache: vi.fn(),
        }));

        vi.doMock('@/lib/ai/reranker', () => ({
            rerankResults: vi.fn().mockResolvedValue([]),
            DEFAULT_RERANKER_CONFIG: { topK: 5, minRelevance: 0.3, model: 'rerank-v3.5' },
        }));

        vi.doMock('@/lib/db/queries', () => ({
            hybridSearch: vi.fn().mockResolvedValue([]),
            getChunkById: vi.fn(),
            DEFAULT_SEARCH_CONFIG: { limit: 20, minScore: 0.3, vectorWeight: 0.7, textWeight: 0.3 },
        }));

        vi.doMock('@/lib/db', () => ({
            db: {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([{ id: 'doc-1' }]),
                    }),
                }),
            },
        }));
        vi.doMock('@/lib/db/schema', () => ({ documents: {} }));
        vi.doMock('ai', () => ({ generateText: vi.fn(), streamText: vi.fn() }));
        vi.doMock('@ai-sdk/google', () => ({ createGoogleGenerativeAI: vi.fn() }));
        vi.doMock('@ai-sdk/anthropic', () => ({ createAnthropic: vi.fn() }));
        mockLogger();
        mockEmbedder();

        const { executeRAG } = await import('../agents');
        const result = await executeRAG('nonexistent topic');

        expect(result.response).toContain('nemám');
        expect(result.sources).toHaveLength(0);
    });

    it('returns "upload files" Czech message when DB is empty', async () => {
        vi.doMock('@/lib/ai/cache', () => ({
            lookupCache: vi.fn().mockResolvedValue(null),
            storeInCache: vi.fn(),
        }));

        vi.doMock('@/lib/ai/reranker', () => ({
            rerankResults: vi.fn().mockResolvedValue([]),
            DEFAULT_RERANKER_CONFIG: { topK: 5, minRelevance: 0.3, model: 'rerank-v3.5' },
        }));

        vi.doMock('@/lib/db/queries', () => ({
            hybridSearch: vi.fn().mockResolvedValue([]),
            getChunkById: vi.fn(),
            DEFAULT_SEARCH_CONFIG: { limit: 20, minScore: 0.3, vectorWeight: 0.7, textWeight: 0.3 },
        }));

        vi.doMock('@/lib/db', () => ({
            db: {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([]),
                    }),
                }),
            },
        }));
        vi.doMock('@/lib/db/schema', () => ({ documents: {} }));
        vi.doMock('ai', () => ({ generateText: vi.fn(), streamText: vi.fn() }));
        vi.doMock('@ai-sdk/google', () => ({ createGoogleGenerativeAI: vi.fn() }));
        vi.doMock('@ai-sdk/anthropic', () => ({ createAnthropic: vi.fn() }));
        mockLogger();
        mockEmbedder();

        const { executeRAG } = await import('../agents');
        const result = await executeRAG('anything');

        expect(result.response).toContain('nahrajte');
        expect(result.sources).toHaveLength(0);
    });

    it('skips Auditor when skipVerification is true', async () => {
        vi.doMock('@/lib/ai/cache', () => ({
            lookupCache: vi.fn().mockResolvedValue(null),
            storeInCache: vi.fn(),
        }));

        vi.doMock('@/lib/ai/reranker', () => ({
            rerankResults: vi.fn().mockResolvedValue([
                { ...fakeChunk, relevanceScore: 0.95, originalRank: 1 },
            ]),
            DEFAULT_RERANKER_CONFIG: { topK: 5, minRelevance: 0.3, model: 'rerank-v3.5' },
        }));

        vi.doMock('@/lib/db/queries', () => ({
            hybridSearch: vi.fn().mockResolvedValue([fakeChunk]),
            getChunkById: vi.fn(),
            DEFAULT_SEARCH_CONFIG: { limit: 20, minScore: 0.3, vectorWeight: 0.7, textWeight: 0.3 },
        }));

        vi.doMock('@/lib/db', () => ({
            db: { select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'doc-1' }]) }) }) },
        }));
        vi.doMock('@/lib/db/schema', () => ({ documents: {} }));

        const mockGenerateText = vi.fn().mockResolvedValue({
            text: 'Response [1]',
        });

        vi.doMock('ai', () => ({
            generateText: mockGenerateText,
            streamText: vi.fn(),
        }));

        const mockGoogleModel = vi.fn();
        vi.doMock('@ai-sdk/google', () => ({
            createGoogleGenerativeAI: vi.fn().mockReturnValue(mockGoogleModel),
        }));

        vi.doMock('@ai-sdk/anthropic', () => ({
            createAnthropic: vi.fn(),
        }));

        mockLogger();
        mockEmbedder();

        const { executeRAG } = await import('../agents');
        const result = await executeRAG('test', {
            search: { limit: 20, minScore: 0.3, vectorWeight: 0.7, textWeight: 0.3 },
            topK: 5,
            confidenceThreshold: 0.85,
            generatorModel: 'gemini-2.5-flash',
            auditorModel: 'claude-3-5-haiku-latest',
            temperature: 0,
            skipVerification: true,
        });

        // Only Generator call, no Auditor (generateText called once, not twice)
        expect(mockGenerateText).toHaveBeenCalledTimes(1);
        expect(result.verification.assessment).toBe('Verification skipped');
        expect(result.verification.confidence).toBe(0.5);
    });
});
