import { db } from './src/lib/db';
import { sql } from 'drizzle-orm';

type InformationSchemaRow = {
    column_name: string;
    data_type: string;
    udt_name: string;
};

async function main() {
    console.log('Checking database schema...');

    try {
        const columnsResult = await db.execute(sql`
            SELECT column_name, data_type, udt_name
            FROM information_schema.columns
            WHERE table_name = 'chunks'
        `);

        const rows = (Array.isArray(columnsResult) ? columnsResult : columnsResult.rows) as InformationSchemaRow[];
        console.log('\nColumns in "chunks" table:');
        rows.forEach((col) => {
            console.log(` - ${col.column_name} (${col.data_type} / ${col.udt_name})`);
        });

        const hasFtsVector = rows.some((col) => col.column_name === 'fts_vector');
        if (!hasFtsVector) {
            console.error('\nCRITICAL: "fts_vector" column is MISSING!');
        } else {
            console.log('\n"fts_vector" column exists.');
        }

        console.log('\nTesting Czech text search support...');
        try {
            await db.execute(sql`SELECT to_tsvector('czech', 'Prilis zlutoucky kun') as vector`);
            console.log('Czech configuration available.');
        } catch (err) {
            console.error('Czech configuration NOT available:', err);
            console.log('Trying "simple" as fallback...');
            try {
                await db.execute(sql`SELECT to_tsvector('simple', 'test')`);
                console.log('"simple" works.');
            } catch (e) {
                console.error('Even "simple" failed:', e);
            }
        }
    } catch (error) {
        console.error('Error inspecting DB:', error);
    }

    process.exit(0);
}

main();
