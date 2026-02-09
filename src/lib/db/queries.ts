/**
 * WENKUGPT - Hybrid Search Queries
 * 
 * Combines vector similarity search (pgvector <=>)
 * with full-text search in Czech (tsvector/tsquery).
 */

import { db } from './index';
import { chunks, documents } from './schema';
import { sql } from 'drizzle-orm';
import { embedText } from '@/lib/ingest/embedder';
import { devLog } from '@/lib/logger';

/**
 * Search result with relevance scores
 */
export interface SearchResult {
  /** Chunk ID */
  id: string;
  /** Document ID */
  documentId: string;
  /** Chunk content */
  content: string;
  /** Page number */
  pageNumber: number;
  /** Bounding box for Golden Glow highlight */
  boundingBox: { x: number; y: number; width: number; height: number } | null;
  /** Parent header hierarchy */
  parentHeader: string | null;
  /** Vector similarity score (0-1, higher is better) */
  vectorScore: number;
  /** Full-text search rank (0-1, higher is better) */
  textScore: number;
  /** Combined score */
  combinedScore: number;
  /** Token count */
  tokenCount: number;
  /** Source document filename */
  filename?: string;
}

/**
 * Hybrid search configuration
 */
export interface HybridSearchConfig {
  /** Maximum results to return */
  limit: number;
  /** Minimum combined score threshold (0-1) */
  minScore: number;
  /** Weight for vector similarity (0-1) */
  vectorWeight: number;
  /** Weight for text search (0-1, should sum to 1 with vectorWeight) */
  textWeight: number;
  /** User ID for access filtering */
  userId?: string;
}

/**
 * Default search configuration
 */
export const DEFAULT_SEARCH_CONFIG: HybridSearchConfig = {
  limit: 20,
  minScore: 0.3,
  vectorWeight: 0.7,
  textWeight: 0.3,
  userId: undefined,
};

/**
 * Raw row type from hybrid search query
 */
interface HybridSearchRow {
  id: string;
  document_id: string;
  content: string;
  page_number: number;
  bounding_box: { x: number; y: number; width: number; height: number } | null;
  parent_header: string | null;
  token_count: number;
  vector_score: number;
  text_score: number;
  combined_score: number;
  filename: string;
}

/**
 * Perform hybrid search combining vector and full-text search
 * 
 * @param query - User's search query in Czech
 * @param config - Search configuration
 * @returns Ranked search results
 */
export async function hybridSearch(
  query: string,
  config: HybridSearchConfig = DEFAULT_SEARCH_CONFIG
): Promise<SearchResult[]> {
  const { limit, minScore, vectorWeight, textWeight, userId } = config;

  devLog(`\n🔍 Hybrid Search: "${query.slice(0, 50)}..."`);

  // Step 1: Generate query embedding
  devLog('   📊 Generating query embedding...');
  const queryEmbedding = await embedText(query);
  const embeddingStr = `'[${queryEmbedding.join(',')}]'::vector(768)`;

  // Step 2: Execute hybrid search query
  devLog('   🔎 Executing hybrid search...');

  // Build the raw SQL for hybrid search
  // drizzle execute() with node-postgres returns a QueryResult object, not an array
  const result = await db.execute(sql`
    WITH query_embedding AS (
      SELECT ${sql.raw(embeddingStr)} AS embedding
    ),
    vector_search AS (
      SELECT 
        c.id,
        c.document_id,
        c.content,
        c.page_number,
        c.bounding_box,
        c.parent_header,
        c.token_count,
        1 - (c.embedding <=> (SELECT embedding FROM query_embedding)) AS vector_score
      FROM ${chunks} c
      JOIN ${documents} d ON c.document_id = d.id
      WHERE d.processing_status = 'completed'
      ${userId ? sql`AND (d.access_level = 'public' OR d.user_id = ${userId})` : sql``}
      ORDER BY c.embedding <=> (SELECT embedding FROM query_embedding)
      LIMIT ${limit * 2}
    ),
    text_search AS (
      SELECT 
        c.id,
        ts_rank_cd(
          c.fts_vector,
          plainto_tsquery('simple', ${query})
        ) AS text_score
      FROM ${chunks} c
      WHERE c.fts_vector @@ plainto_tsquery('simple', ${query})
    )
    SELECT 
      v.id,
      v.document_id,
      v.content,
      v.page_number,
      v.bounding_box,
      v.parent_header,
      v.token_count,
      v.vector_score,
      COALESCE(t.text_score, 0) AS text_score,
      (${vectorWeight} * v.vector_score + ${textWeight} * COALESCE(t.text_score, 0)) AS combined_score,
      d.filename
    FROM vector_search v
    LEFT JOIN text_search t ON v.id = t.id
    JOIN ${documents} d ON v.document_id = d.id
    WHERE (${vectorWeight} * v.vector_score + ${textWeight} * COALESCE(t.text_score, 0)) >= ${minScore}
    ORDER BY combined_score DESC
    LIMIT ${limit}
  `);

  // Handle both array (postgres.js) and QueryResult (node-postgres)
  const rows = Array.isArray(result) ? result : result.rows;

  devLog(`   ✓ Found ${rows.length} results`);

  // Transform to SearchResult objects
  return (rows as unknown as HybridSearchRow[]).map(row => ({
    id: row.id,
    documentId: row.document_id,
    content: row.content,
    pageNumber: row.page_number,
    boundingBox: row.bounding_box,
    parentHeader: row.parent_header,
    vectorScore: Number(row.vector_score),
    textScore: Number(row.text_score),
    combinedScore: Number(row.combined_score),
    tokenCount: row.token_count,
    filename: row.filename,
  }));
}

