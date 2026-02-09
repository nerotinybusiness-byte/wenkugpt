/**
 * WENKUGPT - Embedder
 * 
 * Generates embeddings using Google's text-embedding-004 model.
 * Implements batch processing (100 chunks at a time) to respect API limits.
 */

import { GoogleGenerativeAI, TaskType } from '@google/generative-ai';
import { devLog, logWarn } from '@/lib/logger';

interface EmbedContentRequestCompat {
    content: {
        parts: Array<{ text: string }>;
        role: 'user';
    };
    taskType: TaskType;
    outputDimensionality: number;
}

interface EmbedContentResponseCompat {
    embedding?: {
        values?: number[];
    };
}

interface EmbeddingModelCompat {
    embedContent(request: EmbedContentRequestCompat): Promise<EmbedContentResponseCompat>;
}

/**
 * Configuration for the embedder
 */
export interface EmbedderConfig {
    /** Batch size for API calls (default: 100) */
    batchSize: number;
    /** Delay between batches in ms (default: 100) */
    batchDelayMs: number;
}

/**
 * Default embedder configuration
 */
export const DEFAULT_EMBEDDER_CONFIG: EmbedderConfig = {
    batchSize: 16,
    batchDelayMs: 250,
};

/**
 * Result of embedding a single text
 */
export interface EmbeddingResult {
    /** The input text */
    text: string;
    /** 768-dimensional embedding vector */
    embedding: number[];
    /** Index in the original array */
    index: number;
}

/**
 * Batch embedding result with statistics
 */
export interface BatchEmbeddingResult {
    /** All embeddings */
    embeddings: EmbeddingResult[];
    /** Total tokens used */
    totalTokens: number;
    /** Processing time in ms */
    processingTimeMs: number;
    /** Number of API calls made */
    apiCalls: number;
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get the Google AI API key from environment
 */
function getApiKey(): string {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
        throw new Error(
            'GOOGLE_GENERATIVE_AI_API_KEY environment variable is required.\n' +
            'Get your API key from: https://aistudio.google.com/app/apikey'
        );
    }
    return apiKey;
}

/**
 * Create embeddings for an array of texts
 * 
 * @param texts - Array of text strings to embed
 * @param config - Embedder configuration
 * @returns Batch embedding result with all vectors
 * 
 * @example
 * ```ts
 * const result = await embedTexts(['Hello world', 'Jak se máš?']);
 * console.log(result.embeddings[0].embedding.length); // 768
 * ```
 */
export async function embedTexts(
    texts: string[],
    config: EmbedderConfig = DEFAULT_EMBEDDER_CONFIG
): Promise<BatchEmbeddingResult> {
    const startTime = performance.now();
    const genAI = new GoogleGenerativeAI(getApiKey());
    const model = genAI.getGenerativeModel({ model: 'models/gemini-embedding-001' });
    const embeddingModel = model as unknown as EmbeddingModelCompat;

    const embeddings: EmbeddingResult[] = [];
    let totalTokens = 0;
    let apiCalls = 0;

    // Process in batches
    for (let i = 0; i < texts.length; i += config.batchSize) {
        const batch = texts.slice(i, i + config.batchSize);
        const batchIndices = batch.map((_, idx) => i + idx);

        devLog(`   📤 Embedding batch ${Math.floor(i / config.batchSize) + 1}/${Math.ceil(texts.length / config.batchSize)} (${batch.length} texts)`);

        // Embed each text in the batch
        // Note: text-embedding-004 supports batch embedding via embedContent
        const batchResults = await Promise.all(
            batch.map(async (text, batchIdx) => {
                try {
                    const result = await embeddingModel.embedContent({
                        content: { parts: [{ text }], role: 'user' },
                        taskType: TaskType.RETRIEVAL_DOCUMENT,
                        outputDimensionality: 768,
                    });

                    const values = result.embedding?.values;
                    if (!values || values.length === 0) {
                        throw new Error('Embedding response missing vector values');
                    }

                    return {
                        text,
                        embedding: values,
                        index: batchIndices[batchIdx],
                    };
                } catch (error) {
                    logWarn(
                        'Failed to embed text item',
                        { route: 'ingest', stage: 'embed', index: batchIndices[batchIdx] },
                        error
                    );
                    // Return zero vector on failure
                    return {
                        text,
                        embedding: new Array(768).fill(0),
                        index: batchIndices[batchIdx],
                    };
                }
            })
        );

        embeddings.push(...batchResults);
        apiCalls += batch.length;

        // Estimate token count (rough: 1 token per 4 chars)
        totalTokens += batch.reduce((sum, text) => sum + Math.ceil(text.length / 4), 0);

        // Rate limiting delay between batches
        if (i + config.batchSize < texts.length) {
            await sleep(config.batchDelayMs);
        }
    }

    const processingTimeMs = performance.now() - startTime;

    return {
        embeddings: embeddings.sort((a, b) => a.index - b.index),
        totalTokens,
        processingTimeMs,
        apiCalls,
    };
}

/**
 * Embed a single text
 */
export async function embedText(text: string): Promise<number[]> {
    const result = await embedTexts([text]);
    return result.embeddings[0].embedding;
}

/**
 * Check if the embedder is properly configured
 */
export function isEmbedderConfigured(): boolean {
    return !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;
}
