import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { chats, users } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
    try {
        // Mock User Resolution (Single User Mode)
        // In real app: const session = await auth(); const userId = session.user.id;
        const allUsers = await db.select().from(users).limit(1);

        if (allUsers.length === 0) {
            return new Response(JSON.stringify({ history: [] }), { status: 200 });
        }

        const userId = allUsers[0].id;

        // Fetch chats for user, sorted by newest first
        const userChats = await db
            .select({
                id: chats.id,
                title: chats.title,
                createdAt: chats.createdAt,
            })
            .from(chats)
            .where(eq(chats.userId, userId))
            .orderBy(desc(chats.updatedAt));

        return new Response(JSON.stringify({ history: userChats }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('History API Error:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch history' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        // Mock User Resolution
        const allUsers = await db.select().from(users).limit(1);
        if (allUsers.length === 0) {
            return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
        }
        const userId = allUsers[0].id;

        // Delete all chats for this user
        await db.delete(chats).where(eq(chats.userId, userId));

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Clear History Error:', error);
        return new Response(JSON.stringify({ error: 'Failed to clear history' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
