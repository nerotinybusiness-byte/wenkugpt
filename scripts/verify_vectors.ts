
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { sql } from 'drizzle-orm';
import { db } from './src/lib/db';
import { chunks } from './src/lib/db/schema';


export { };

async function main() {
    const allChunks = await db.select({
        id: chunks.id,
        embedding: chunks.embedding
    }).from(chunks);

    let zeroCount = 0;
    let validCount = 0;
    let nullCount = 0;

    for (const chunk of allChunks) {
        if (!chunk.embedding) {
            nullCount++;
            continue;
        }
        const isZero = chunk.embedding.every(v => v === 0);
        if (isZero) {
            zeroCount++;
        } else {
            validCount++;
        }
    }

    console.log(`Total: ${allChunks.length}`);
    console.log(`Valid: ${validCount}`);
    console.log(`Zero: ${zeroCount}`);
    console.log(`Null: ${nullCount}`);
    process.exit(0);
}

main();
