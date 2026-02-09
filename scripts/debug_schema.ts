
import { db } from './src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
    console.log('🔍 Checking database schema...');

    try {
        // 1. Check if fts_vector column exists in chunks table
        const columns = await db.execute(sql`
            SELECT column_name, data_type, udt_name
            FROM information_schema.columns 
            WHERE table_name = 'chunks'
        `);

        const rows = Array.isArray(columns) ? columns : columns.rows;
        console.log('\n📄 Columns in "chunks" table:');
        rows.forEach((col: any) => {
            console.log(` - ${col.column_name} (${col.data_type} / ${col.udt_name})`);
        });

        const hasFtsVector = rows.some((col: any) => col.column_name === 'fts_vector');
        if (!hasFtsVector) {
            console.error('\n❌ CRITICAL: "fts_vector" column is MISSING!');
        } else {
            console.log('\n✅ "fts_vector" column exists.');
        }

        // 2. Test Czech text search configuration
        console.log('\n🇨🇿 Testing Czech text search support...');
        try {
            const ftsTest = await db.execute(sql`SELECT to_tsvector('czech', 'Příliš žluťoučký kůň') as vector`);
            console.log('✅ Czech configuration available.');
        } catch (err) {
            console.error('❌ Czech configuration NOT available:', err);
            console.log('   Trying "simple" as fallback...');
            try {
                await db.execute(sql`SELECT to_tsvector('simple', 'test')`);
                console.log('   "simple" works.');
            } catch (e) {
                console.error('   Even "simple" failed:', e);
            }
        }

    } catch (error) {
        console.error('❌ Error inspecting DB:', error);
    }

    process.exit(0);
}

main();
