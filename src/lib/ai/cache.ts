/**
 * WENKUGPT - Semantic Cache Module
 * 
 * Caches verified RAG responses for instant retrieval of similar queries
 * Uses vector similarity for semantic matching (threshold: 0.95)
 */

import { Redis } from '@upstash/redis';
import { db } from '@/lib/db';
import { semanticCache, type Citation } from '@/lib/db/schema';
import { sql, gt, and } from 'drizzle-orm';
import { embedText } from '@/lib/ingest/embedder';
import CryptoJS from 'crypto-js';
import { devLog, logError, logWarn } from '@/lib/logger';

/**
 * Cache configuration
 */
export const CACHE_CONFIG = {
    /** Minimum similarity for cache hit (0.95 = 95% similar) */
    SIMILARITY_THRESHOLD: 0.95,
    /** Cache TTL in seconds (default: 24 hours) */
    TTL_SECONDS: parseInt(process.env.CACHE_TTL_SECONDS || '86400', 10),
    /** Enable/disable caching */
    ENABLED: process.env.CACHE_ENABLED !== 'false',
};

/**
 * Cached response structure
 */
export interface CachedResponse {
    id: string;
    queryText: string;
    answerText: string;
    citations: Citation[] | null;
    confidence: number;
    chunkIds: string[] | null;
    hitCount: number;
    createdAt: Date;
}

/**
 * Normalize query for consistent hashing
 * - Lowercase
 * - Trim whitespace
 * - Remove extra spaces
 */
function normalizeQuery(query: string): string {
    return query.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Generate SHA-256 hash of normalized query
 */
function hashQuery(query: string): string {
    const normalized = normalizeQuery(query);
    return CryptoJS.SHA256(normalized).toString();
}

/**
 * Check if Redis is configured
 */
function isRedisConfigured(): boolean {
    return !!(
        process.env.UPSTASH_REDIS_REST_URL &&
        process.env.UPSTASH_REDIS_REST_TOKEN
    );
}

/**
 * Get Redis client (lazy init)
 */
let redis: Redis | null = null;
function getRedis(): Redis | null {
    if (!isRedisConfigured()) return null;
    if (!redis) {
        redis = new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL!,
            token: process.env.UPSTASH_REDIS_REST_TOKEN!,
        });
    }
    return redis;
}

function toRows<T>(result: T[] | { rows: T[] }): T[] {
    return Array.isArray(result) ? result : result.rows;
}

/**
 * Look up cached response by semantic similarity
 * 
 * L1: Redis Exact Match (Instant)
 * L2: Postgres Vector Search (Semantic)
 * 
 * @param query - User's question
 * @returns Cached response if found (similarity >= 0.95), null otherwise
 */
export async function lookupCache(query: string): Promise<CachedResponse | null> {
    if (!CACHE_CONFIG.ENABLED) {
        devLog('🔍 Cache: DISABLED');
        return null;
    }

    const startTime = Date.now();
    const queryHash = hashQuery(query);

    // =========================================================================
    // L1 CACHE: REDIS (Exact Match)
    // =========================================================================
    try {
        const redisClient = getRedis();
        if (redisClient) {
            const cachedJson = await redisClient.get<CachedResponse>(`cache:${queryHash}`);
            if (cachedJson) {
                devLog(`⚡ L1 REDIS HIT: "${query.slice(0, 40)}..." (${Date.now() - startTime}ms)`);
                // Restore Date object from JSON string
                return {
                    ...cachedJson,
                    createdAt: new Date(cachedJson.createdAt),
                };
            }
        }
    } catch (error) {
        logWarn('Redis lookup failed', { route: 'cache', stage: 'redis_lookup' }, error);
        // Continue to L2 cache on Redis failure
    }

    try {
        // =========================================================================
        // L2 CACHE: POSTGRES (Semantic Match)
        // =========================================================================

        // First try exact hash match in DB (if Redis missed or expired)
        const exactMatch = await db
            .select()
            .from(semanticCache)
            .where(
                and(
                    sql`${semanticCache.queryHash} = ${queryHash}`,
                    gt(semanticCache.expiresAt, new Date())
                )
            )
            .limit(1);

        if (exactMatch.length > 0) {
            const hit = exactMatch[0];
            await incrementHitCount(hit.id);

            // Sync back to Redis for next time
            const responseObj = {
                id: hit.id,
                queryText: hit.queryText,
                answerText: hit.answerText,
                citations: hit.citations,
                confidence: hit.confidence,
                chunkIds: hit.chunkIds,
                hitCount: hit.hitCount + 1,
                createdAt: hit.createdAt,
            };
            await saveToRedis(queryHash, responseObj);

            devLog(`🔍 L2 DB HIT (exact): "${query.slice(0, 40)}..." (${Date.now() - startTime}ms)`);
            return responseObj;
        }

        // Try semantic similarity match (slower but smarter)
        const queryEmbedding = await embedText(query);

        // Vector similarity search using pgvector
        const semanticMatches = await db.execute<{
            id: string;
            query_text: string;
            answer_text: string;
            citations: Citation[] | null;
            confidence: number;
            chunk_ids: string[] | null;
            hit_count: number;
            created_at: Date;
            similarity: number;
        }>(sql`
            SELECT 
                id,
                query_text,
                answer_text,
                citations,
                confidence,
                chunk_ids,
                hit_count,
                created_at,
                1 - (query_embedding <=> ${sql.raw(`'[${queryEmbedding.join(',')}]'::vector`)}) as similarity
            FROM semantic_cache
            WHERE expires_at > NOW()
                AND query_embedding IS NOT NULL
            ORDER BY query_embedding <=> ${sql.raw(`'[${queryEmbedding.join(',')}]'::vector`)}
            LIMIT 1
        `);

        const semanticRows = toRows(semanticMatches);

        if (semanticRows.length > 0) {
            const match = semanticRows[0];

            if (match.similarity >= CACHE_CONFIG.SIMILARITY_THRESHOLD) {
                await incrementHitCount(match.id);

                const responseObj = {
                    id: match.id,
                    queryText: match.query_text,
                    answerText: match.answer_text,
                    citations: match.citations,
                    confidence: match.confidence,
                    chunkIds: match.chunk_ids,
                    hitCount: match.hit_count + 1,
                    createdAt: match.created_at,
                };

                // Don't sync semantic matches to Redis yet (Redis is strict hash only)
                // Optionally: We could cache this specific query hash -> this response in Redis

                devLog(
                    `🔍 L2 VECTOR HIT: ${(match.similarity * 100).toFixed(1)}% similar ` +
                    `"${query.slice(0, 30)}..." → "${match.query_text.slice(0, 30)}..." ` +
                    `(${Date.now() - startTime}ms)`
                );

                return responseObj;
            }
        }

        devLog(`❌ CACHE MISS: "${query.slice(0, 40)}..." (${Date.now() - startTime}ms)`);
        return null;

    } catch (error) {
        logError('Cache lookup error', { route: 'cache', stage: 'lookup' }, error);
        return null;
    }
}

