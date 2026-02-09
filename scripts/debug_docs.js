
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

async function main() {
    try {
        const client = await pool.connect();
        const res = await client.query('SELECT id, filename, created_at FROM documents ORDER BY created_at DESC');
        console.log('📄 DB Documents:');
        res.rows.forEach(r => console.log(` - ${r.filename} (ID: ${r.id}, Created: ${r.created_at})`));
        client.release();
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}
main();
