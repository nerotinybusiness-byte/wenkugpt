import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { documents, chunks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth/request-auth';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getRequestId, logError } from '@/lib/logger';

export async function GET(request: NextRequest) {
    if (process.env.NODE_ENV === 'production') {
        return apiError('DEBUG_DISABLED_IN_PRODUCTION', 'Not found', 404);
    }

    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    try {
        const docs = await db.select().from(documents).limit(20);

        const results = await Promise.all(docs.map(async (doc) => {
            const docChunks = await db
                .select({ content: chunks.content })
                .from(chunks)
                .where(eq(chunks.documentId, doc.id))
                .limit(1);

            return {
                id: doc.id,
                filename: doc.filename,
                processingStatus: doc.processingStatus,
                chunkCount: docChunks.length,
                firstChunk: docChunks[0]?.content.slice(0, 50) || null,
            };
        }));

        return apiSuccess({ documents: results });
    } catch (error) {
        const requestId = getRequestId(request);
        logError('Debug GET error', { route: '/api/debug', requestId }, error);
        return apiError('DEBUG_ENDPOINT_FAILED', 'Debug endpoint failed', 500);
    }
}
