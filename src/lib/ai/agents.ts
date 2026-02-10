/**
 * WENKUGPT - Triple-Agent RAG System
 * 
 * Implements the three-agent verification flow:
 * 1. Retriever: Finds and reranks relevant chunks
 * 2. Generator (Gemini): Creates response with [ID] citations
 * 3. Auditor (Claude): Verifies claims against sources (NLI)
 * 
 * With semantic caching for instant retrieval of similar queries
 */

import { hybridSearch, getChunkById, type HybridSearchConfig, DEFAULT_SEARCH_CONFIG } from '@/lib/db/queries';
import { rerankResults, DEFAULT_RERANKER_CONFIG } from './reranker';
import { lookupCache, storeInCache } from './cache';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { db } from '@/lib/db';
import { documents } from '@/lib/db/schema';
import type { Citation } from '@/lib/db/schema';
import { devLog, logError, logInfo } from '@/lib/logger';
import { getRagV2Flags } from '@/lib/rag-v2/flags';
import { runV2QueryFlow } from '@/lib/rag-v2/query-flow';
import type { AmbiguityPayload, AmbiguityPolicy, ContextScope, InterpretationPayload } from '@/lib/rag-v2/types';

/**
 * Source chunk with citation ID
 */
export interface SourceChunk {
    /** Citation ID for reference in response (e.g., "[1]") */
    citationId: string;
    /** Chunk ID for Golden Glow lookup */
    chunkId: string;
    /** Document ID */
    documentId: string;
    /** Content of the chunk */
    content: string;
    /** Page number */
    pageNumber: number;
    /** Bounding box for highlighting */
    boundingBox: { x: number; y: number; width: number; height: number } | null;
    /** Fine-grained highlight boxes for line/paragraph precision */
    highlightBoxes?: Array<{ x: number; y: number; width: number; height: number }> | null;
    /** Ingest-time short snippet for text-layer anchoring */
    highlightText?: string | null;
    /** Parent header */
    parentHeader: string | null;
    /** Source filename */
    filename?: string;
    /** Original display filename */
    originalFilename?: string | null;
    /** Relevance score */
    relevanceScore: number;
}

/**
 * RAG response with verification status
 */
export interface RAGResponse {
    /** Generated response text with [ID] citations */
    response: string;
    /** Source chunks used for response */
    sources: SourceChunk[];
    /** Whether the response passed NLI verification */
    verified: boolean;
    /** Verification details */
    verification: {
        /** Auditor's assessment */
        assessment: string;
        /** Claims that were verified */
        verifiedClaims: string[];
        /** Claims that were removed (hallucinations) */
        removedClaims: string[];
        /** Confidence score (0-1) */
        confidence: number;
    };
    /** Processing statistics */
    stats: {
        retrievalTimeMs: number;
        generationTimeMs: number;
        verificationTimeMs: number;
        totalTimeMs: number;
        chunksRetrieved: number;
        chunksUsed: number;
    };
    interpretation?: InterpretationPayload;
    ambiguities?: AmbiguityPayload[];
    engineMeta?: {
        engine: RAGEngineId;
        mode: 'compat' | 'graph';
    };
}

export type RAGEngineId = 'v1' | 'v2';
const DEFAULT_RAG_ENGINE: RAGEngineId = 'v1';

/**
 * Configuration for RAG pipeline
 */
export interface RAGConfig {
    /** Active RAG engine */
    ragEngine: RAGEngineId;
    /** Optional scope (team/product/region/process) for graph memory resolution */
    contextScope?: ContextScope;
    /** Optional timestamp for temporal meaning resolution */
    effectiveAt?: string;
    /** Strategy for ambiguity handling */
    ambiguityPolicy?: AmbiguityPolicy;
    /** Search configuration */
    search: HybridSearchConfig;
    /** Number of top chunks to use after reranking */
    topK: number;
    /** Minimum confidence threshold (0-1) */
    confidenceThreshold: number;
    /** Generator model */
    generatorModel: string;
    /** Auditor model */
    auditorModel: string;
    /** Temperature for generator */
    temperature: number;
    /** Skip verification (faster but less safe) */
    skipVerification: boolean;
    /** Skip generation (for debugging retrieval) */
    skipGeneration?: boolean;
}

