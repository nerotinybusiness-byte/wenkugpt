-- ============================================================================
-- WENKUGPT: PostgreSQL Extensions and Indexes
-- Run this BEFORE drizzle migrations on Supabase
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;      -- pgvector for embeddings
CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- Trigram fuzzy matching for Czech typos

-- ============================================================================
-- HNSW Index for fast Approximate Nearest Neighbor search on embeddings
-- This is the most critical index for RAG performance
-- ============================================================================

-- Create HNSW index on chunks.embedding
-- m = 16: number of bi-directional links (good for 768d vectors)
-- ef_construction = 64: build-time accuracy (higher = better but slower)
CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw_idx 
ON chunks 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- ============================================================================
-- GIN Indexes for Full-Text and Trigram Search
-- ============================================================================

-- Czech full-text search index
CREATE INDEX IF NOT EXISTS chunks_fts_gin_idx 
ON chunks 
USING GIN (fts_vector);

-- Trigram index for fuzzy matching ("bosbag" -> "bossbag")
CREATE INDEX IF NOT EXISTS chunks_trgm_gin_idx 
ON chunks 
USING GIN (content gin_trgm_ops);

-- ============================================================================
-- Semantic Cache HNSW Index (for query similarity)
-- ============================================================================

CREATE INDEX IF NOT EXISTS semantic_cache_embedding_hnsw_idx 
ON semantic_cache 
USING hnsw (query_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- ============================================================================
-- HYBRID SEARCH RPC FUNCTION
-- Combines: Vector Similarity (60%) + Czech FTS (25%) + Trigram (15%)
-- ============================================================================

CREATE OR REPLACE FUNCTION hybrid_search(
  query_embedding vector(768),
  query_text text,
  match_threshold float DEFAULT 0.85,
  match_count int DEFAULT 20,
  user_access_level text DEFAULT 'public'
)
RETURNS TABLE (
  id uuid,
  content text,
  page_number int,
  bounding_box jsonb,
  parent_header text,
  document_id uuid,
  similarity float,
  fts_rank float,
  trgm_score float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.content,
    c.page_number,
    c.bounding_box,
    c.parent_header,
    c.document_id,
    (1 - (c.embedding <=> query_embedding))::float as similarity,
    ts_rank(c.fts_vector, plainto_tsquery('simple', query_text))::float as fts_rank,
    similarity(c.content, query_text)::float as trgm_score
  FROM chunks c
  WHERE 
    c.access_level = user_access_level
    AND (
      (1 - (c.embedding <=> query_embedding)) > match_threshold
      OR similarity(c.content, query_text) > 0.3  -- Trigram fallback for typos
    )
  ORDER BY 
    (1 - (c.embedding <=> query_embedding)) * 0.6 + 
    ts_rank(c.fts_vector, plainto_tsquery('simple', query_text)) * 0.25 +
    similarity(c.content, query_text) * 0.15 DESC
  LIMIT match_count;
END;
$$;

-- ============================================================================
-- HELPER: Update FTS vector on chunk insert/update
-- Uses 'simple' config instead of 'czech' for broader compatibility
-- ============================================================================

CREATE OR REPLACE FUNCTION update_chunk_fts_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.fts_vector := to_tsvector('simple', COALESCE(NEW.content, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for automatic FTS vector updates
DROP TRIGGER IF EXISTS chunks_fts_update ON chunks;
CREATE TRIGGER chunks_fts_update
  BEFORE INSERT OR UPDATE OF content ON chunks
  FOR EACH ROW
  EXECUTE FUNCTION update_chunk_fts_vector();

-- ============================================================================
-- SEMANTIC CACHE HELPER: Find similar cached queries
-- ============================================================================

CREATE OR REPLACE FUNCTION find_cached_response(
  query_embedding vector(768),
  similarity_threshold float DEFAULT 0.95
)
RETURNS TABLE (
  id uuid,
  response text,
  chunk_ids uuid[],
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sc.id,
    sc.response,
    sc.chunk_ids,
    (1 - (sc.query_embedding <=> query_embedding))::float as similarity
  FROM semantic_cache sc
  WHERE 
    sc.expires_at > NOW()
    AND (1 - (sc.query_embedding <=> query_embedding)) > similarity_threshold
  ORDER BY similarity DESC
  LIMIT 1;
END;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) Policies
-- Enable for multi-tenant access control
-- ============================================================================

-- Enable RLS on sensitive tables
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE config ENABLE ROW LEVEL SECURITY;

-- Documents: Users can only see their own + public documents
CREATE POLICY documents_select_policy ON documents
  FOR SELECT
  USING (
    access_level = 'public' 
    OR user_id = auth.uid()
  );

CREATE POLICY documents_insert_policy ON documents
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY documents_update_policy ON documents
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY documents_delete_policy ON documents
  FOR DELETE
  USING (user_id = auth.uid());

-- Chunks: Inherit access from parent document
CREATE POLICY chunks_select_policy ON chunks
  FOR SELECT
  USING (
    access_level = 'public'
    OR document_id IN (
      SELECT id FROM documents WHERE user_id = auth.uid()
    )
  );

-- Audit logs: Users can only see their own logs
CREATE POLICY audit_logs_select_policy ON audit_logs
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY audit_logs_insert_policy ON audit_logs
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Config: Users can only access their own config
CREATE POLICY config_all_policy ON config
  FOR ALL
  USING (user_id = auth.uid());
