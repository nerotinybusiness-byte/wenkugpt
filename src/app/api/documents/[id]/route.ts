import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { documents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth/request-auth';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getRequestId, logError } from '@/lib/logger';

export async function DELETE(
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

        // Delete from database (cascade handles related chunks)
        const deleted = await db.delete(documents)
            .where(eq(documents.id, id))
            .returning({ id: documents.id });

        if (deleted.length === 0) {
            return apiError('DOCUMENT_NOT_FOUND', 'Document not found', 404);
        }

        return apiSuccess({
            message: 'Document deleted successfully',
            id: deleted[0].id
        });

    } catch (error) {
        const requestId = getRequestId(request);
        logError('Document DELETE error', { route: '/api/documents/[id]', requestId }, error);
        return apiError('DOCUMENT_DELETE_FAILED', 'Failed to delete document', 500);
    }
}
