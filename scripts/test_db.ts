
import dotenv from 'dotenv';
import path from 'path';
import postgres from 'postgres';

// Load env
const envPath = path.join(process.cwd(), '.env.local');
console.log('Loading env from:', envPath);
dotenv.config({ path: envPath });

const connectionString = process.env.DATABASE_URL;
console.log('DATABASE_URL exists:', !!connectionString);

if (!connectionString) {
    console.error('No DATABASE_URL found!');
    process.exit(1);
}

async function main() {
    console.log('Connecting to DB...');
    const sql = postgres(connectionString!);
    try {
        const result = await sql`SELECT 1 as val`;
        console.log('Connection successful! Result:', result);
    } catch (e) {
        console.error('Connection failed:', e);
    } finally {
        await sql.end();
    }
}

main();
