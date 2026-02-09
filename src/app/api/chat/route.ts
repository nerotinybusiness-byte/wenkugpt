/**
 * WENKUGPT - Chat API Route
 *
 * POST /api/chat
 * GET  /api/chat?chatId=...
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { executeRAG, type RAGConfig } from '@/lib/ai/agents';
import { requireUser } from '@/lib/auth/request-auth';
import { logError } from '@/lib/logger';
import type { MessageSource } from '@/lib/db/schema';
import { apiError, apiSuccess } from '@/lib/api/response';

const ChatRequestSchema = z.object({
    query: z.string().min(1).max(2000),
    settings: z.object({
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

        const ragConfig: Partial<RAGConfig> = {
            search: {
                limit: settings?.searchLimit ?? 20,
                minScore: settings?.minScore ?? 0.3,
                vectorWeight: settings?.vectorWeight ?? 0.7,
                textWeight: settings?.textWeight ?? 0.3,
            },
            topK: settings?.topK ?? 5,
            confidenceThreshold: settings?.confidenceThreshold ?? 0.85,
            generatorModel: settings?.generatorModel ?? 'gemini-2.0-flash',
            auditorModel: settings?.auditorModel ?? 'claude-3-5-haiku-latest',
            temperature: settings?.temperature ?? 0.0,
            skipVerification: settings?.enableAuditor === false,
        };

        const ragResponse = await executeRAG(query, ragConfig as RAGConfig);

        await db.insert(messages).values({
            chatId: chatId!,
            role: 'assistant',
            content: ragResponse.response,
            sources: ragResponse.sources.map((s) => ({
                id: s.citationId,
                documentId: s.documentId,
                pageNumber: s.pageNumber,
                title: s.filename,
                filename: s.filename,
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
                parentHeader: s.parentHeader,
                filename: s.filename,
                relevanceScore: s.relevanceScore,
            })),
            verified: ragResponse.verified,
            confidence: ragResponse.verification.confidence,
            stats: ragResponse.stats,
        });
    } catch (error) {
        const requestId = request.headers.get('X-Request-ID') ?? undefined;
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
                }))
                : null;

            return {
                ...msg,
                sources: normalizedSources,
            };
        });

        return apiSuccess({ messages: typedMessages });
    } catch (error) {
        console.error('Chat GET Error:', error);
        return apiError('CHAT_FETCH_FAILED', 'Failed to fetch messages', 500);
    }
}
