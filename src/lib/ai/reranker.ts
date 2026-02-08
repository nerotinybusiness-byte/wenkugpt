/**
 * WENKUGPT - Cohere Reranker
 * 
 * Uses Cohere's rerank-v3.5 to select the best chunks from search results.
 */

import { CohereClient } from 'cohere-ai';
import type { SearchResult } from '@/lib/db/queries';

/**
 * Reranking configuration
 */
export interface RerankerConfig {
    /** Number of top results to return */
    topK: number;
    /** Minimum relevance score (0-1) */
    minRelevance: number;
    /** Model to use */
    model: string;
}

/**
 * Default reranker configuration
 */
export const DEFAULT_RERANKER_CONFIG: RerankerConfig = {
    topK: 5,
    minRelevance: 0.3,
    model: 'rerank-v3.5',
};

/**
 * Reranked result with relevance score
 */
export interface RerankedResult extends SearchResult {
    /** Cohere relevance score (0-1) */
    relevanceScore: number;
    /** Original rank before reranking */
    originalRank: number;
}

/**
 * Get Cohere client
 */
function getClient(): CohereClient {
    const apiKey = process.env.COHERE_API_KEY;
    if (!apiKey) {
        throw new Error(
            'COHERE_API_KEY environment variable is required.\n' +
            'Get your API key from: https://dashboard.cohere.com/api-keys'
        );
    }
    return new CohereClient({ token: apiKey });
}

/**
 * Check if reranker is configured
 */
export function isRerankerConfigured(): boolean {
    return !!process.env.COHERE_API_KEY;
}

/**
 * Rerank search results using Cohere
 * 
 * @param query - User's original query
 * @param results - Search results from hybrid search
 * @param config - Reranking configuration
 * @returns Top K reranked results
 */
export async function rerankResults(
    query: string,
    results: SearchResult[],
    config: RerankerConfig = DEFAULT_RERANKER_CONFIG
): Promise<RerankedResult[]> {
    if (results.length === 0) {
        console.log('   ⚠️ No results to rerank');
        return [];
    }

    console.log(`\n🎯 Reranking ${results.length} results with Cohere...`);

    // Check if reranker is available
    if (!isRerankerConfigured()) {
        console.log('   ⚠️ Cohere not configured, using original ranking');
        // Return results with fake relevance scores based on combined score
        return results.slice(0, config.topK).map((result, index) => ({
            ...result,
            relevanceScore: result.combinedScore,
            originalRank: index + 1,
        }));
    }

    const client = getClient();

    try {
        // Prepare documents for reranking
        const documents = results.map(r => r.content);

        // Call Cohere rerank API
        const response = await client.v2.rerank({
            model: config.model,
            query: query,
            documents: documents,
            topN: config.topK,
        });

        // Map results back with relevance scores
        const reranked: RerankedResult[] = response.results
            .filter(r => r.relevanceScore >= config.minRelevance)
            .map(r => ({
                ...results[r.index],
                relevanceScore: r.relevanceScore,
                originalRank: r.index + 1,
            }));

        console.log(`   ✓ Selected top ${reranked.length} results`);

        // Log score improvements
        for (const result of reranked.slice(0, 3)) {
            console.log(`     ${result.originalRank}→ Score: ${result.relevanceScore.toFixed(3)} | "${result.content.slice(0, 40)}..."`);
        }

        return reranked;

    } catch (error) {
        console.error('   ❌ Reranking failed:', error);
        // Fallback to original ranking
        return results.slice(0, config.topK).map((result, index) => ({
            ...result,
            relevanceScore: result.combinedScore,
            originalRank: index + 1,
        }));
    }
}
