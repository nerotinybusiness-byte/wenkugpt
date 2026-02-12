/**
 * WENKUGPT - Chat API Route
 *
 * POST /api/chat
 * GET  /api/chat?chatId=...
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { executeRAG, type RAGConfig, type RAGEngineId } from '@/lib/ai/agents';
import { requireUser } from '@/lib/auth/request-auth';
import { getRequestId, logError, logInfo } from '@/lib/logger';
import type { MessageSource } from '@/lib/db/schema';
import { apiError, apiSuccess } from '@/lib/api/response';
import { isRagV2KillSwitchEnabled } from '@/lib/rag-v2/flags';
import type { AmbiguityPolicy, ContextScope } from '@/lib/rag-v2/types';
import { classifyChatError } from '@/lib/chat/error-classifier';

const CHAT_MAX_ATTEMPTS = 2;
const CHAT_RETRY_BASE_DELAY_MS = 350;
const CHAT_RETRY_JITTER_MS = 150;
const FALLBACK_RESPONSE_CS = 'Odpověď je teď dočasně nedostupná. Zkus prosím dotaz za chvíli znovu.';

const DEFAULT_GENERATOR_MODEL = 'gemini-2.5-flash';
const DEFAULT_RAG_ENGINE: RAGEngineId = 'v2';
const DEFAULT_AMBIGUITY_POLICY: AmbiguityPolicy = 'show_both';
const SUPPORTED_GENERATOR_MODELS = new Set([
    'gemini-2.5-flash',
]);
const SUPPORTED_RAG_ENGINES = new Set<RAGEngineId>([
    'v1',
    'v2',
]);
const SUPPORTED_AMBIGUITY_POLICIES = new Set<AmbiguityPolicy>([
    'ask',
    'show_both',
    'strict',
]);

function withRequestId<T extends Response>(response: T, requestId: string): T {
    response.headers.set('x-request-id', requestId);
    return response;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldForceFallback(): boolean {
    return process.env.CHAT_FORCE_FALLBACK === 'true';
}

function resolveGeneratorModel(model?: string): string {
    if (!model) return DEFAULT_GENERATOR_MODEL;
    return SUPPORTED_GENERATOR_MODELS.has(model) ? model : DEFAULT_GENERATOR_MODEL;
}

function resolveRagEngine(engine?: string): RAGEngineId {
    if (!engine) return DEFAULT_RAG_ENGINE;
    return SUPPORTED_RAG_ENGINES.has(engine as RAGEngineId)
        ? (engine as RAGEngineId)
        : DEFAULT_RAG_ENGINE;
}

function resolveAmbiguityPolicy(policy?: string): AmbiguityPolicy {
    if (!policy) return DEFAULT_AMBIGUITY_POLICY;
    return SUPPORTED_AMBIGUITY_POLICIES.has(policy as AmbiguityPolicy)
        ? (policy as AmbiguityPolicy)
        : DEFAULT_AMBIGUITY_POLICY;
}

function sanitizeScopeValue(value?: string): string | undefined {
    if (!value) return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

function resolveContextScope(scope?: {
    team?: string;
    product?: string;
    region?: string;
    process?: string;
}): ContextScope | undefined {
    if (!scope) return undefined;

    const resolved: ContextScope = {
        team: sanitizeScopeValue(scope.team),
        product: sanitizeScopeValue(scope.product),
        region: sanitizeScopeValue(scope.region),
        process: sanitizeScopeValue(scope.process),
    };

    if (!resolved.team && !resolved.product && !resolved.region && !resolved.process) {
        return undefined;
    }

    return resolved;
}

function resolveEffectiveAt(value?: string): string | undefined {
    if (!value) return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? undefined : trimmed;
}

const ChatRequestSchema = z.object({
    query: z.string().min(1).max(2000),
    settings: z.object({
        ragEngine: z.string().optional(),
        contextScope: z.object({
            team: z.string().optional(),
            product: z.string().optional(),
            region: z.string().optional(),
            process: z.string().optional(),
        }).optional(),
        effectiveAt: z.string().optional(),
        ambiguityPolicy: z.string().optional(),
        vectorWeight: z.number().optional(),
        textWeight: z.number().optional(),
        minScore: z.number().optional(),
        searchLimit: z.number().optional(),
        topK: z.number().optional(),
        minRelevance: z.number().optional(),
        generatorModel: z.string().optional(),
        auditorModel: z.string().optional(),
        temperature: z.number().optional(),
        enableAuditor: z.boolean().optional(),
        confidenceThreshold: z.number().optional(),
    }).optional(),
    chatId: z.string().uuid().nullish(),
});

export async function POST(request: NextRequest) {
    const requestId = getRequestId(request);
    try {
        const auth = await requireUser(request);
        if (!auth.ok) return withRequestId(auth.response, requestId);
        const userId = auth.user.id;

        const body = await request.json();
        const parsed = ChatRequestSchema.safeParse(body);

        if (!parsed.success) {
            return withRequestId(
                apiError('CHAT_INVALID_REQUEST', 'Invalid request', 400, parsed.error.issues),
                requestId,
            );
        }

        const { query, settings, chatId: requestedChatId } = parsed.data;

        const db = await import('@/lib/db').then((m) => m.db);
        const { chats, messages } = await import('@/lib/db/schema');
        const { eq, and } = await import('drizzle-orm');

        let chatId = requestedChatId;

        if (!chatId) {
            const [newChat] = await db.insert(chats).values({
                userId,
                title: query.slice(0, 50),
            }).returning();
            chatId = newChat.id;
        } else {
            const existing = await db
                .select({ id: chats.id })
                .from(chats)
                .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
                .limit(1);

            if (existing.length === 0) {
                return withRequestId(
                    apiError('CHAT_NOT_FOUND', 'Chat not found or access denied', 404),
                    requestId,
                );
            }
        }

        await db.insert(messages).values({
            chatId: chatId!,
            role: 'user',
            content: query,
        });

        const requestedEngine = resolveRagEngine(settings?.ragEngine);
        const ragEngine = isRagV2KillSwitchEnabled() ? 'v1' : requestedEngine;

        const ragConfig: Partial<RAGConfig> = {
            ragEngine,
            contextScope: resolveContextScope(settings?.contextScope),
            effectiveAt: resolveEffectiveAt(settings?.effectiveAt),
            ambiguityPolicy: resolveAmbiguityPolicy(settings?.ambiguityPolicy),
            search: {
                limit: settings?.searchLimit ?? 20,
                minScore: settings?.minScore ?? 0.3,
                vectorWeight: settings?.vectorWeight ?? 0.7,
                textWeight: settings?.textWeight ?? 0.3,
                userId,
            },
            topK: settings?.topK ?? 5,
            confidenceThreshold: settings?.confidenceThreshold ?? 0.85,
            generatorModel: resolveGeneratorModel(settings?.generatorModel),
            auditorModel: settings?.auditorModel ?? 'claude-3-5-haiku-latest',
            temperature: settings?.temperature ?? 0.0,
            skipVerification: settings?.enableAuditor === false,
        };

        let ragResponse: Awaited<ReturnType<typeof executeRAG>> | null = null;
        let errorCode: string | undefined;
        let fallbackMessage = FALLBACK_RESPONSE_CS;

        if (shouldForceFallback()) {
            errorCode = 'CHAT_UPSTREAM_TRANSIENT';
            logInfo('Chat fallback forced by env', {
                route: '/api/chat',
                requestId,
                degraded: true,
                errorCode,
            });
        } else {
            for (let attempt = 1; attempt <= CHAT_MAX_ATTEMPTS; attempt += 1) {
                try {
                    ragResponse = await executeRAG(query, ragConfig);
                    break;
                } catch (ragError) {
                    const classified = classifyChatError(ragError);
                    errorCode = classified.code;
                    fallbackMessage = classified.userMessageCs;

                    logError(
                        'Chat RAG attempt failed',
                        {
                            route: '/api/chat',
                            requestId,
                            stage: classified.stage,
                            attempt,
                            errorCode: classified.code,
                            retryable: classified.retryable,
                        },
                        ragError,
                    );

                    const canRetry = attempt < CHAT_MAX_ATTEMPTS && classified.retryable;
                    if (canRetry) {
                        const jitterMs = Math.floor(Math.random() * (CHAT_RETRY_JITTER_MS + 1));
                        await sleep(CHAT_RETRY_BASE_DELAY_MS + jitterMs);
                        continue;
                    }

                    break;
                }
            }
        }

        if (!ragResponse) {
            const degradedResponse = {
                chatId: chatId!,
                response: fallbackMessage,
                sources: [] as Array<{
                    id: string;
                    chunkId: string;
                    documentId: string;
                    content: string;
                    pageNumber: number;
                    boundingBox: { x: number; y: number; width: number; height: number } | null;
                    highlightBoxes?: Array<{ x: number; y: number; width: number; height: number }> | null;
                    highlightText?: string | null;
                    parentHeader: string | null;
                    filename?: string;
                    originalFilename?: string | null;
                    relevanceScore: number;
                }>,
                verified: false,
                confidence: 0,
                stats: {
                    retrievalTimeMs: 0,
                    generationTimeMs: 0,
                    verificationTimeMs: 0,
                    totalTimeMs: 0,
                    chunksRetrieved: 0,
                    chunksUsed: 0,
                },
                degraded: true,
                errorCode: errorCode ?? 'CHAT_UNEXPECTED',
                requestId,
                engineMeta: {
                    engine: ragEngine,
                    mode: 'compat' as const,
                },
            };

            try {
                await db.insert(messages).values({
                    chatId: chatId!,
                    role: 'assistant',
                    content: degradedResponse.response,
                    sources: [],
                });
            } catch (storeError) {
                logError(
                    'Chat degraded message persistence failed',
                    {
                        route: '/api/chat',
                        requestId,
                        stage: 'database',
                        errorCode: degradedResponse.errorCode,
                        retryable: true,
                    },
                    storeError,
                );
            }

            logInfo('Chat response degraded', {
                route: '/api/chat',
                requestId,
                degraded: true,
                errorCode: degradedResponse.errorCode,
            });

            return withRequestId(apiSuccess(degradedResponse), requestId);
        }

        await db.insert(messages).values({
            chatId: chatId!,
            role: 'assistant',
            content: ragResponse.response,
            sources: ragResponse.sources.map((s) => ({
                id: s.citationId,
                documentId: s.documentId,
                pageNumber: s.pageNumber,
                title: s.originalFilename ?? s.filename,
                filename: s.filename,
                originalFilename: s.originalFilename ?? s.filename ?? null,
                boundingBox: s.boundingBox,
                highlightBoxes: s.highlightBoxes ?? (s.boundingBox ? [s.boundingBox] : null),
                highlightText: s.highlightText ?? null,
            })),
        });

        return withRequestId(apiSuccess({
            chatId,
            response: ragResponse.response,
            sources: ragResponse.sources.map((s) => ({
                id: s.citationId,
                chunkId: s.chunkId,
                documentId: s.documentId,
                content: s.content.slice(0, 200) + '...',
                pageNumber: s.pageNumber,
                boundingBox: s.boundingBox,
                highlightBoxes: s.highlightBoxes ?? (s.boundingBox ? [s.boundingBox] : null),
                highlightText: s.highlightText ?? null,
                parentHeader: s.parentHeader,
                filename: s.filename,
                originalFilename: s.originalFilename ?? s.filename ?? null,
                relevanceScore: s.relevanceScore,
            })),
            verified: ragResponse.verified,
            confidence: ragResponse.verification.confidence,
            stats: ragResponse.stats,
            interpretation: ragResponse.interpretation,
            ambiguities: ragResponse.ambiguities,
            engineMeta: ragResponse.engineMeta,
            degraded: false,
            requestId,
        }), requestId);
    } catch (error) {
        const classified = classifyChatError(error);
        logError(
            'Chat API error',
            {
                route: '/api/chat',
                requestId,
                stage: classified.stage,
                errorCode: classified.code,
                retryable: classified.retryable,
            },
            error,
        );

        return withRequestId(
            apiError(classified.code, classified.userMessageCs, classified.httpStatus, {
                requestId,
                retryable: classified.retryable,
                errorCode: classified.code,
                stage: classified.stage,
            }),
            requestId,
        );
    }
}

export async function GET(request: NextRequest) {
    const requestId = getRequestId(request);
    try {
        const auth = await requireUser(request);
        if (!auth.ok) return withRequestId(auth.response, requestId);
        const userId = auth.user.id;

        const { searchParams } = new URL(request.url);
        const chatId = searchParams.get('chatId');

        if (!chatId) {
            return withRequestId(apiError('CHAT_ID_REQUIRED', 'Missing chatId', 400), requestId);
        }

        const db = await import('@/lib/db').then((m) => m.db);
        const { messages, chats } = await import('@/lib/db/schema');
        const { eq, asc, and } = await import('drizzle-orm');

        const chat = await db
            .select({ id: chats.id })
            .from(chats)
            .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
            .limit(1);

        if (chat.length === 0) {
            return withRequestId(apiError('CHAT_NOT_FOUND', 'Chat not found or access denied', 404), requestId);
        }

        const chatMessages = await db
            .select()
            .from(messages)
            .where(eq(messages.chatId, chatId))
            .orderBy(asc(messages.createdAt));

        const typedMessages = chatMessages.map((msg) => {
            const normalizedSources: MessageSource[] | null = Array.isArray(msg.sources)
                ? msg.sources.map((source) => ({
                    ...source,
                    filename: source.filename ?? source.title ?? null,
                    originalFilename: source.originalFilename ?? source.filename ?? source.title ?? null,
                    highlightBoxes: source.highlightBoxes
                        ?? (source.boundingBox ? [source.boundingBox] : null),
                }))
                : null;

            return {
                ...msg,
                sources: normalizedSources,
            };
        });

        return withRequestId(apiSuccess({ messages: typedMessages }), requestId);
    } catch (error) {
        logError('Chat GET error', { route: '/api/chat', requestId }, error);
        return withRequestId(apiError('CHAT_FETCH_FAILED', 'Failed to fetch messages', 500), requestId);
    }
}
