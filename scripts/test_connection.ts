
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import postgres from 'postgres';


import fs from 'fs';

const logFile = 'connection_test.log';
fs.writeFileSync(logFile, '--- Testing DB Connections ---\n');

function log(msg: string) {
    console.log(msg);
    fs.appendFileSync(logFile, msg + '\n');
}

async function testConnection(name: string, url?: string) {
    if (!url) {
        log(`[${name}] SKIPPED: URL not found`);
        return;
    }
    const safeUrl = url.replace(/:[^:@]+@/, ':***@');
    log(`[${name}] Connecting to: ${safeUrl} ...`);
    try {
        const sql = postgres(url, { connect_timeout: 10, ssl: 'require' }); // Force SSL for pooler
        const result = await sql`SELECT version()`;
        log(`[${name}] SUCCESS: ${result[0].version}`);
        await sql.end();
    } catch (e) {
        log(`[${name}] FAILED: ${e instanceof Error ? e.message : String(e)}`);
    }
}

async function main() {
    await testConnection('DATABASE_URL (Pooler)', process.env.DATABASE_URL);
    await testConnection('DIRECT_URL (Direct)', process.env.DIRECT_URL);
    log('--- Done ---');
    process.exit(0);
}


main();
