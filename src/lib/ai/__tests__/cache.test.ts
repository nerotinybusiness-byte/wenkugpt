import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const originalEnv = { ...process.env };

function mockEmbedder() {
    vi.doMock('@/lib/ingest/embedder', () => ({
        embedText: vi.fn().mockResolvedValue(new Array(768).fill(0.1)),
    }));
}

function mockLogger() {
    vi.doMock('@/lib/logger', () => ({
        devLog: vi.fn(),
        logError: vi.fn(),
        logWarn: vi.fn(),
    }));
}

describe('semantic cache', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        process.env = { ...originalEnv };
        process.env.CACHE_ENABLED = 'true';
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('returns cached data from L1 Redis on exact hash match', async () => {
        process.env.UPSTASH_REDIS_REST_URL = 'https://fake.upstash.io';
        process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';

        const cachedEntry = {
            id: 'cache-1',
            queryText: 'test query',
            answerText: 'cached answer',
            citations: [],
            confidence: 0.95,
            chunkIds: ['chunk-1'],
            hitCount: 3,
            createdAt: new Date().toISOString(),
        };

        vi.doMock('@upstash/redis', () => {
            const Cls = function () {
                return {
                    get: vi.fn().mockResolvedValue(cachedEntry),
                    set: vi.fn(),
                };
            };
            return { Redis: Cls };
        });

        // DB should NOT be called for L1 hit
        vi.doMock('@/lib/db', () => ({
            db: { select: vi.fn(), execute: vi.fn() },
        }));
        vi.doMock('@/lib/db/schema', () => ({
            semanticCache: {},
        }));
        vi.doMock('drizzle-orm', () => ({
            sql: vi.fn(),
            gt: vi.fn(),
            and: vi.fn(),
        }));

        mockEmbedder();
        mockLogger();

        const { lookupCache } = await import('../cache');
        const result = await lookupCache('test query');

        expect(result).not.toBeNull();
        expect(result!.answerText).toBe('cached answer');
        expect(result!.hitCount).toBe(3);
    });

    it('returns null on cache miss', async () => {
        delete process.env.UPSTASH_REDIS_REST_URL;
        delete process.env.UPSTASH_REDIS_REST_TOKEN;

        // No Redis configured, DB returns no matches
        vi.doMock('@upstash/redis', () => ({
            Redis: vi.fn(),
        }));

        const selectLimit = vi.fn().mockResolvedValue([]);
        const selectWhere = vi.fn().mockReturnValue({ limit: selectLimit });
        const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
        const select = vi.fn().mockReturnValue({ from: selectFrom });
        const execute = vi.fn().mockResolvedValue({ rows: [] });

        vi.doMock('@/lib/db', () => ({
            db: { select, execute },
        }));
        vi.doMock('@/lib/db/schema', () => ({
            semanticCache: { queryHash: 'query_hash', expiresAt: 'expires_at' },
        }));
        vi.doMock('drizzle-orm', () => ({
            sql: Object.assign(vi.fn(), { raw: vi.fn() }),
            gt: vi.fn(),
            and: vi.fn(),
        }));

        mockEmbedder();
        mockLogger();

        const { lookupCache } = await import('../cache');
        const result = await lookupCache('unknown query');

        expect(result).toBeNull();
    });

    it('stores response in both L1 and L2', async () => {
        process.env.UPSTASH_REDIS_REST_URL = 'https://fake.upstash.io';
        process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';

        const redisSet = vi.fn().mockResolvedValue('OK');
        vi.doMock('@upstash/redis', () => {
            const Cls = function () {
                return { get: vi.fn(), set: redisSet };
            };
            return { Redis: Cls };
        });

        const insertReturning = vi.fn().mockResolvedValue([{ id: 'new-cache-id' }]);
        const insertConflict = vi.fn().mockReturnValue({ returning: insertReturning });
        const insertValues = vi.fn().mockReturnValue({ onConflictDoUpdate: insertConflict });
        const insert = vi.fn().mockReturnValue({ values: insertValues });

        vi.doMock('@/lib/db', () => ({
            db: { insert },
        }));
        vi.doMock('@/lib/db/schema', () => ({
            semanticCache: { queryHash: 'query_hash' },
        }));
        vi.doMock('drizzle-orm', () => ({
            sql: Object.assign(vi.fn(), { raw: vi.fn() }),
            gt: vi.fn(),
            and: vi.fn(),
        }));

        mockEmbedder();
        mockLogger();

        const { storeInCache } = await import('../cache');

        const id = await storeInCache(
            'test query',
            'test answer',
            [{ id: '1', chunkId: 'c1', page: 1, confidence: 0.9 }],
            0.95,
            ['c1'],
        );

        expect(id).toBe('new-cache-id');
        expect(insert).toHaveBeenCalledTimes(1);
        expect(redisSet).toHaveBeenCalledTimes(1);
    });
});
