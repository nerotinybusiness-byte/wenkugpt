import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  real,
  boolean,
  timestamp,
  jsonb,
  index,
  customType,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// =============================================================================
// CUSTOM TYPES FOR PGVECTOR AND TSVECTOR
// =============================================================================

/**
 * Custom pgvector type for 768-dimensional embeddings (text-embedding-004)
 * Stored as vector(768) in PostgreSQL
 */
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(768)';
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string): number[] {
    // Parse PostgreSQL vector format: [0.1,0.2,...]
    return value
      .slice(1, -1)
      .split(',')
      .map((v) => parseFloat(v));
  },
});

/**
 * Custom tsvector type for Czech full-text search
 */
const tsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'tsvector';
  },
});

// =============================================================================
// ENUM TYPES
// =============================================================================

export type AccessLevel = 'public' | 'private' | 'team';
export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type UserRole = 'user' | 'admin';
export type VerificationLevel = 'basic' | 'auditor_loop';
export type ModelType = 'gemini-2.5-flash' | 'gemini-2.5-pro' | 'gemini-2.0-flash' | 'gemini-1.5-flash' | 'gemini-1.5-pro' | 'claude-haiku';

// =============================================================================
// TABLE: USERS
// Google SSO authenticated users with rate limiting
// =============================================================================

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 320 }).unique().notNull(),
  name: varchar('name', { length: 256 }),
  imageUrl: varchar('image_url', { length: 2048 }),
  role: varchar('role', { length: 32 }).$type<UserRole>().default('user').notNull(),

  // Rate limiting (50 prompts/day)
  dailyPromptCount: integer('daily_prompt_count').default(0).notNull(),
  lastPromptReset: timestamp('last_prompt_reset', { withTimezone: true }).defaultNow().notNull(),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// =============================================================================
// TABLE: DOCUMENTS
// Uploaded PDF/TXT metadata with processing status
// =============================================================================

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),

  // File metadata
  filename: varchar('filename', { length: 512 }).notNull(),
  fileHash: varchar('file_hash', { length: 64 }).notNull(), // SHA-256 for deduplication
  mimeType: varchar('mime_type', { length: 128 }).notNull(),
  fileSize: integer('file_size').notNull().default(0),
  pageCount: integer('page_count'),

  // Access control
  accessLevel: varchar('access_level', { length: 32 }).$type<AccessLevel>().default('private').notNull(),

  // Processing pipeline status
  processingStatus: varchar('processing_status', { length: 32 })
    .$type<ProcessingStatus>()
    .default('pending')
    .notNull(),
  processingError: text('processing_error'),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('documents_user_idx').on(table.userId),
  index('documents_hash_idx').on(table.fileHash),
]);

// =============================================================================
// TABLE: CHUNKS
// The heart of the RAG system - semantic chunks with embeddings
// =============================================================================

/**
 * Bounding box type for Golden Glow PDF highlighting
 * All coordinates are NORMALIZED to 0.0-1.0 (percentage of page dimensions)
 */
export interface BoundingBox {
  x: number;      // Left edge (0.0-1.0)
  y: number;      // Top edge (0.0-1.0)
  width: number;  // Width (0.0-1.0)
  height: number; // Height (0.0-1.0)
}

export const chunks = pgTable('chunks', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id').references(() => documents.id, { onDelete: 'cascade' }).notNull(),

  // Content
  content: text('content').notNull(),
  contentHash: varchar('content_hash', { length: 64 }).notNull(), // SHA-256

  // Embeddings (text-embedding-004 = 768 dimensions)
  embedding: vector('embedding'),

  // Position metadata
  pageNumber: integer('page_number').notNull(),
  boundingBox: jsonb('bounding_box').$type<BoundingBox>(), // Normalized 0.0-1.0
  parentHeader: varchar('parent_header', { length: 512 }), // e.g., "## Section > ### Subsection"
  chunkIndex: integer('chunk_index').notNull(), // Order within document

  // Token stats
  tokenCount: integer('token_count'),

  // Access control (inherited from document)
  accessLevel: varchar('access_level', { length: 32 }).$type<AccessLevel>().default('private').notNull(),

  // Czech full-text search vector
  ftsVector: tsvector('fts_vector'),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  // B-tree for document-level queries
  index('chunks_document_idx').on(table.documentId),
  // Note: HNSW index on embedding and GIN on fts_vector created via migration SQL
]);

