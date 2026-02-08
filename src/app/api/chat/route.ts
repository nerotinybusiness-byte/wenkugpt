/**
 * WENKUGPT - Chat API Route (Streaming)
 * 
 * POST /api/chat
 * Streams RAG responses with citations using dynamic settings
 */

import { NextRequest } from 'next/server';
import { executeRAG, type RAGConfig, type RAGResponse } from '@/lib/ai/agents';
import { z } from 'zod';

/**
 * Request validation
 */
const ChatRequestSchema = z.object({
    query: z.string().min(1).max(2000),
    // Settings from client (Cockpit)
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
    chatId: z.string().uuid().nullish(), // Allow null or undefined
});

/**
 * Stream a RAG response
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const parsed = ChatRequestSchema.safeParse(body);

        if (!parsed.success) {
            return new Response(
                JSON.stringify({ error: 'Invalid request', details: parsed.error.issues }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const { query, settings, chatId: requestedChatId } = parsed.data;

        console.log(`\n💬 Chat API: "${query.slice(0, 50)}..."`);
        console.log(`   🆔 Chat ID: ${requestedChatId || 'New Session'}`);
        if (settings) {
            console.log(`   ⚙️ Custom settings: ${JSON.stringify(settings)}`);
        }

        // 1. Resolve User (In a real app, get from session. Here we mock or get single user)
        // For simplicity in this demo, we'll fetch the first user or create a placeholder if needed.
        // real implementation would use: const session = await auth(); const userId = session.user.id;

        // Mock User Resolution for "Single User Mode"
        const db = await import('@/lib/db').then(m => m.db);
        const { users, chats, messages } = await import('@/lib/db/schema');
        const { eq } = await import('drizzle-orm');

        let userId: string;
        const allUsers = await db.select().from(users).limit(1);
        if (allUsers.length > 0) {
            userId = allUsers[0].id;
        } else {
            // Fallback: This shouldn't happen if seeded, but robust.
            // We can't easily create a user here without more context, so we'll error if no user exists
            throw new Error("No users found in database. Please seed the database first.");
        }

        // 2. Resolve or Create Chat Session
        let chatId = requestedChatId;
        let isNewChat = false;

        if (!chatId) {
            // Create new chat
            const [newChat] = await db.insert(chats).values({
                userId,
                title: query.slice(0, 50), // Initial title from first message
            }).returning();
            chatId = newChat.id;
            isNewChat = true;
            console.log(`   🆕 Created new chat: ${chatId}`);
        } else {
            // Verify chat exists
            const existing = await db.select().from(chats).where(eq(chats.id, chatId));
            if (existing.length === 0) {
                // Client sent invalid ID, treat as new
                const [newChat] = await db.insert(chats).values({
                    userId,
                    title: query.slice(0, 50),
                }).returning();
                chatId = newChat.id;
                isNewChat = true;
                console.log(`   ⚠️ Invalid Chat ID, created new: ${chatId}`);
            }
        }

        // 3. Save USER message
        await db.insert(messages).values({
            chatId: chatId!,
            role: 'user',
            content: query,
        });

        // Build RAG config from client settings
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

        // Execute RAG pipeline with custom config
        const ragResponse = await executeRAG(query, ragConfig as RAGConfig);

        // 4. Save ASSISTANT message
        await db.insert(messages).values({
            chatId: chatId!,
            role: 'assistant',
            content: ragResponse.response,
            sources: ragResponse.sources.map(s => ({
                id: s.citationId,
                documentId: s.documentId,
                pageNumber: s.pageNumber,
                title: s.filename, // Store filename as title/description
                filename: s.filename // Store filename explicitly for citation clicks
            })),

        });

        return new Response(
            JSON.stringify({
                success: true,
                chatId: chatId, // Return the active Chat ID
                response: ragResponse.response,
                sources: ragResponse.sources.map(s => ({
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
            }),
            {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            }
        );

    } catch (error) {
        console.error('❌ Chat API error:', error);

        // Log to file for debugging
        const fs = await import('fs/promises');
        const timestamp = new Date().toISOString();
        const errorLog = `\n[${timestamp}] ${error instanceof Error ? error.stack : String(error)}\n`;
        await fs.appendFile('chat-error.log', errorLog);

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        return new Response(
            JSON.stringify({
                success: false,
                error: errorMessage,
                details: error instanceof Error ? error.stack : String(error), // Send details to frontend
                response: 'Omlouvám se, nastala chyba při zpracování dotazu. (Quota Exceeded / API Error)',
                sources: [],
                verified: false,
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}

/**
 * GET: Fetch messages for a specific chat
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const chatId = searchParams.get('chatId');

        if (!chatId) {
            return new Response(JSON.stringify({ error: 'Missing chatId' }), { status: 400 });
        }

        const db = await import('@/lib/db').then(m => m.db);
        const { messages } = await import('@/lib/db/schema');
        const { eq, asc } = await import('drizzle-orm');

        const chatMessages = await db
            .select()
            .from(messages)
            .where(eq(messages.chatId, chatId))
            .orderBy(asc(messages.createdAt));

        // Map 'title' to 'filename' for legacy messages if filename is missing
        const typedMessages: any[] = chatMessages.map((msg: any) => {
            if (msg.sources && Array.isArray(msg.sources)) {
                msg.sources = msg.sources.map((source: any) => ({
                    ...source,
                    filename: source.filename || source.title
                }));
            }
            return msg;
        });

        return new Response(JSON.stringify({ messages: typedMessages }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Chat GET Error:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch messages' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