const DEFAULT_GENERATOR_MODEL = 'gemini-2.5-flash';

/**
 * Default RAG configuration
 */
export const DEFAULT_RAG_CONFIG: RAGConfig = {
    ragEngine: DEFAULT_RAG_ENGINE,
    contextScope: undefined,
    effectiveAt: undefined,
    ambiguityPolicy: 'show_both',
    search: DEFAULT_SEARCH_CONFIG,
    topK: 5,
    confidenceThreshold: 0.85,
    generatorModel: DEFAULT_GENERATOR_MODEL,
    auditorModel: 'claude-3-5-haiku-latest',
    temperature: 0.0,
    skipVerification: false,
};

/**
 * Build context string from sources
 */
function buildContext(sources: SourceChunk[]): string {
    return sources
        .map(s => `[${s.citationId}] (${s.originalFilename || s.filename || 'Unknown'}, p.${s.pageNumber})\n${s.content}`)
        .join('\n\n---\n\n');
}

/**
 * Rough token-safe truncation for context to avoid exceeding model limits.
 * Assumes ~4 chars per token and targets ~6k tokens budget for context.
 */
const MAX_CONTEXT_CHARS = 24000;

function buildTruncatedContext(sources: SourceChunk[]): string {
    const parts: string[] = [];
    let totalChars = 0;

    for (const s of sources) {
        const chunkText = `[${s.citationId}] (${s.originalFilename || s.filename || 'Unknown'}, p.${s.pageNumber})\n${s.content}`;
        if (totalChars + chunkText.length > MAX_CONTEXT_CHARS) {
            break;
        }
        parts.push(chunkText);
        totalChars += chunkText.length;
    }

    return parts.join('\n\n---\n\n');
}

async function generateWithTimeout(args: Parameters<typeof generateText>[0], timeoutMs = 30000) {
    return Promise.race([
        generateText(args),
        new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('LLM call timed out')), timeoutMs),
        ),
    ]);
}

/**
 * Generator system prompt (Czech-optimized)
 */
const GENERATOR_SYSTEM_PROMPT = `Jsi přesný asistent pro vyhledávání informací. Odpovídáš POUZE na základě poskytnutých zdrojů.

PRAVIDLA:
1. KAŽDÉ tvrzení MUSÍ být zakončeno citací ve formátu [ID], např. [1], [2].
2. Pokud informace není ve zdrojích, odpověz: "Tuto informaci v dokumentaci nemám."
3. NIKDY nevymýšlej fakta, která nejsou ve zdrojích.
4. Odpovídej česky, stručně a věcně.
5. Pokud je otázka nejednoznačná, požádej o upřesnění.

FORMÁT ODPOVĚDI:
- Používej krátké odstavce
- Každé tvrzení končí citací [ID]
- Na konci neuváděj seznam zdrojů (ten se generuje automaticky)`;

/**
 * Auditor system prompt (NLI verification)
 */
const AUDITOR_SYSTEM_PROMPT = `You are a strict fact-checker. Your job is to verify that EVERY claim in the response is directly supported by the provided sources.

TASK:
1. For each sentence in the response, check if it has a citation [ID]
2. Verify the cited source actually supports the claim
3. Flag any claims that are:
   - Not supported by the cited source
   - Extrapolated beyond what the source says
   - Missing citations entirely

OUTPUT FORMAT (JSON):
{
  "verified": true/false,
  "confidence": 0.0-1.0,
  "assessment": "Brief summary of verification",
  "verifiedClaims": ["claim 1", "claim 2"],
  "removedClaims": ["any unsupported claims"],
  "correctedResponse": "Response with unsupported claims removed (in Czech)"
}

Be STRICT. If in doubt, flag it.`;

/**
 * Agent 1: Retriever
 * Finds and reranks relevant chunks
 */
