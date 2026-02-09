import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { sql, eq } from 'drizzle-orm';
import * as fs from 'fs';

const logFile = 'repair_log.txt';
fs.writeFileSync(logFile, '--- Repair Log ---\n');

function log(msg: string) {
    console.log(msg);
    fs.appendFileSync(logFile, msg + '\n');
}


export { };

async function main() {
    log("Starting DB Repair...");
    const { db } = await import('./src/lib/db');
    const { chunks } = await import('./src/lib/db/schema');
    const { embedTexts } = await import('./src/lib/ingest/embedder');

    // 1. Clear existing embeddings
    log("Clearing old embeddings...");
    await db.execute(sql`UPDATE chunks SET embedding = NULL`);

    // 2. Alter column type (SKIPPED - staying with 768)
    /*
    log("Altering column type to vector(3072)...");
    try {
        await db.execute(sql`ALTER TABLE chunks ALTER COLUMN embedding TYPE vector(3072)`);
        log("Column type altered successfully.");
    } catch (e) {
        log(`Failed to alter column type (maybe already 3072?): ${e}`);
    }
    */

    // 3. Fetch all chunks
    log("Fetching chunks for re-embedding...");
    const allChunks = await db.select().from(chunks);
    log(`Found ${allChunks.length} chunks.`);

    if (allChunks.length === 0) {
        log("No chunks to re-embed.");
        process.exit(0);
    }

    // 4. Re-embed in batches
    const texts = allChunks.map(c => c.content);
    log("Generating embeddings...");

    try {
        const result = await embedTexts(texts);
        log(`Generated ${result.embeddings.length} embeddings.`);

        // 5. Update chunks
        log("Updating database records...");
        let updatedCount = 0;

        for (let i = 0; i < allChunks.length; i++) {
            const chunk = allChunks[i];
            const embedding = result.embeddings.find(e => e.index === i)?.embedding;

            if (embedding) {
                if (embedding.length !== 768) {
                    log(`⚠️ Embedding length mismatch for chunk ${chunk.id}: ${embedding.length}`);
                }

                try {
                    await db.update(chunks)
                        .set({ embedding: embedding })
                        .where(eq(chunks.id, chunk.id));
                    updatedCount++;
                } catch (updateError) {
                    log(`❌ Update failed for chunk ${chunk.id}: ${updateError}`);
                }

                if (updatedCount % 10 === 0) process.stdout.write('.');
            } else {
                log(`Missing embedding for chunk index ${i}`);
            }
        }
        log(`\nUpdated ${updatedCount} chunks.`);

    } catch (e) {
        log(`Embedding generation failed: ${e}`);
    }

    log("Repair complete.");
    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    log(`Fatal error: ${err}`);
});
