import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { chunks } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth/request-auth';
import { apiError, apiSuccess } from '@/lib/api/response';

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireAdmin(request);
        if (!auth.ok) return auth.response;

        const { id } = await context.params;

        if (!id) {
            return apiError('DOCUMENT_ID_REQUIRED', 'Document ID is required', 400);
        }

        // Fetch all chunks for the document, ordered by index
        const documentChunks = await db.select({
            content: chunks.content,
            pageNumber: chunks.pageNumber
        })
            .from(chunks)
            .where(eq(chunks.documentId, id))
            .orderBy(asc(chunks.chunkIndex));

        if (documentChunks.length === 0) {
            return apiError('DOCUMENT_PREVIEW_NOT_FOUND', 'No content found for this document', 404);
        }

        // Combine chunks into a single text
        // (Simple joining for now, could be smarter about pages)
        const fullText = documentChunks
            .map(chunk => `[Page ${chunk.pageNumber}]\n${chunk.content}`)
            .join('\n\n-------------------\n\n');

        return apiSuccess({
            content: fullText
        });

    } catch (error) {
        console.error('Error fetching document preview:', error);
        return apiError('DOCUMENT_PREVIEW_FAILED', 'Failed to fetch document preview', 500);
    }
}