async function agentRetriever(
    query: string,
    config: RAGConfig
): Promise<{ sources: SourceChunk[]; timeMs: number }> {
    const startTime = performance.now();

    devLog('\n🔍 Agent 1 (Retriever): Searching...');

    // Step 1: Hybrid search
    const searchResults = await hybridSearch(query, config.search);
    devLog(`   Found ${searchResults.length} initial results`);

    // Step 2: Rerank
    const reranked = await rerankResults(query, searchResults, {
        ...DEFAULT_RERANKER_CONFIG,
        topK: config.topK,
    });

    // Convert to SourceChunks with citation IDs
    const sources: SourceChunk[] = reranked.map((result, index) => ({
        citationId: String(index + 1),
        chunkId: result.id,
        documentId: result.documentId,
        content: result.content,
        pageNumber: result.pageNumber,
        boundingBox: result.boundingBox,
        highlightBoxes: result.highlightBoxes ?? null,
        highlightText: result.highlightText ?? null,
        parentHeader: result.parentHeader,
        filename: result.filename,
        originalFilename: result.originalFilename ?? null,
        relevanceScore: result.relevanceScore,
    }));

    const timeMs = performance.now() - startTime;
    devLog(`   ✓ Selected ${sources.length} sources in ${timeMs.toFixed(0)}ms`);

    return { sources, timeMs };
}

/**
 * Agent 2: Generator (Gemini)
 * Creates response with citations
 */
async function agentGenerator(
    query: string,
    sources: SourceChunk[],
    config: RAGConfig
): Promise<{ response: string; timeMs: number }> {
    const startTime = performance.now();

    devLog('\n✍️  Agent 2 (Generator): Creating response...');

    if (sources.length === 0) {
        return {
            response: 'Tuto informaci v dokumentaci nemám.',
            timeMs: performance.now() - startTime,
        };
    }

    const context = buildTruncatedContext(sources);

    const google = createGoogleGenerativeAI({
        apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    });

    const result = await generateWithTimeout({
        model: google(config.generatorModel),
        system: GENERATOR_SYSTEM_PROMPT,
        prompt: `ZDROJE:\n${context}\n\n---\n\nOTÁZKA: ${query}`,
        temperature: config.temperature,
    });

    const timeMs = performance.now() - startTime;
    devLog(`   ✓ Generated response in ${timeMs.toFixed(0)}ms`);

    return { response: result.text, timeMs };
}

/**
 * Agent 3: Auditor (Claude)
 * Verifies claims against sources
 */
async function agentAuditor(
    response: string,
    sources: SourceChunk[],
    config: RAGConfig
): Promise<{
    verified: boolean;
    assessment: string;
    verifiedClaims: string[];
    removedClaims: string[];
    confidence: number;
    correctedResponse: string;
    timeMs: number;
}> {
    const startTime = performance.now();

    devLog('\n🧐 Agent 3 (Auditor): Verifying claims...');

    // Skip verification if configured
    if (config.skipVerification) {
        devLog('   ⚠️ Verification skipped');
        return {
            verified: true,
            assessment: 'Verification skipped',
            verifiedClaims: [],
            removedClaims: [],
            confidence: 0.5,
            correctedResponse: response,
            timeMs: performance.now() - startTime,
        };
    }

    // Check if Claude is configured
    if (!process.env.ANTHROPIC_API_KEY) {
        devLog('   ⚠️ Claude not configured, skipping verification');
        return {
            verified: true,
            assessment: 'No auditor available',
            verifiedClaims: [],
            removedClaims: [],
            confidence: 0.5,
            correctedResponse: response,
            timeMs: performance.now() - startTime,
        };
    }

    const context = buildContext(sources);

    try {
        const anthropic = createAnthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });

        const result = await generateWithTimeout({
            model: anthropic(config.auditorModel),
            system: AUDITOR_SYSTEM_PROMPT,
            prompt: `SOURCES:\n${context}\n\n---\n\nRESPONSE TO VERIFY:\n${response}`,
            temperature: 0,
        });

        // Parse JSON response
        const jsonMatch = result.text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No JSON found in auditor response');
        }

        const audit = JSON.parse(jsonMatch[0]);

        const timeMs = performance.now() - startTime;
        devLog(`   ✓ Verification complete in ${timeMs.toFixed(0)}ms`);
        devLog(`   Confidence: ${(audit.confidence * 100).toFixed(0)}%`);
        devLog(`   Verified: ${audit.verified}`);

        return {
            verified: audit.verified && audit.confidence >= config.confidenceThreshold,
            assessment: audit.assessment || '',
            verifiedClaims: audit.verifiedClaims || [],
            removedClaims: audit.removedClaims || [],
            confidence: audit.confidence || 0,
            correctedResponse: audit.correctedResponse || response,
            timeMs,
        };

    } catch (error) {
        logError('Auditor error', { route: 'rag', stage: 'auditor' }, error);
        return {
            verified: false,
            assessment: 'Verification failed',
            verifiedClaims: [],
            removedClaims: [],
            confidence: 0,
            correctedResponse: response,
            timeMs: performance.now() - startTime,
        };
    }
}

