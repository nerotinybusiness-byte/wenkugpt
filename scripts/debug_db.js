const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });

async function main() {
    console.log('--- DB Debug JS Start ---');
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        console.error('No DATABASE_URL found');
        process.exit(1);
    }

    const sql = postgres(connectionString);

    try {
        // 1. List all documents
        const documents = await sql`
            SELECT id, filename, processing_status, file_size, created_at 
            FROM documents 
            ORDER BY created_at DESC
        `;

        console.log(`Found ${documents.length} documents:`);
        const stuckIds = [];

        documents.forEach(doc => {
            console.log(`- [${doc.processing_status}] ${doc.filename} (${doc.id})`);
            if (doc.processing_status === 'processing') {
                stuckIds.push(doc.id);
            }
        });

        if (stuckIds.length > 0) {
            console.log(`\n[WARNING] Still found ${stuckIds.length} stuck documents!`);
        } else {
            console.log('\nSUCCESS: Database is clean. No stuck documents.');
        }

    } catch (err) {
        console.error('DB Error:', err);
    } finally {
        await sql.end();
    }
    console.log('--- DB Debug JS End ---');
}

main();
