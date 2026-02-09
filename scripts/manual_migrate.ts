
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import postgres from 'postgres';
import fs from 'fs';

async function main() {
    console.log('--- Manual Migration Start ---');
    const connectionUrl = process.env.DATABASE_URL; // Using Pooler (6543)
    if (!connectionUrl) throw new Error('DATABASE_URL missing');

    const sqlClient = postgres(connectionUrl, { ssl: 'require', connect_timeout: 20 });

    try {
        const sqlContent = fs.readFileSync('drizzle/0001_strange_bloodstorm.sql', 'utf8');
        const statements = sqlContent.split('--> statement-breakpoint');

        console.log(`Found ${statements.length} statements.`);

        for (const [i, stmt] of statements.entries()) {
            const query = stmt.trim();
            if (!query) continue;

            console.log(`Executing [${i + 1}/${statements.length}]: ${query.slice(0, 50)}...`);
            try {
                await sqlClient.unsafe(query);
                console.log('  ✓ Success');
            } catch (e) {
                console.error(`  ⚠️ Warning: ${e instanceof Error ? e.message : e}`);
                // Continue on error (e.g. if table already exists)
            }
        }

    } catch (e) {
        console.error('Migration Fatal Error:', e);
    } finally {
        await sqlClient.end();
    }
    console.log('--- Manual Migration End ---');
    process.exit(0);
}

main();
