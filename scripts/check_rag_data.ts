
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { like, eq } from 'drizzle-orm';

// 1. Load env vars FIRST
const envPath = path.join(process.cwd(), '.env.local');
console.log('Loading env from:', envPath);
dotenv.config({ path: envPath });

const LOG_FILE = 'check_output_utf8.txt';
function log(msg: string) {
    console.log(msg);
    fs.appendFileSync(LOG_FILE, msg + '\n');
}

// Clear log file
try {
    fs.writeFileSync(LOG_FILE, '');
} catch (e) { console.error('Failed to clear log', e); }

async function main() {
    // 2. Dynamic import after env is loaded
    const { db } = await import('./src/lib/db/index');
    const { documents, chunks } = await import('./src/lib/db/schema');

    log('Checking for documents...');

    // Check for 'Wenku' or 'Sklad' in filename
    const docs = await db.select().from(documents).where(like(documents.filename, '%Wenku%'));
    const docs2 = await db.select().from(documents).where(like(documents.filename, '%Sklad%'));

    // Merge and deduplicate
    const allDocsMap = new Map();
    docs.forEach(d => allDocsMap.set(d.id, d));
    docs2.forEach(d => allDocsMap.set(d.id, d));
    const uniqueDocs = Array.from(allDocsMap.values());

    if (uniqueDocs.length === 0) {
        log('No documents found matching "Wenku" or "Sklad".');
    } else {
        log(`Found ${uniqueDocs.length} documents:`);
        for (const doc of uniqueDocs) {
            log(`- [${doc.id}] ${doc.filename} (${doc.pageCount} pages, ${doc.processingStatus})`);

            // Get chunks for this document
            const docChunks = await db.select().from(chunks).where(eq(chunks.documentId, doc.id));
            log(`  Target Chunks: ${docChunks.length}`);

            // Search chunks for keywords
            const relevantChunks = docChunks.filter(c =>
                c.content.toLowerCase().includes('adresa') ||
                c.content.toLowerCase().includes('ulice') ||
                c.content.toLowerCase().includes('město') ||
                c.content.toLowerCase().includes('sklad')
            );

            if (relevantChunks.length > 0) {
                log(`  Found ${relevantChunks.length} chunks containing keywords:`);
                relevantChunks.forEach(c => {
                    log(`    [Chunk ${c.chunkIndex}] Page ${c.pageNumber}: "${c.content.slice(0, 50).replace(/\n/g, ' ')}..."`);
                    if (c.content.toLowerCase().includes('adresa')) {
                        log(`    FULL CONTENT: ${c.content}`);
                    }
                });
            } else {
                log('  No chunks contain keywords (adresa/ulice/město/sklad).');
            }
        }
    }
}

main().catch((err) => {
    console.error(err);
    fs.appendFileSync(LOG_FILE, 'ERROR: ' + err);
}).finally(() => process.exit());
