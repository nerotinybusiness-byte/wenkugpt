
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { db } from './src/lib/db';
import { chunks } from './src/lib/db/schema';
import { count } from 'drizzle-orm';

async function main() {
    console.log("--- Debug Simple DB ---");
    try {
        const res = await db.select({ count: count() }).from(chunks);
        console.log("Chunk count:", res[0].count);

        const firstChunk = await db.select().from(chunks).limit(1);
        if (firstChunk.length > 0) {
            console.log("First chunk ID:", firstChunk[0].id);
            console.log("First chunk content length:", firstChunk[0].content.length);
        } else {
            console.log("No chunks found.");
        }
    } catch (e) {
        console.error("DB Error:", e);
    }
    process.exit(0);
}

main().catch(console.error);
