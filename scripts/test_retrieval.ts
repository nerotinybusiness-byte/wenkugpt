
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load env FIRST
const envPath = path.join(process.cwd(), '.env.local');
console.log('Loading env from:', envPath);
dotenv.config({ path: envPath });

const LOG_FILE = 'retrieval_output_utf8.txt';
function log(msg: string) {
    console.log(msg);
    fs.appendFileSync(LOG_FILE, msg + '\n');
}

// Clear log file
try { fs.writeFileSync(LOG_FILE, ''); } catch (e) { }

async function main() {
    // Dynamic imports
    const { executeRAG } = await import('./src/lib/ai/agents');

    const query = "Kde je sklad Wenku?";
    log(`Testing retrieval for query: "${query}"`);

    try {
        // Run with default config
        const response = await executeRAG(query, {
            search: {
                limit: 50, // Get deeper results
                minScore: 0.05, // Very low score
                vectorWeight: 0.5,
                textWeight: 0.5,
            },
            topK: 20, // Rerank top 20
            confidenceThreshold: 0.0,
            generatorModel: 'gemini-2.0-flash',
            auditorModel: 'claude-3-5-haiku-latest',
            temperature: 0,
            skipVerification: true,
            skipGeneration: true,
        });

        log('\nResponse: ' + response.response);
        log('\nSources Retrieved: ' + response.sources.length);

        response.sources.forEach((s, i) => {
            log(`\n[Source ${i + 1}] Score: ${s.relevanceScore.toFixed(4)} | Page ${s.pageNumber} | ${s.filename}`);
            log(s.content.slice(0, 150).replace(/\n/g, ' '));
            if (s.content.toLowerCase().includes('adresa') || s.content.toLowerCase().includes('hanspaulce')) {
                log('*** CONTAINS ADDRESS ***');
            }
        });

    } catch (e) {
        log('Retrieval failed: ' + e);
        if (e instanceof Error) log(e.stack || '');
    }
}

main().catch((err) => {
    console.error(err);
    fs.appendFileSync(LOG_FILE, 'ERROR: ' + err);
}).finally(() => process.exit());
