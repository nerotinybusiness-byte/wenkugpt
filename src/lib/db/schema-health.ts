import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

const REQUIRED_TABLE_COLUMNS = {
    chunks: [
        'highlight_boxes',
        'highlight_text',
        'embedding',
        'fts_vector',
        'is_template_boilerplate',
    ],
    documents: [
        'template_profile_id',
        'template_matched',
        'template_match_score',
        'template_boilerplate_chunks',
        'template_detection_mode',
        'template_warnings',
    ],
} as const;

const REQUIRED_EXTENSIONS = ['vector'] as const;
const CACHE_TTL_MS = 60_000;

export interface IngestSchemaHealthResult {
    ok: boolean;
    missingColumns: string[];
    missingExtensions: string[];
    details: string[];
}

interface RowResult<T> {
    rows?: T[];
}

interface ColumnRow {
    table_name: string;
    column_name: string;
}

interface ExtensionRow {
    extname: string;
}

let cachedSchemaHealth:
    | {
        expiresAt: number;
        value: IngestSchemaHealthResult;
    }
    | null = null;

function normalizeRows<T>(result: unknown): T[] {
    if (Array.isArray(result)) return result as T[];
    const withRows = result as RowResult<T>;
    if (Array.isArray(withRows?.rows)) return withRows.rows;
    return [];
}

function buildErrorMessage(report: IngestSchemaHealthResult): string {
    const problems: string[] = [];

    if (report.missingColumns.length > 0) {
        problems.push(`missing columns: ${report.missingColumns.join(', ')}`);
    }
    if (report.missingExtensions.length > 0) {
        problems.push(`missing postgres extensions: ${report.missingExtensions.join(', ')}`);
    }

    return `Ingest schema preflight failed (${problems.join('; ')}). Apply pending DB migrations before ingest.`;
}

export class IngestSchemaHealthError extends Error {
    readonly missingColumns: string[];
    readonly missingExtensions: string[];
    readonly details: string[];

    constructor(report: IngestSchemaHealthResult) {
        super(buildErrorMessage(report));
        this.name = 'IngestSchemaHealthError';
        this.missingColumns = report.missingColumns;
        this.missingExtensions = report.missingExtensions;
        this.details = report.details;
    }
}

export function isIngestSchemaHealthError(error: unknown): error is IngestSchemaHealthError {
    return error instanceof Error && error.name === 'IngestSchemaHealthError';
}

export async function checkIngestSchemaHealth(): Promise<IngestSchemaHealthResult> {
    const now = Date.now();
    if (cachedSchemaHealth && cachedSchemaHealth.expiresAt > now) {
        return cachedSchemaHealth.value;
    }

    const columnResult = await db.execute(sql`
        select table_name, column_name
        from information_schema.columns
        where table_schema = 'public'
          and table_name in ('chunks', 'documents')
    `);
    const extensionResult = await db.execute(sql`
        select extname
        from pg_extension
    `);

    const existingColumns = new Set(
        normalizeRows<ColumnRow>(columnResult)
            .map((row) => {
                const table = row.table_name?.toLowerCase();
                const column = row.column_name?.toLowerCase();
                if (!table || !column) return null;
                return `${table}.${column}`;
            })
            .filter((value): value is string => Boolean(value))
    );
    const existingExtensions = new Set(
        normalizeRows<ExtensionRow>(extensionResult)
            .map((row) => row.extname?.toLowerCase())
            .filter((value): value is string => Boolean(value))
    );

    const missingColumns = Object.entries(REQUIRED_TABLE_COLUMNS).flatMap(([table, columns]) => (
        columns
            .filter((column) => !existingColumns.has(`${table}.${column}`))
            .map((column) => `${table}.${column}`)
    ));
    const missingExtensions = REQUIRED_EXTENSIONS.filter((ext) => !existingExtensions.has(ext));

    const details: string[] = [];
    if (missingColumns.length > 0) {
        details.push(`missing required columns: ${missingColumns.join(', ')}`);
    }
    if (missingExtensions.length > 0) {
        details.push(`missing required extensions: ${missingExtensions.join(', ')}`);
    }
    if (details.length === 0) {
        details.push('ingest schema health check passed');
    }

    const result: IngestSchemaHealthResult = {
        ok: missingColumns.length === 0 && missingExtensions.length === 0,
        missingColumns: [...missingColumns],
        missingExtensions: [...missingExtensions],
        details,
    };

    cachedSchemaHealth = {
        expiresAt: now + CACHE_TTL_MS,
        value: result,
    };

    return result;
}

export async function assertIngestSchemaHealth(): Promise<void> {
    const report = await checkIngestSchemaHealth();
    if (!report.ok) {
        throw new IngestSchemaHealthError(report);
    }
}
