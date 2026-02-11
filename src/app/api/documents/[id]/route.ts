import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { documents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth/request-auth';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getRequestId, logError } from '@/lib/logger';
import { z } from 'zod';

const UpdateDocumentFolderSchema = z.object({
    folderName: z.union([z.string(), z.null()]),
});

function normalizeFolderName(folderName: string | null): string | null {
    if (folderName === null) return null;
    const trimmed = folderName.trim();
    if (trimmed.length === 0) return null;
    return trimmed;
}

export async function PATCH(
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

        const body = await request.json().catch(() => null);
        const validated = UpdateDocumentFolderSchema.safeParse(body);
        if (!validated.success) {
            return apiError('DOCUMENT_UPDATE_INVALID_PAYLOAD', 'Invalid payload. Expected { folderName: string | null }.', 400);
        }

        const nextFolderName = normalizeFolderName(validated.data.folderName);
        if (nextFolderName !== null && nextFolderName.length > 128) {
            return apiError('DOCUMENT_FOLDER_INVALID', 'Folder name must be 1-128 characters when provided.', 400);
        }

        const updated = await db.update(documents)
            .set({
                folderName: nextFolderName,
                updatedAt: new Date(),
            })
            .where(eq(documents.id, id))
            .returning({
                id: documents.id,
                folderName: documents.folderName,
            });

        if (updated.length === 0) {
            return apiError('DOCUMENT_NOT_FOUND', 'Document not found', 404);
        }

        return apiSuccess({
            message: 'Document folder updated successfully',
            id: updated[0].id,
            folderName: updated[0].folderName,
        });

    } catch (error) {
        const requestId = getRequestId(request);
        logError('Document PATCH error', { route: '/api/documents/[id]', requestId }, error);
        return apiError('DOCUMENT_UPDATE_FAILED', 'Failed to update document', 500);
    }
}

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