/**
 * Execute the full RAG pipeline
 * 
 * @param query - User's question in Czech
 * @param config - RAG configuration
 * @returns Response with sources and verification status
 */
async function executeRAGCore(
    query: string,
    config: RAGConfig = DEFAULT_RAG_CONFIG
): Promise<RAGResponse> {
    const startTime = performance.now();
    const cacheNamespace = resolveCacheNamespace(config.ragEngine);

    devLog(`[${config.ragEngine}] Query: "${query}"`);
    devLog(`${'='.repeat(60)}`);

    // ============================================================
    // CACHE CHECK - Try to find cached response first
    // ============================================================
    const cached = await lookupCache(query, { namespace: cacheNamespace });

    if (cached) {
        const totalTimeMs = performance.now() - startTime;

        devLog(`\n${'='.repeat(60)}`);
        devLog(`⚡ CACHE HIT - Instant Response`);
        devLog(`${'='.repeat(60)}`);
        devLog(`   Original query: "${cached.queryText.slice(0, 40)}..."`);
        devLog(`   Hit count: ${cached.hitCount}`);
        devLog(`   Confidence: ${(cached.confidence * 100).toFixed(0)}%`);
        devLog(`   Total time: ${totalTimeMs.toFixed(0)}ms (saved ~2000ms)`);
        devLog(`${'='.repeat(60)}\n`);

        // Rehydrate sources from DB so citation click still has filename/page/bbox.
        const cachedCitations = cached.citations || [];
        const sources: SourceChunk[] = await Promise.all(cachedCitations.map(async (c, index) => {
            const chunk = await getChunkById(c.chunkId);
            return {
                citationId: c.id || String(index + 1),
                chunkId: c.chunkId,
                documentId: chunk?.documentId || '',
                content: chunk?.content || '',
                pageNumber: chunk?.pageNumber || c.page,
                boundingBox: chunk?.boundingBox || null,
                highlightBoxes: chunk?.highlightBoxes ?? (chunk?.boundingBox ? [chunk.boundingBox] : null),
                highlightText: chunk?.highlightText ?? null,
                parentHeader: chunk?.parentHeader || null,
                filename: chunk?.filename,
                originalFilename: chunk?.originalFilename ?? null,
                relevanceScore: c.confidence,
            };
        }));

        return {
            response: cached.answerText,
            sources,
            verified: true, // Cached responses are already verified
            verification: {
                assessment: 'Retrieved from semantic cache',
                verifiedClaims: [],
                removedClaims: [],
                confidence: cached.confidence,
            },
            stats: {
                retrievalTimeMs: 0, // Cache hit, no retrieval
                generationTimeMs: 0, // Cache hit, no generation
                verificationTimeMs: 0, // Cache hit, no verification
                totalTimeMs,
                chunksRetrieved: 0,
                chunksUsed: sources.length,
            },
            engineMeta: {
                engine: config.ragEngine,
                mode: 'compat',
            },
        };
    }

    // ============================================================
    // FULL RAG PIPELINE - No cache hit, run all agents
    // ============================================================

    // Agent 1: Retrieve
    const { sources, timeMs: retrievalTimeMs } = await agentRetriever(query, config);

    // If no sources found, check if DB is empty
    if (sources.length === 0) {
        try {
            // Use limit(1) to check existence - safer/faster than count()
            const docs = await db.select().from(documents).limit(1);

            if (docs.length === 0) {
                devLog('   ⚠️ Database is empty (0 documents)');
                return {
                    response: 'Aktuálně nemám k dispozici žádné dokumenty. Prosím nahrajte soubory v sekci "Manage Files", abych mohl odpovídat na vaše dotazy.',
                    sources: [],
                    verified: true,
                    verification: {
                        assessment: 'System empty',
                        verifiedClaims: [],
                        removedClaims: [],
                        confidence: 1.0,
                    },
                    stats: {
                        retrievalTimeMs,
                        generationTimeMs: 0,
                        verificationTimeMs: 0,
                        totalTimeMs: performance.now() - startTime,
                        chunksRetrieved: 0,
                        chunksUsed: 0,
                    },
                    engineMeta: {
                        engine: config.ragEngine,
                        mode: 'compat',
                    },
                };
            }
        } catch (dbError) {
            logError('Database precheck failed', { route: 'rag', stage: 'precheck' }, dbError);
            // Fallthrough to normal "Not found" response if check fails
        }
    }

    // Agent 2: Generate
    let rawResponse = '';
    let generationTimeMs = 0;

    if (config.skipGeneration) {
        devLog('   ⚠️ Generation skipped');
        rawResponse = 'Generation skipped (Debug Mode)';
    } else {
        const genResult = await agentGenerator(
            query,
            sources,
            config
        );
        rawResponse = genResult.response;
        generationTimeMs = genResult.timeMs;
    }

    // Agent 3: Audit (skip if generation skipped)
    const audit = config.skipGeneration
        ? { verified: true, assessment: 'Skipped', verifiedClaims: [], removedClaims: [], confidence: 1, correctedResponse: rawResponse, timeMs: 0 }
        : await agentAuditor(rawResponse, sources, config);

    const totalTimeMs = performance.now() - startTime;

    // Use corrected response if verification found issues
    const finalResponse = audit.removedClaims.length > 0
        ? audit.correctedResponse
        : rawResponse;

    // ============================================================
    // CACHE STORE - Save verified response for future queries
    // ============================================================
    if (audit.verified && audit.confidence >= config.confidenceThreshold) {
        const citations: Citation[] = sources.map((s) => ({
            id: s.citationId,
            chunkId: s.chunkId,
            page: s.pageNumber,
            confidence: s.relevanceScore,
        }));

        await storeInCache(
            query,
            finalResponse,
            citations,
            audit.confidence,
            sources.map(s => s.chunkId),
            { namespace: cacheNamespace },
        );
    }

    devLog(`\n${'='.repeat(60)}`);
    devLog(`📊 RAG Complete`);
    devLog(`${'='.repeat(60)}`);
    devLog(`   Sources used: ${sources.length}`);
    devLog(`   Verified: ${audit.verified ? '✓' : '✗'}`);
    devLog(`   Confidence: ${(audit.confidence * 100).toFixed(0)}%`);
    devLog(`   Total time: ${totalTimeMs.toFixed(0)}ms`);
    devLog(`   Cached: ${audit.verified && audit.confidence >= config.confidenceThreshold ? '✓' : '✗'}`);
    devLog(`${'='.repeat(60)}\n`);

    return {
        response: finalResponse,
        sources,
        verified: audit.verified,
        verification: {
            assessment: audit.assessment,
            verifiedClaims: audit.verifiedClaims,
            removedClaims: audit.removedClaims,
            confidence: audit.confidence,
        },
        stats: {
            retrievalTimeMs,
            generationTimeMs,
            verificationTimeMs: audit.timeMs,
            totalTimeMs,
            chunksRetrieved: sources.length,
            chunksUsed: sources.length,
        },
        engineMeta: {
            engine: config.ragEngine,
            mode: 'compat',
        },
    };
}

