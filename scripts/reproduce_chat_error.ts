
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });


async function main() {
    console.log('--- Reproduction Script Start ---');
    // Dynamic import to ensure env vars are loaded first
    const { db } = await import('./src/lib/db');
    const { users, chats } = await import('./src/lib/db/schema');

    try {
        console.log('1. Fetching user...');
        const allUsers = await db.select().from(users).limit(1);

        if (allUsers.length === 0) {
            console.error('No users found!');
            process.exit(1);
        }

        const user = allUsers[0];
        console.log(`Found user: ${user.id} (${user.email})`);

        console.log('2. Attempting to insert chat...');
        try {
            const [newChat] = await db.insert(chats).values({
                userId: user.id,
                title: 'Test Chat from Script',
            }).returning();
            console.log(`Success! Chat created: ${newChat.id}`);
        } catch (insertError) {
            console.error('INSERT FAILED!');
            console.error(insertError);
        }

    } catch (e) {
        console.error('General Error:', e);
    }
    console.log('--- Reproduction Script End ---');
    process.exit(0);
}

main();
