
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('DATABASE_URL is missing in .env.local');
    process.exit(1);
}

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }, // Supabase usually needs this
});

async function main() {
    try {
        console.log('🔍 Connecting to DB...');
        const client = await pool.connect();

        // 1. Check columns
        console.log('\n📄 Checking "chunks" columns...');
        const resCols = await client.query(`
            SELECT column_name, data_type, udt_name
            FROM information_schema.columns 
            WHERE table_name = 'chunks'
        `);

        let hasFts = false;
        resCols.rows.forEach(row => {
            console.log(` - ${row.column_name} (${row.data_type} / ${row.udt_name})`);
            if (row.column_name === 'fts_vector') hasFts = true;
        });

        if (!hasFts) {
            console.error('\n❌ "fts_vector" column is MISSING!');
        } else {
            console.log('\n✅ "fts_vector" column exists.');
        }

        // 2. Check Czech dict
        console.log('\n🇨🇿 Testing Czech dictionary...');
        try {
            const resDict = await client.query(`SELECT to_tsvector('czech', 'Příliš žluťoučký kůň') as v`);
            console.log(`✅ Czech dict OK: ${JSON.stringify(resDict.rows[0])}`);
        } catch (e) {
            console.error('❌ Czech dict query FAILED:', e.message);
        }

        client.release();
    } catch (err) {
        console.error('❌ DB Error:', err);
    } finally {
        await pool.end();
    }
}

main();
