# RAG v2 Ingest

## Pipeline Overview
1. Source normalization
- normalize source metadata (`sourceType`, `documentId`, author/scope fields)

2. Candidate extraction
- pattern mining:
  - `říkáme tomu ...`
  - `interně tomu říkáme ...`
  - `aka`, `=`
- n-gram frequency fallback for repeated terms
- PDF highlight metadata precision guardrails:
  - chunk-to-block matching is page-local (no cross-page bbox merge)
  - per-chunk highlight boxes are sanitized/deduplicated and capped

3. Candidate persistence
- insert/update `term_candidates`
- maintain `frequency`, `confidence`, `contexts`

4. Human review
- reviewers approve/reject candidate
- approved path creates/updates:
  - `concepts`
  - `concept_aliases`
  - `concept_definition_versions`
  - `concept_evidence`
  - `definition_reviews`

## Runtime Integration
- `src/lib/ingest/pipeline.ts` runs candidate ingest when:
  - storage is enabled
  - `RAG_V2_GRAPH_ENABLED=true`

## Idempotency
- upsert behavior by normalized term + document key
- frequency increments instead of duplicate rows

## Operational note (2026-02-10)
- After ingest precision logic changes, legacy documents should be reuploaded/reingested to refresh stored bbox/highlight metadata.
