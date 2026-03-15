import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

type IngestSchemaHealthResult = {
    ok: boolean;
    missingColumns: string[];
    missingExtensions: string[];
    details: string[];
};

function printReport(report: IngestSchemaHealthResult): void {
    console.log(`ingest_schema_ok=${report.ok ? 'true' : 'false'}`);
    console.log(`missing_columns=${report.missingColumns.join(',') || '(none)'}`);
    console.log(`missing_extensions=${report.missingExtensions.join(',') || '(none)'}`);
    for (const detail of report.details) {
        console.log(`detail=${detail}`);
    }
}

async function main() {
    const strict = process.argv.includes('--strict');

    try {
        const { checkIngestSchemaHealth } = await import('../src/lib/db/schema-health');
        const report = await checkIngestSchemaHealth();
        printReport(report);

        if (!report.ok && strict) {
            console.error('ingest schema check failed in strict mode');
            process.exit(1);
        }

        process.exit(0);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`ingest schema check failed: ${message}`);
        process.exit(1);
    }
}

void main();
