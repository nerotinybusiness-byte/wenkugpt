
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
    console.log("Checking RAG Data...");
    const { db } = await import('./src/lib/db');
    const { documents, chunks } = await import('./src/lib/db/schema');
    const { count, eq } = await import('drizzle-orm');

    // 1. Count Documents
    const docs = await db.select().from(documents);
    console.log(`Found ${docs.length} documents.`);

    if (docs.length > 0) {
        console.log(`\nFound ${docs.length} documents.`);

        for (const doc of docs) {
            // Count chunks
            const [chunkRes] = await db.select({ count: count() })
                .from(chunks)
                .where(eq(chunks.documentId, doc.id));

            // Search keywords
            const relevantChunks = await db.select().from(chunks)
                .where(eq(chunks.documentId, doc.id));

            const keywordMatches = relevantChunks.filter(c =>
                c.content.toLowerCase().includes('sklad') ||
                c.content.toLowerCase().includes('adresa')
            );

            console.log(`\n📄 Document: ${doc.filename}`);
            console.log(`   ID: ${doc.id}`);
            console.log(`   Chunks: ${chunkRes.count}`);
            console.log(`   Keyword Matches: ${keywordMatches.length}`);

            if (keywordMatches.length > 0) {
                console.log(`   Sample Match: "${keywordMatches[0].content.slice(0, 100).replace(/\n/g, ' ')}..."`);
            }
        }
    }
}


export { };
main().catch(console.error);