/**
 * Save to Redis helper
 */
async function saveToRedis(hash: string, data: CachedResponse) {
    try {
        const redisClient = getRedis();
        if (redisClient) {
            await redisClient.set(`cache:${hash}`, data, { ex: CACHE_CONFIG.TTL_SECONDS });
        }
    } catch (error) {
        logWarn('Failed to save cache entry to Redis', { route: 'cache', stage: 'redis_store' }, error);
    }
}

/**
 * Store verified response in cache
 * 
 * @param query - Original user query
 * @param answer - Verified answer from Triple-Agent flow
 * @param citations - Source citations
 * @param confidence - Auditor confidence score
 * @param chunkIds - IDs of source chunks
 */
export async function storeInCache(
    query: string,
    answer: string,
    citations: Citation[],
    confidence: number,
    chunkIds: string[]
): Promise<string | null> {
    if (!CACHE_CONFIG.ENABLED) {
        return null;
    }

    try {
        const queryHash = hashQuery(query);
        const queryEmbedding = await embedText(query);
        const expiresAt = new Date(Date.now() + CACHE_CONFIG.TTL_SECONDS * 1000);

        // Store in Postgres (L2)
        const [inserted] = await db
            .insert(semanticCache)
            .values({
                queryText: query,
                queryHash,
                queryEmbedding,
                answerText: answer,
                citations,
                confidence,
                chunkIds,
                hitCount: 0,
                expiresAt,
            })
            .onConflictDoUpdate({
                target: semanticCache.queryHash,
                set: {
                    answerText: answer,
                    citations,
                    confidence,
                    chunkIds,
                    queryEmbedding,
                    expiresAt,
                },
            })
            .returning({ id: semanticCache.id });

        // Store in Redis (L1)
        const cacheEntry: CachedResponse = {
            id: inserted.id,
            queryText: query,
            answerText: answer,
            citations,
            confidence,
            chunkIds,
            hitCount: 0,
            createdAt: new Date(), // Now
        };

        await saveToRedis(queryHash, cacheEntry);

        devLog(`💾 Cache STORED (L1+L2): "${query.slice(0, 40)}..." (TTL: ${CACHE_CONFIG.TTL_SECONDS}s)`);

        return inserted.id;
    } catch (error) {
        logError('Cache store error', { route: 'cache', stage: 'store' }, error);
        return null;
    }
}

/**
 * Increment hit count for cache entry
 */
async function incrementHitCount(id: string): Promise<void> {
    try {
        await db.execute(sql`
      UPDATE semantic_cache 
      SET hit_count = hit_count + 1 
      WHERE id = ${id}
    `);
    } catch {
        // Non-critical, ignore errors
    }
}

/**
 * Clear expired cache entries
 */
export async function clearExpiredCache(): Promise<number> {
    const result = await db.execute(sql`
    DELETE FROM semantic_cache 
    WHERE expires_at < NOW()
    RETURNING id
  `);

    const rows = toRows(result);
    const count = rows.length;
    if (count > 0) {
        devLog(`🧹 Cache: Cleared ${count} expired entries`);
    }

    return count;
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
    totalEntries: number;
    totalHits: number;
    avgConfidence: number;
}> {
    const stats = await db.execute<{
        total_entries: string;
        total_hits: string;
        avg_confidence: string;
    }>(sql`
    SELECT 
      COUNT(*) as total_entries,
      COALESCE(SUM(hit_count), 0) as total_hits,
      COALESCE(AVG(confidence), 0) as avg_confidence
    FROM semantic_cache
    WHERE expires_at > NOW()
  `);

    const rows = toRows(stats);
    const row = rows[0] || { total_entries: '0', total_hits: '0', avg_confidence: '0' };

    return {
        totalEntries: parseInt(row.total_entries, 10),
        totalHits: parseInt(row.total_hits, 10),
        avgConfidence: parseFloat(row.avg_confidence),
    };
}
