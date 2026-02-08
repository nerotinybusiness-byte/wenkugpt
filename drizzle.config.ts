import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle Kit Configuration
 * 
 * Uses DIRECT_URL for migrations (bypasses pgBouncer for DDL operations)
 * Falls back to DATABASE_URL if DIRECT_URL is not set
 */

// Force using DATABASE_URL (pooler) because port 5432 is blocked/timing out
const connectionUrl = process.env.DATABASE_URL;

if (!connectionUrl) {
    throw new Error(
        'DIRECT_URL or DATABASE_URL environment variable is required.\n' +
        'DIRECT_URL: postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres\n' +
        '(Use DIRECT_URL for migrations to bypass pgBouncer)'
    );
}

export default defineConfig({
    // Schema location
    schema: './src/lib/db/schema.ts',

    // Output directory for migrations
    out: './drizzle',

    // Database dialect
    dialect: 'postgresql',

    // Database connection
    dbCredentials: {
        url: connectionUrl,
        ssl: true, // Required for Supabase Transaction Pooler
    },

    // Verbose logging
    verbose: true,

    // Strict mode - fail on warnings
    strict: true,

    // Table filters (only our app tables, exclude Supabase internals)
    tablesFilter: [
        'users',
        'documents',
        'chunks',
        'conversations',
        'messages',
        'cache',
    ],
});
