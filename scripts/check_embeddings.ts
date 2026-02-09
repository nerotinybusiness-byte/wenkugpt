
export { };
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { isNull, sql, count } from 'drizzle-orm';
import * as fs from 'fs';

const logFile = 'embeddings_log.txt';
fs.writeFileSync(logFile, '--- Embeddings Check Log ---\n');

function log(msg: string) {
    console.log(msg);
    fs.appendFileSync(logFile, msg + '\n');
}

async function main() {
    log("Checking embeddings...");
    try {
        const { db } = await import('./src/lib/db');
        const { chunks } = await import('./src/lib/db/schema');

        // Count chunks with NULL embedding
        const nullEmbeddings = await db.select({ count: count() })
            .from(chunks)
            .where(isNull(chunks.embedding));

        log(`Chunks with NULL embedding: ${nullEmbeddings[0].count}`);

        // Count total chunks
        const totalChunks = await db.select({ count: count() }).from(chunks);
        log(`Total chunks: ${totalChunks[0].count}`);

        if (totalChunks[0].count > 0) {
            // Check first non-null embedding length to verify it looks like a vector
            const sample = await db.select({ embedding: chunks.embedding })
                .from(chunks)
                .limit(1);

            if (sample.length > 0) {
                log(`Sample embedding: ${sample[0].embedding ? 'Present (Array)' : 'NULL'}`);
                if (sample[0].embedding) {
                    log(`Sample embedding length: ${sample[0].embedding.length}`);
                    log(`Sample embedding first 3 values: ${sample[0].embedding.slice(0, 3)}`);
                    if (sample[0].embedding.length !== 3072) {
                        log(`⚠️ WARNING: Expected 3072, got ${sample[0].embedding.length}`);
                    }
                }
            }
        }
    } catch (e) {
        log(`Error: ${e}`);
    }

    process.exit(0);
}

main().catch(console.error);
