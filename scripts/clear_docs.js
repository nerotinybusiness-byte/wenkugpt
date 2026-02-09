
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

async function main() {
    try {
        const client = await pool.connect();
        console.log('🗑️ Clearing documents table...');
        await client.query('DELETE FROM documents');
        console.log('✅ Documents table cleared.');
        client.release();
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}
main();