function normalizeRagConfig(config: Partial<RAGConfig>): RAGConfig {
    const ragEngine: RAGEngineId = config.ragEngine === 'v2' ? 'v2' : 'v1';
    const ambiguityPolicy: AmbiguityPolicy = config.ambiguityPolicy === 'ask'
        || config.ambiguityPolicy === 'strict'
        || config.ambiguityPolicy === 'show_both'
        ? config.ambiguityPolicy
        : DEFAULT_RAG_CONFIG.ambiguityPolicy!;

    const normalizedScope = config.contextScope
        ? {
            team: config.contextScope.team?.trim() || undefined,
            product: config.contextScope.product?.trim() || undefined,
            region: config.contextScope.region?.trim() || undefined,
            process: config.contextScope.process?.trim() || undefined,
            role: config.contextScope.role?.trim() || undefined,
        }
        : undefined;

    const normalizedEffectiveAt = (() => {
        const raw = config.effectiveAt?.trim();
        if (!raw) return undefined;
        const parsed = new Date(raw);
        return Number.isNaN(parsed.getTime()) ? undefined : raw;
    })();

    return {
        ...DEFAULT_RAG_CONFIG,
        ...config,
        search: {
            ...DEFAULT_RAG_CONFIG.search,
            ...(config.search ?? {}),
        },
        ragEngine,
        contextScope: normalizedScope,
        effectiveAt: normalizedEffectiveAt,
        ambiguityPolicy,
    };
}

