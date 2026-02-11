import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { chunks, documents } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth/request-auth';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getRequestId, logError } from '@/lib/logger';

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

        const [document] = await db.select({
            id: documents.id,
            processingStatus: documents.processingStatus,
            processingError: documents.processingError,
        })
            .from(documents)
            .where(eq(documents.id, id))
            .limit(1);

        if (!document) {
            return apiError('DOCUMENT_NOT_FOUND', 'Document not found', 404);
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
            if (document.processingStatus === 'failed') {
                return apiError(
                    'DOCUMENT_PREVIEW_EMPTY',
                    document.processingError || 'No extractable text found for this document. Re-upload with OCR or TXT content.',
                    409,
                );
            }
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
        const requestId = getRequestId(request);
        logError('Document preview GET error', { route: '/api/documents/[id]/preview', requestId }, error);
        return apiError('DOCUMENT_PREVIEW_FAILED', 'Failed to fetch document preview', 500);
    }
}
