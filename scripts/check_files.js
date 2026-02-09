const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });

async function main() {
    console.log('--- Checking DB Content ---');
    const sql = postgres(process.env.DATABASE_URL);

    try {
        const documents = await sql`SELECT id, filename, created_at FROM documents ORDER BY created_at DESC`;
        console.log(`Total documents in DB: ${documents.length}`);
        documents.forEach(doc => {
            console.log(`- ${doc.filename} (${doc.id})`);
        });
    } catch (err) {
        console.error('DB Error:', err);
    } finally {
        await sql.end();
    }
}
main();
