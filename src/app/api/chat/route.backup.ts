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

        const { query, settings } = parsed.data;

        console.log(`\n💬 Chat API: "${query.slice(0, 50)}..."`);
        if (settings) {
            console.log(`   ⚙️ Custom settings: ${JSON.stringify(settings)}`);
        }

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

        // Return full response as JSON
        return new Response(
            JSON.stringify({
                success: true,
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
                response: 'Omlouvám se, nastala chyba při zpracování dotazu.',
                sources: [],
                verified: false,
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
