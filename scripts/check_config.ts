
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function checkConfig() {
    try {
        const { db } = await import('./src/lib/db');
        const { config } = await import('./src/lib/db/schema');
        const { eq } = await import('drizzle-orm');

        const userId = '00000000-0000-0000-0000-000000000001';
        const userConfig = await db.select().from(config).where(eq(config.userId, userId));

        console.log('User Config:', JSON.stringify(userConfig, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkConfig();
