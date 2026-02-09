import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from './src/lib/db';
import { documents } from './src/lib/db/schema';
import { desc } from 'drizzle-orm';

async function main() {
    console.log('--- DB Debug Start ---');
    try {
        console.log('Checking connection...');
        const docs = await db.select().from(documents).orderBy(desc(documents.createdAt));
        console.log(`Success! Found ${docs.length} documents.`);
        docs.forEach(d => {
            console.log(`- [${d.processingStatus}] ${d.filename} (${d.id})`);
        });
    } catch (error) {
        console.error('DB Error:', error);
    }
    console.log('--- DB Debug End ---');
    process.exit(0);
}

main();
