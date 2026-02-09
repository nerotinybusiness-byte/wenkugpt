
export { };
import dotenv from 'dotenv';
import path from 'path';
import { eq, isNotNull } from 'drizzle-orm';

// Load env
const envPath = path.join(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

async function main() {
    // Dynamic import
    const { db } = await import('./src/lib/db/index');
    const { chunks } = await import('./src/lib/db/schema');

    console.log('Checking for bounding boxes...');

    // Get chunks that have bounding_box
    const bboxChunks = await db.select().from(chunks)
        .where(isNotNull(chunks.boundingBox))
        .limit(5);

    if (bboxChunks.length === 0) {
        console.log('⚠️  No chunks found with bounding_box data!');
    } else {
        console.log(`✅ Found ${bboxChunks.length} sample chunks with bounding boxes:`);
        bboxChunks.forEach(c => {
            console.log(`- Chunk ${c.id.slice(0, 8)}: Page ${c.pageNumber}, BBox: ${JSON.stringify(c.boundingBox)}`);
        });
    }
}

main().catch(console.error).finally(() => process.exit());
