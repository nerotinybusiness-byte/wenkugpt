import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// Validate environment variable at module load
const connectionString = process.env.DATABASE_URL;
// Ops note: production DATABASE_URL should point to the provider's pooled endpoint.

if (!connectionString) {
    throw new Error(
        'DATABASE_URL environment variable is required.\n' +
        'Format: postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres'
    );
}

/**
 * PostgreSQL client (node-postgres)
 * Uses connection pooling
 */
const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    // Slightly higher connect timeout reduces transient failures during request bursts.
    connectionTimeoutMillis: 10000,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined, // Supabase requires SSL
});

/**
 * Drizzle ORM instance
 */
export const db = drizzle(pool, { schema });

// Re-export schema for convenience
export * from './schema';

// Export type for use in other modules
export type Database = typeof db;
