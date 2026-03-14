-- ============================================================================
-- WENKUGPT: Migrate FTS from 'simple' to 'czech' dictionary
-- Run this migration to enable proper Czech stemming and stop words
-- ============================================================================

-- 1. Update the trigger function to use 'czech' dictionary
CREATE OR REPLACE FUNCTION update_chunk_fts_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.fts_vector := to_tsvector('czech', COALESCE(NEW.content, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Update the hybrid_search function to use 'czech' dictionary
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
    ts_rank(c.fts_vector, plainto_tsquery('czech', query_text))::float as fts_rank,
    similarity(c.content, query_text)::float as trgm_score
  FROM chunks c
  WHERE
    c.access_level = user_access_level
    AND (
      (1 - (c.embedding <=> query_embedding)) > match_threshold
      OR similarity(c.content, query_text) > 0.3
    )
  ORDER BY
    (1 - (c.embedding <=> query_embedding)) * 0.6 +
    ts_rank(c.fts_vector, plainto_tsquery('czech', query_text)) * 0.25 +
    similarity(c.content, query_text) * 0.15 DESC
  LIMIT match_count;
END;
$$;

-- 3. Reindex all existing chunks with the 'czech' dictionary
UPDATE chunks SET fts_vector = to_tsvector('czech', COALESCE(content, ''));
