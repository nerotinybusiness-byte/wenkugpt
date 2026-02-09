
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { sql } from 'drizzle-orm';

export { };

async function main() {
    const { db } = await import('./src/lib/db');
    try {
        const result = await db.execute(sql`SELECT extversion FROM pg_extension WHERE extname = 'vector'`);
        // @ts-ignore
        console.log("pgvector version:", result[0]?.extversion);
    } catch (e) {
        console.error("Failed to check pgvector version:", e);
    }
    process.exit(0);
}

main();