// =============================================================================
// TABLE: AUDIT_LOGS
// Complete audit trail for the Triple-Agent verification loop
// =============================================================================

export interface Citation {
  id: string;           // [1], [2], etc.
  chunkId: string;      // UUID of source chunk
  page: number;         // Source page number
  confidence: number;   // 0.0-1.0
}

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),

  // Query data
  query: text('query').notNull(),
  retrievedChunkIds: uuid('retrieved_chunk_ids').array(),

  // Agent outputs
  draftResponse: text('draft_response'),        // Agent B's initial response
  finalResponse: text('final_response'),        // After Agent C's NLI audit
  citations: jsonb('citations').$type<Citation[]>(),

  // Quality metrics
  confidenceScore: real('confidence_score'),    // 0.0-1.0
  verificationLevel: varchar('verification_level', { length: 32 })
    .$type<VerificationLevel>()
    .default('basic')
    .notNull(),
  hallucinationDetected: boolean('hallucination_detected').default(false),

  // Model info
  modelUsed: varchar('model_used', { length: 64 }),

  // Performance metrics
  latencyMs: integer('latency_ms'),
  tokensUsed: integer('tokens_used'),

  // Timestamp
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('audit_logs_user_idx').on(table.userId),
  index('audit_logs_created_idx').on(table.createdAt),
]);

// =============================================================================
// TABLE: SEMANTIC_CACHE
// Instant retrieval of verified answers for repeated questions
// =============================================================================

export const semanticCache = pgTable('semantic_cache', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Query data
  queryText: text('query_text').notNull(),
  queryHash: varchar('query_hash', { length: 64 }).unique().notNull(), // SHA-256 of normalized query
  queryEmbedding: vector('query_embedding'), // For semantic similarity matching (768d)

  // Cached response (from verified Triple-Agent flow)
  answerText: text('answer_text').notNull(),
  citations: jsonb('citations').$type<Citation[]>(), // References to source chunks
  confidence: real('confidence').default(0.0).notNull(), // Auditor confidence score

  // Source chunks used
  chunkIds: uuid('chunk_ids').array(),

  // Usage stats
  hitCount: integer('hit_count').default(0).notNull(),

  // TTL
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}, (table) => [
  index('semantic_cache_hash_idx').on(table.queryHash),
  index('semantic_cache_expires_idx').on(table.expiresAt),
]);

// =============================================================================
// TABLE: CONFIG
// Per-user runtime configuration for the Control Panel
// =============================================================================

export const config = pgTable('config', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).unique().notNull(),

  // Model settings
  model: varchar('model', { length: 64 }).$type<ModelType>().default('gemini-2.0-flash').notNull(),
  temperature: real('temperature').default(0.0).notNull(), // 0.0 = deterministic
  topK: integer('top_k').default(5).notNull(), // Context window size (1-20)

  // Verification mode
  verificationLevel: varchar('verification_level', { length: 32 })
    .$type<VerificationLevel>()
    .default('auditor_loop')
    .notNull(),

  // Timestamp
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// =============================================================================
// RELATIONS (Drizzle ORM)
// =============================================================================

export const usersRelations = relations(users, ({ many, one }) => ({
  documents: many(documents),
  auditLogs: many(auditLogs),
  config: one(config),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  user: one(users, {
    fields: [documents.userId],
    references: [users.id],
  }),
  chunks: many(chunks),
}));

export const chunksRelations = relations(chunks, ({ one }) => ({
  document: one(documents, {
    fields: [chunks.documentId],
    references: [documents.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

export const configRelations = relations(config, ({ one }) => ({
  user: one(users, {
    fields: [config.userId],
    references: [users.id],
  }),
}));

// =============================================================================
// TYPE EXPORTS (Inferred from schema)
// =============================================================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;

export type Chunk = typeof chunks.$inferSelect;
export type NewChunk = typeof chunks.$inferInsert;

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

export type SemanticCacheEntry = typeof semanticCache.$inferSelect;
export type NewSemanticCacheEntry = typeof semanticCache.$inferInsert;

export type Config = typeof config.$inferSelect;
export type NewConfig = typeof config.$inferInsert;
