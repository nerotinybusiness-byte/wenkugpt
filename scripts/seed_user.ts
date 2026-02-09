
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function seed() {
    // Dynamic import to ensure env vars are loaded first
    const { db } = await import('./src/lib/db');
    const { users } = await import('./src/lib/db/schema');
    const { eq } = await import('drizzle-orm');

    try {
        const userId = '00000000-0000-0000-0000-000000000001';
        console.log(`Checking for user: ${userId}`);
        const user = await db.select().from(users).where(eq(users.id, userId));

        if (user.length > 0) {
            console.log('User already exists.');
        } else {
            console.log('User NOT FOUND. Creating...');
            await db.insert(users).values({
                id: userId,
                email: 'demo@wenkugpt.com',
                name: 'Demo User',
                role: 'admin',
                dailyPromptCount: 0
            });
            console.log('User created successfully.');
        }
        process.exit(0);
    } catch (e) {
        console.error('Error seeding user:', e);
        process.exit(1);
    }
}

seed();