/**
 * Simple vector-only search (faster, for when full-text isn't needed)
 */
export async function vectorSearch(
  query: string,
  limit: number = 10
): Promise<SearchResult[]> {
  const queryEmbedding = await embedText(query);
  const embeddingStr = `'[${queryEmbedding.join(',')}]'::vector(768)`;

  const result = await db.execute(sql`
    SELECT 
      c.id,
      c.document_id,
      c.content,
      c.page_number,
      c.bounding_box,
      c.parent_header,
      c.token_count,
      1 - (c.embedding <=> ${sql.raw(embeddingStr)}) AS vector_score,
      d.filename
    FROM ${chunks} c
    JOIN ${documents} d ON c.document_id = d.id
    WHERE d.processing_status = 'completed'
    ORDER BY c.embedding <=> ${sql.raw(embeddingStr)}
    LIMIT ${limit}
  `);

  const rows = Array.isArray(result) ? result : result.rows;

  return (rows as unknown as Array<{
    id: string;
    document_id: string;
    content: string;
    page_number: number;
    bounding_box: { x: number; y: number; width: number; height: number } | null;
    parent_header: string | null;
    token_count: number;
    vector_score: number;
    filename: string;
  }>).map(row => ({
    id: row.id,
    documentId: row.document_id,
    content: row.content,
    pageNumber: row.page_number,
    boundingBox: row.bounding_box,
    parentHeader: row.parent_header,
    vectorScore: Number(row.vector_score),
    textScore: 0,
    combinedScore: Number(row.vector_score),
    tokenCount: row.token_count,
    filename: row.filename,
  }));
}

/**
 * Get chunk by ID (for citation lookup)
 */
export async function getChunkById(chunkId: string): Promise<SearchResult | null> {
  const result = await db.execute(sql`
    SELECT 
      c.id,
      c.document_id,
      c.content,
      c.page_number,
      c.bounding_box,
      c.parent_header,
      c.token_count,
      d.filename
    FROM ${chunks} c
    JOIN ${documents} d ON c.document_id = d.id
    WHERE c.id = ${chunkId}
    LIMIT 1
  `);

  const rows = Array.isArray(result) ? result : result.rows;

  if (rows.length === 0) return null;

  const row = rows[0] as unknown as {
    id: string;
    document_id: string;
    content: string;
    page_number: number;
    bounding_box: { x: number; y: number; width: number; height: number } | null;
    parent_header: string | null;
    token_count: number;
    filename: string;
  };
  return {
    id: row.id,
    documentId: row.document_id,
    content: row.content,
    pageNumber: row.page_number,
    boundingBox: row.bounding_box,
    parentHeader: row.parent_header,
    vectorScore: 1,
    textScore: 0,
    combinedScore: 1,
    tokenCount: row.token_count,
    filename: row.filename,
  };
}
