import * as dotenv from 'dotenv';
import path from 'path';

// MUST load env before importing db because imports are hoisted
const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

async function verifyFix() {
    console.log('Verifying chat history fix...');

    // Dynamic import to ensure env is loaded first
    const { db } = await import('./src/lib/db');
    const { messages, chats, users } = await import('./src/lib/db/schema');
    const { eq } = await import('drizzle-orm');

    // 1. Get a user or create one
    const allUsers = await db.select().from(users).limit(1);
    if (allUsers.length === 0) {
        console.error('No users found. Run seed_user.ts first.');
        return;
    }
    const userId = allUsers[0].id;

    // 2. Create a dummy chat
    const [chat] = await db.insert(chats).values({
        userId,
        title: 'Verification Chat',
    }).returning();

    console.log(`Created test chat: ${chat.id}`);

    // 3. Insert a "broken" message (missing filename, has title)
    const brokenSource = {
        id: '1',
        chunkId: '123',
        pageNumber: 1,
        title: 'legacy-document.pdf',
        // filename is MISSING
    };

    await db.insert(messages).values({
        chatId: chat.id,
        role: 'assistant',
        content: 'This is a legacy message.',
        sources: [brokenSource],
    });

    console.log('Inserted legacy message with missing filename.');

    // 4. Simulate GET request logic (we can't call the API route directly easily, so we replicate the transformation logic)
    // In reality, we want to know if the GET route *would* return the correct data.
    // Since I modified the GET route code directly, I can't "call" it from here without running the server.
    // BUT, I can run `curl` or `fetch` against the running dev server!

    // Let's use fetch against localhost:3000
    try {
        const response = await fetch(`http://localhost:3000/api/chat?chatId=${chat.id}`);
        const data = await response.json();

        if (!data.messages) {
            console.error('Failed to fetch messages:', data);
            return;
        }

        const msg = data.messages.find((m: any) => m.role === 'assistant');
        const source = msg.sources[0];

        console.log('Fetched source:', source);

        if (source.filename === 'legacy-document.pdf') {
            console.log('✅ SUCCESS: filename was correctly mapped from title!');
        } else {
            console.error('❌ FAILURE: filename is missing or incorrect.');
        }

    } catch (e) {
        console.error('Failed to call API:', e);
    }

    // Cleanup
    await db.delete(chats).where(eq(chats.id, chat.id));
    console.log('Cleaned up test chat.');
}

verifyFix().catch(console.error);
