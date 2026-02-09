
export { };
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
// Dynamic imports required for dotenv to load before DB connection
import { desc, gt, sql, ilike, eq } from 'drizzle-orm';
import * as fs from 'fs';

const logFile = 'retrieval_output.txt';
fs.writeFileSync(logFile, '--- Retrieval Debug Log ---\n');

function log(msg: string) {
    console.log(msg);
    fs.appendFileSync(logFile, msg + '\n');
}

async function main() {
    log("Loading modules...");
    const { db } = await import('./src/lib/db');
    const { chunks, documents } = await import('./src/lib/db/schema');
    const { embedTexts } = await import('./src/lib/ingest/embedder');

    const query = "kdo je boss";
    log(`\n🔍 Debugging Retrieval for: "${query}"\n`);

    // 1. Check Full-Text / Keyword Search
    log("--- Keyword Search (ilike '%boss%') ---");
    const keywordMatches = await db.select({
        content: chunks.content,
        id: chunks.id,
        filename: documents.filename
    })
        .from(chunks)
        .innerJoin(documents, eq(chunks.documentId, documents.id))
        .where(ilike(chunks.content, '%boss%'))
        .limit(5);

    if (keywordMatches.length === 0) {
        log("❌ No keyword matches found for 'boss'.");
    } else {
        keywordMatches.forEach(m => log(`✅ MATCH (${m.filename}): ${m.content}`));
    }

    // 2. Check Vector Search
    log("\n--- Vector Search ---");
    try {
        const embeddingResult = await embedTexts([query]); // result is BatchEmbeddingResult
        const queryVector = embeddingResult.embeddings[0].embedding; // Extract vector

        const similarity = sql<number>`1 - (${chunks.embedding} <=> ${JSON.stringify(queryVector)})`;

        const vectorMatches = await db.select({
            content: chunks.content,
            similarity: similarity,
            filename: documents.filename
        })
            .from(chunks)
            .innerJoin(documents, eq(chunks.documentId, documents.id))
            .where(gt(similarity, 0.5)) // Threshold 0.5
            .orderBy(desc(similarity))
            .limit(3);

        if (vectorMatches.length === 0) {
            log("❌ No high-similarity vector matches found (>0.5).");

            // Show top 1 regardless of threshold
            const top1 = await db.select({
                content: chunks.content,
                similarity: similarity,
                filename: documents.filename
            })
                .from(chunks)
                .innerJoin(documents, eq(chunks.documentId, documents.id))
                .orderBy(desc(similarity))
                .limit(1);

            if (top1.length > 0) {
                log(`   Top 1 match (Similarity ${top1[0].similarity.toFixed(4)}): [${top1[0].filename}] "${top1[0].content.slice(0, 100).replace(/\n/g, ' ')}..."`);
            } else {
                log("   Database is empty or no chunks found.");
            }

        } else {
            vectorMatches.forEach(m => {
                log(`✅ MATCH (${m.similarity.toFixed(4)}) [${m.filename}]: ${m.content.slice(0, 100).replace(/\n/g, ' ')}...`);
            });
        }

    } catch (e) {
        console.error("Vector search failed:", e);
        log(`Vector search failed: ${e}`);
    }

    process.exit(0);
}

main().catch(console.error);
