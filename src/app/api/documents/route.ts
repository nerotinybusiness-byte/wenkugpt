import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { documents } from '@/lib/db/schema';
import { desc, lt } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth/request-auth';
import { apiError, apiSuccess } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const auth = await requireAdmin(request);
        if (!auth.ok) return auth.response;

        const { searchParams } = new URL(request.url);
        const limitParam = searchParams.get('limit');
        const cursor = searchParams.get('cursor');

        const limit = Math.min(Math.max(Number(limitParam) || 50, 1), 200);

        const baseQuery = db
            .select()
            .from(documents)
            .orderBy(desc(documents.createdAt));

        let docs;
        if (cursor) {
            const cursorDate = new Date(cursor);
            docs = Number.isNaN(cursorDate.getTime())
                ? await baseQuery.limit(limit + 1)
                : await baseQuery.where(lt(documents.createdAt, cursorDate)).limit(limit + 1);
        } else {
            docs = await baseQuery.limit(limit + 1);
        }

        const hasNextPage = docs.length > limit;
        const items = hasNextPage ? docs.slice(0, limit) : docs;

        return apiSuccess({
            documents: items.map(doc => ({
                id: doc.id,
                filename: doc.filename,
                fileSize: doc.fileSize,
                pageCount: doc.pageCount,
                processingStatus: doc.processingStatus,
                createdAt: doc.createdAt,
            })),
            nextCursor: hasNextPage ? items[items.length - 1].createdAt : null,
        });
    } catch (error) {
        console.error('Error fetching documents:', error);
        return apiError('DOCUMENTS_FETCH_FAILED', 'Failed to fetch documents', 500);
    }
}
