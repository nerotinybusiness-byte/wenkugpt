# RAG v2 Index

Date: 2026-02-10  
Status: in progress  
Owner: tom + codex

## Purpose
Track design and implementation of `RAG v2 (Slang-aware Context Graph Memory)` with decision traceability.

## Documents
- `docs/rag-v2/01_LIVE_LOG.md` - append-only execution log
- `docs/rag-v2/02_ADR.md` - architecture decision records
- `docs/rag-v2/03_DATA_MODEL.md` - graph-memory schema and invariants
- `docs/rag-v2/04_INGEST.md` - term/definition ingestion workflow
- `docs/rag-v2/05_QUERY_FLOW.md` - runtime query interpretation flow
- `docs/rag-v2/06_TEST_PLAN.md` - test matrix and acceptance gates
- `docs/rag-v2/07_ROLLOUT.md` - staged rollout and rollback controls

## Logging Rule
Every significant change must append to `01_LIVE_LOG.md` with:
- date/time
- change
- files touched
- validation run
- result
- risk/blocker
- next action
