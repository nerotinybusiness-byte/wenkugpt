import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { chats } from '@/lib/db/schema';
import { and, desc, eq, lt } from 'drizzle-orm';
import { requireUser } from '@/lib/auth/request-auth';
import { apiError, apiSuccess } from '@/lib/api/response';

export async function GET(request: NextRequest) {
    try {
        const auth = await requireUser(request);
        if (!auth.ok) return auth.response;
        const userId = auth.user.id;

        const { searchParams } = new URL(request.url);
        const limitParam = searchParams.get('limit');
        const cursor = searchParams.get('cursor');
        const limit = Math.min(Math.max(Number(limitParam) || 20, 1), 100);

        const whereClause = (() => {
            if (!cursor) return eq(chats.userId, userId);
            const cursorDate = new Date(cursor);
            if (Number.isNaN(cursorDate.getTime())) return eq(chats.userId, userId);
            return and(eq(chats.userId, userId), lt(chats.updatedAt, cursorDate));
        })();

        const query = db
            .select({
                id: chats.id,
                title: chats.title,
                createdAt: chats.createdAt,
                updatedAt: chats.updatedAt,
            })
            .from(chats)
            .where(whereClause)
            .orderBy(desc(chats.updatedAt))
            .limit(limit + 1);

        const rows = await query;
        const hasNextPage = rows.length > limit;
        const items = hasNextPage ? rows.slice(0, limit) : rows;

        return apiSuccess({
            history: items.map((c) => ({
                id: c.id,
                title: c.title,
                createdAt: c.createdAt,
                updatedAt: c.updatedAt,
            })),
            nextCursor: hasNextPage ? items[items.length - 1].updatedAt : null,
        });

    } catch (error) {
        console.error('History API Error:', error);
        return apiError('HISTORY_FETCH_FAILED', 'Failed to fetch history', 500);
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const auth = await requireUser(request);
        if (!auth.ok) return auth.response;
        const userId = auth.user.id;

        // Delete all chats for this user
        await db.delete(chats).where(eq(chats.userId, userId));

        return apiSuccess({ cleared: true });

    } catch (error) {
        console.error('Clear History Error:', error);
        return apiError('HISTORY_CLEAR_FAILED', 'Failed to clear history', 500);
    }
}
