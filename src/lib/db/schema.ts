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
  uniqueIndex,
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
export type ConceptStatus = 'draft' | 'approved' | 'deprecated';
export type ConceptCriticality = 'normal' | 'critical';
export type AliasStatus = 'active' | 'deprecated';
export type DefinitionStatus = 'draft' | 'approved' | 'rejected';
export type RelationshipStatus = 'draft' | 'approved' | 'deprecated';
export type RelationshipType = 'implies' | 'requires' | 'opposes' | 'contradicts' | 'similar_to';
export type CandidateStatus = 'pending' | 'approved' | 'rejected';
export type ReviewDecision = 'approved' | 'rejected' | 'needs_changes';

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
  originalFilename: varchar('original_filename', { length: 512 }),
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
  templateProfileId: varchar('template_profile_id', { length: 128 }),
  templateMatched: boolean('template_matched').default(false).notNull(),
  templateMatchScore: real('template_match_score'),
  templateBoilerplateChunks: integer('template_boilerplate_chunks').default(0).notNull(),
  templateDetectionMode: varchar('template_detection_mode', { length: 32 }),
  templateWarnings: jsonb('template_warnings').$type<string[]>(),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('documents_user_idx').on(table.userId),
  index('documents_hash_idx').on(table.fileHash),
  uniqueIndex('documents_user_hash_unique_idx').on(table.userId, table.fileHash),
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
  highlightBoxes: jsonb('highlight_boxes').$type<BoundingBox[]>(),
  highlightText: text('highlight_text'),
  parentHeader: varchar('parent_header', { length: 512 }), // e.g., "## Section > ### Subsection"
  chunkIndex: integer('chunk_index').notNull(), // Order within document

  // Token stats
  tokenCount: integer('token_count'),
  isTemplateBoilerplate: boolean('is_template_boilerplate').default(false).notNull(),

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
// TABLE: CONCEPTS
// Canonical internal concepts for slang-aware graph memory
// =============================================================================

export const concepts = pgTable('concepts', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: varchar('key', { length: 128 }).notNull(),
  label: varchar('label', { length: 256 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 32 }).$type<ConceptStatus>().default('draft').notNull(),
  criticality: varchar('criticality', { length: 32 }).$type<ConceptCriticality>().default('normal').notNull(),
  definedBy: uuid('defined_by').references(() => users.id, { onDelete: 'set null' }),
  approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('concepts_key_unique_idx').on(table.key),
  index('concepts_status_idx').on(table.status),
]);

// =============================================================================
// TABLE: CONCEPT_ALIASES
// Alias terms with scope/time validity
// =============================================================================

export const conceptAliases = pgTable('concept_aliases', {
  id: uuid('id').primaryKey().defaultRandom(),
  conceptId: uuid('concept_id').references(() => concepts.id, { onDelete: 'cascade' }).notNull(),
  alias: varchar('alias', { length: 256 }).notNull(),
  aliasNormalized: varchar('alias_normalized', { length: 256 }).notNull(),
  language: varchar('language', { length: 16 }).default('cs').notNull(),
  team: varchar('team', { length: 128 }),
  product: varchar('product', { length: 128 }),
  region: varchar('region', { length: 128 }),
  process: varchar('process', { length: 128 }),
  role: varchar('role', { length: 128 }),
  status: varchar('status', { length: 32 }).$type<AliasStatus>().default('active').notNull(),
  confidence: real('confidence').default(1).notNull(),
  validFrom: timestamp('valid_from', { withTimezone: true }).defaultNow().notNull(),
  validTo: timestamp('valid_to', { withTimezone: true }),
  definedBy: uuid('defined_by').references(() => users.id, { onDelete: 'set null' }),
  approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('concept_aliases_unique_scope_idx').on(
    table.aliasNormalized,
    table.team,
    table.product,
    table.region,
    table.process,
    table.role,
    table.validFrom,
  ),
  index('concept_aliases_lookup_idx').on(table.aliasNormalized, table.status),
  index('concept_aliases_concept_idx').on(table.conceptId),
  index('concept_aliases_validity_idx').on(table.validFrom, table.validTo),
]);

// =============================================================================
// TABLE: CONCEPT_DEFINITION_VERSIONS
// Versioned definitions with temporal/scope controls
// =============================================================================