function resolveCacheNamespace(engine: RAGEngineId): string {
    // Keep v1 cache hash unchanged for backward compatibility.
    if (engine === 'v1') return '';
    return `rag-${engine}`;
}

async function executeRAGV2(
    query: string,
    config: RAGConfig,
): Promise<RAGResponse> {
    const flags = getRagV2Flags();
    if (!flags.graphEnabled) {
        const compatResponse = await executeRAGCore(query, config);
        return {
            ...compatResponse,
            engineMeta: {
                engine: 'v2',
                mode: 'compat',
            },
        };
    }

    const flow = await runV2QueryFlow({
        query,
        contextScope: config.contextScope,
        effectiveAt: config.effectiveAt,
        ambiguityPolicy: config.ambiguityPolicy,
        rewriteEnabled: flags.rewriteEnabled,
        graphEnabled: flags.graphEnabled,
        strictGrounding: flags.strictGrounding,
    });

    logInfo('RAG v2 telemetry', {
        route: 'rag',
        stage: 'query-flow',
        ambiguityCount: flow.ambiguities.length,
        unsupportedTermCount: flow.unsupportedTerms.length,
        interpretationTimeMs: flow.stats.interpretationTimeMs,
        graphExpansionTimeMs: flow.stats.graphExpansionTimeMs,
    });

    if (flow.strictFailureMessage) {
        return {
            response: flow.strictFailureMessage,
            sources: [],
            verified: true,
            verification: {
                assessment: 'Strict grounding requires manual verification.',
                verifiedClaims: [],
                removedClaims: [],
                confidence: 1,
            },
            stats: {
                retrievalTimeMs: 0,
                generationTimeMs: 0,
                verificationTimeMs: 0,
                totalTimeMs: flow.stats.interpretationTimeMs + flow.stats.graphExpansionTimeMs,
                chunksRetrieved: 0,
                chunksUsed: 0,
            },
            interpretation: flow.interpretation,
            ambiguities: flow.ambiguities,
            engineMeta: {
                engine: 'v2',
                mode: 'graph',
            },
        };
    }

    const baseResponse = await executeRAGCore(flow.expandedQuery, config);
    return {
        ...baseResponse,
        interpretation: flow.interpretation,
        ambiguities: flow.ambiguities,
        engineMeta: {
            engine: 'v2',
            mode: 'graph',
        },
    };
}

export async function executeRAG(
    query: string,
    config: Partial<RAGConfig> = DEFAULT_RAG_CONFIG,
): Promise<RAGResponse> {
    const normalizedConfig = normalizeRagConfig(config);

    if (normalizedConfig.ragEngine === 'v2') {
        return executeRAGV2(query, normalizedConfig);
    }

    const v1Response = await executeRAGCore(query, normalizedConfig);
    return {
        ...v1Response,
        engineMeta: {
            engine: 'v1',
            mode: 'compat',
        },
    };
}

/**
 * Quick RAG without verification (faster, less safe)
 */
export async function quickRAG(
    query: string,
    config: Partial<RAGConfig> = {}
): Promise<RAGResponse> {
    return executeRAG(query, {
        ...DEFAULT_RAG_CONFIG,
        ...config,
        skipVerification: true,
    });
}
