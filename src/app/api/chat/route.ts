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
import { getRequestId, logError } from '@/lib/logger';
import type { MessageSource } from '@/lib/db/schema';
import { apiError, apiSuccess } from '@/lib/api/response';
import { isRagV2KillSwitchEnabled } from '@/lib/rag-v2/flags';
import type { AmbiguityPolicy, ContextScope } from '@/lib/rag-v2/types';

const DEFAULT_GENERATOR_MODEL = 'gemini-2.5-flash';
const DEFAULT_RAG_ENGINE: RAGEngineId = 'v1';
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
    try {
        const auth = await requireUser(request);
        if (!auth.ok) return auth.response;
        const userId = auth.user.id;

        const body = await request.json();
        const parsed = ChatRequestSchema.safeParse(body);

        if (!parsed.success) {
            return apiError('CHAT_INVALID_REQUEST', 'Invalid request', 400, parsed.error.issues);
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
                return apiError('CHAT_NOT_FOUND', 'Chat not found or access denied', 404);
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

        const ragResponse = await executeRAG(query, ragConfig);

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
            })),
        });

        return apiSuccess({
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
        });
    } catch (error) {
        const requestId = getRequestId(request);
        logError('Chat API error', { route: '/api/chat', requestId }, error);

        return apiError('CHAT_INTERNAL_ERROR', 'Internal server error', 500);
    }
}

export async function GET(request: NextRequest) {
    try {
        const auth = await requireUser(request);
        if (!auth.ok) return auth.response;
        const userId = auth.user.id;

        const { searchParams } = new URL(request.url);
        const chatId = searchParams.get('chatId');

        if (!chatId) {
            return apiError('CHAT_ID_REQUIRED', 'Missing chatId', 400);
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
            return apiError('CHAT_NOT_FOUND', 'Chat not found or access denied', 404);
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

        return apiSuccess({ messages: typedMessages });
    } catch (error) {
        const requestId = getRequestId(request);
        logError('Chat GET error', { route: '/api/chat', requestId }, error);
        return apiError('CHAT_FETCH_FAILED', 'Failed to fetch messages', 500);
    }
}