export const conceptDefinitionVersions = pgTable('concept_definition_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  conceptId: uuid('concept_id').references(() => concepts.id, { onDelete: 'cascade' }).notNull(),
  version: integer('version').notNull(),
  definition: text('definition').notNull(),
  status: varchar('status', { length: 32 }).$type<DefinitionStatus>().default('draft').notNull(),
  confidence: real('confidence').default(0.7).notNull(),
  team: varchar('team', { length: 128 }),
  product: varchar('product', { length: 128 }),
  region: varchar('region', { length: 128 }),
  process: varchar('process', { length: 128 }),
  role: varchar('role', { length: 128 }),
  validFrom: timestamp('valid_from', { withTimezone: true }).defaultNow().notNull(),
  validTo: timestamp('valid_to', { withTimezone: true }),
  definedBy: uuid('defined_by').references(() => users.id, { onDelete: 'set null' }),
  approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
  sourceOfTruthDocId: uuid('source_of_truth_doc_id').references(() => documents.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('concept_definition_version_unique_idx').on(table.conceptId, table.version),
  index('concept_definition_status_idx').on(table.status),
  index('concept_definition_validity_idx').on(table.validFrom, table.validTo),
  index('concept_definition_scope_idx').on(table.team, table.product),
]);

// =============================================================================
// TABLE: CONCEPT_RELATIONSHIPS
// Directed graph links between concepts
// =============================================================================

export const conceptRelationships = pgTable('concept_relationships', {
  id: uuid('id').primaryKey().defaultRandom(),
  fromConceptId: uuid('from_concept_id').references(() => concepts.id, { onDelete: 'cascade' }).notNull(),
  toConceptId: uuid('to_concept_id').references(() => concepts.id, { onDelete: 'cascade' }).notNull(),
  relationType: varchar('relation_type', { length: 32 }).$type<RelationshipType>().notNull(),
  weight: real('weight').default(1).notNull(),
  status: varchar('status', { length: 32 }).$type<RelationshipStatus>().default('draft').notNull(),
  confidence: real('confidence').default(0.7).notNull(),
  team: varchar('team', { length: 128 }),
  product: varchar('product', { length: 128 }),
  region: varchar('region', { length: 128 }),
  process: varchar('process', { length: 128 }),
  role: varchar('role', { length: 128 }),
  validFrom: timestamp('valid_from', { withTimezone: true }).defaultNow().notNull(),
  validTo: timestamp('valid_to', { withTimezone: true }),
  definedBy: uuid('defined_by').references(() => users.id, { onDelete: 'set null' }),
  approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('concept_relationship_unique_idx').on(
    table.fromConceptId,
    table.toConceptId,
    table.relationType,
    table.team,
    table.product,
    table.region,
    table.process,
    table.role,
    table.validFrom,
  ),
  index('concept_relationship_from_idx').on(table.fromConceptId),
  index('concept_relationship_to_idx').on(table.toConceptId),
  index('concept_relationship_validity_idx').on(table.validFrom, table.validTo),
  index('concept_relationship_status_idx').on(table.status),
]);

// =============================================================================
// TABLE: CONCEPT_EVIDENCE
// Evidence records linked to concepts/definitions/aliases
// =============================================================================

export const conceptEvidence = pgTable('concept_evidence', {
  id: uuid('id').primaryKey().defaultRandom(),
  conceptId: uuid('concept_id').references(() => concepts.id, { onDelete: 'cascade' }).notNull(),
  definitionVersionId: uuid('definition_version_id').references(() => conceptDefinitionVersions.id, { onDelete: 'set null' }),
  aliasId: uuid('alias_id').references(() => conceptAliases.id, { onDelete: 'set null' }),
  documentId: uuid('document_id').references(() => documents.id, { onDelete: 'set null' }),
  sourceType: varchar('source_type', { length: 64 }).default('document').notNull(),
  sourceUrl: varchar('source_url', { length: 2048 }),
  excerpt: text('excerpt').notNull(),
  author: varchar('author', { length: 256 }),
  team: varchar('team', { length: 128 }),
  product: varchar('product', { length: 128 }),
  region: varchar('region', { length: 128 }),
  process: varchar('process', { length: 128 }),
  role: varchar('role', { length: 128 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('concept_evidence_concept_idx').on(table.conceptId),
  index('concept_evidence_definition_idx').on(table.definitionVersionId),
  index('concept_evidence_doc_idx').on(table.documentId),
  index('concept_evidence_scope_idx').on(table.team, table.product),
]);

// =============================================================================
// TABLE: TERM_CANDIDATES
// Candidate slang terms extracted from ingestion
// =============================================================================

export const termCandidates = pgTable('term_candidates', {
  id: uuid('id').primaryKey().defaultRandom(),
  termOriginal: varchar('term_original', { length: 256 }).notNull(),
  termNormalized: varchar('term_normalized', { length: 256 }).notNull(),
  contexts: jsonb('contexts').$type<string[]>().default([]).notNull(),
  frequency: integer('frequency').default(1).notNull(),
  sourceType: varchar('source_type', { length: 64 }).default('document').notNull(),
  documentId: uuid('document_id').references(() => documents.id, { onDelete: 'set null' }),
  author: varchar('author', { length: 256 }),
  team: varchar('team', { length: 128 }),
  product: varchar('product', { length: 128 }),
  region: varchar('region', { length: 128 }),
  process: varchar('process', { length: 128 }),
  role: varchar('role', { length: 128 }),
  candidateConceptKey: varchar('candidate_concept_key', { length: 128 }),
  suggestedDefinition: text('suggested_definition'),
  confidence: real('confidence').default(0.3).notNull(),
  status: varchar('status', { length: 32 }).$type<CandidateStatus>().default('pending').notNull(),
  detectedAt: timestamp('detected_at', { withTimezone: true }).defaultNow().notNull(),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('term_candidates_unique_idx').on(table.termNormalized, table.documentId),
  index('term_candidates_status_idx').on(table.status),
  index('term_candidates_lookup_idx').on(table.termNormalized),
  index('term_candidates_scope_idx').on(table.team, table.product),
]);

// =============================================================================
// TABLE: DEFINITION_REVIEWS
// Human-in-the-loop review records for term/definition approval
// =============================================================================

export const definitionReviews = pgTable('definition_reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  candidateId: uuid('candidate_id').references(() => termCandidates.id, { onDelete: 'set null' }),
  conceptId: uuid('concept_id').references(() => concepts.id, { onDelete: 'set null' }),
  definitionVersionId: uuid('definition_version_id').references(() => conceptDefinitionVersions.id, { onDelete: 'set null' }),
  reviewerId: uuid('reviewer_id').references(() => users.id, { onDelete: 'set null' }),
  decision: varchar('decision', { length: 32 }).$type<ReviewDecision>().notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('definition_reviews_candidate_idx').on(table.candidateId),
  index('definition_reviews_concept_idx').on(table.conceptId),
  index('definition_reviews_reviewer_idx').on(table.reviewerId),
  index('definition_reviews_created_idx').on(table.createdAt),
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
// TABLE: CHATS (SESSIONS)
// Stores conversation metadata
// =============================================================================

export const chats = pgTable('chats', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 256 }).default('New Chat').notNull(),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('chats_user_idx').on(table.userId),
  index('chats_created_idx').on(table.createdAt),
]);

