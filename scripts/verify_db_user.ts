
import { db } from './src/lib/db';
import { users } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function checkUser() {
    try {
        const userId = '00000000-0000-0000-0000-000000000001';
        console.log(`Checking for user: ${userId}`);
        const user = await db.select().from(users).where(eq(users.id, userId));

        if (user.length > 0) {
            console.log('User FOUND:', user[0]);
        } else {
            console.log('User NOT FOUND');
            // Check if any users exist
            const allUsers = await db.select().from(users).limit(5);
            console.log('Total users found:', allUsers.length);
            if (allUsers.length > 0) {
                console.log('Sample user:', allUsers[0]);
            }
        }
        process.exit(0);
    } catch (e) {
        console.error('Error checking user:', e);
        process.exit(1);
    }
}

checkUser();
