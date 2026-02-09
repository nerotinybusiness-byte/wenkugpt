
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { sql } from 'drizzle-orm';

export { };

type PgExtensionRow = {
    extversion?: string;
};

async function main() {
    const { db } = await import('./src/lib/db');
    try {
        const result = await db.execute(sql`SELECT extversion FROM pg_extension WHERE extname = 'vector'`);
        const rows = Array.isArray(result) ? result : result.rows;
        const firstRow = rows[0] as PgExtensionRow | undefined;
        console.log("pgvector version:", firstRow?.extversion ?? 'not installed');
    } catch (e) {
        console.error("Failed to check pgvector version:", e);
    }
    process.exit(0);
}

main();