// =============================================================================
// TABLE: MESSAGES
// Stores individual chat messages
// =============================================================================

export type MessageRole = 'user' | 'assistant' | 'system';

export interface MessageSource {
  id?: string;
  chunkId?: string;
  documentId?: string;
  pageNumber?: number | null;
  title?: string | null;
  filename?: string | null;
  originalFilename?: string | null;
  content?: string;
  boundingBox?: BoundingBox | null;
  highlightBoxes?: BoundingBox[] | null;
  highlightText?: string | null;
  parentHeader?: string | null;
  relevanceScore?: number;
  [key: string]: unknown;
}

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  chatId: uuid('chat_id').references(() => chats.id, { onDelete: 'cascade' }).notNull(),

  role: varchar('role', { length: 32 }).$type<MessageRole>().notNull(),
  content: text('content').notNull(),

  // Metadata for RAG
  sources: jsonb('sources').$type<MessageSource[]>(), // Array of source objects used for this message

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('messages_chat_idx').on(table.chatId),
  index('messages_created_idx').on(table.createdAt),
]);

// =============================================================================
// RELATIONS (Drizzle ORM)
// =============================================================================

export const usersRelations = relations(users, ({ many, one }) => ({
  documents: many(documents),
  auditLogs: many(auditLogs),
  config: one(config),
  chats: many(chats),
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

export const chatsRelations = relations(chats, ({ one, many }) => ({
  user: one(users, {
    fields: [chats.userId],
    references: [users.id],
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  chat: one(chats, {
    fields: [messages.chatId],
    references: [chats.id],
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

export type Concept = typeof concepts.$inferSelect;
export type NewConcept = typeof concepts.$inferInsert;

export type ConceptAlias = typeof conceptAliases.$inferSelect;
export type NewConceptAlias = typeof conceptAliases.$inferInsert;

export type ConceptDefinitionVersion = typeof conceptDefinitionVersions.$inferSelect;
export type NewConceptDefinitionVersion = typeof conceptDefinitionVersions.$inferInsert;

export type ConceptRelationship = typeof conceptRelationships.$inferSelect;
export type NewConceptRelationship = typeof conceptRelationships.$inferInsert;

export type ConceptEvidence = typeof conceptEvidence.$inferSelect;
export type NewConceptEvidence = typeof conceptEvidence.$inferInsert;

export type TermCandidate = typeof termCandidates.$inferSelect;
export type NewTermCandidate = typeof termCandidates.$inferInsert;

export type DefinitionReview = typeof definitionReviews.$inferSelect;
export type NewDefinitionReview = typeof definitionReviews.$inferInsert;

export type Config = typeof config.$inferSelect;
export type NewConfig = typeof config.$inferInsert;
