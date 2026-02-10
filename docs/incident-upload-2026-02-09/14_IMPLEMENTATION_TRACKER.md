# Implementation Tracker

Status legend:
- `planned`
- `in_progress`
- `blocked`
- `done`

## Current sprint goal
Fix missing `x-user-email` propagation in browser API requests.

## Task board
1. `done` Define client identity source policy.
2. `done` Implement `src/lib/api/client-request.ts`.
3. `done` Migrate `src/components/ingest/FileUploader.tsx`.
4. `done` Migrate `src/components/ingest/FileList.tsx`.
5. `done` Migrate `src/components/chat/ChatPanel.tsx`.
6. `done` Run `tsc`, tests, build.
7. `in_progress` Deploy and verify in production browser (deploy and API smoke done, browser verification pending).
8. `planned` Record closure evidence and update handoff docs.

## Blockers
- None currently.

## Dependencies
- Valid email source available on client at runtime.
- Target email has admin permissions where required.

## Exit criteria
- Upload/chat/document flows pass in production.
- No missing identity errors in fresh attempts.
- Tracker items 1-8 marked `done`.

## RAG v2 follow-up track (2026-02-10)
1. `done` Add `v1/v2` runtime switch and cache namespace isolation.
2. `done` Add RAG v2 docs/log skeleton under `docs/rag-v2/`.
3. `done` Add Postgres graph-memory schema + migration scaffolding.
4. `done` Add v2 query-flow scaffolding (term detect, rewrite, graph expansion, strict fail path).
5. `done` Add API contract extensions (`contextScope`, `effectiveAt`, `ambiguityPolicy`, response metadata).
6. `done` Add v2 feature flags + backend kill-switch.
7. `done` Add term-candidate ingestion scaffolding and review workflow helpers.
8. `in_progress` Expand integration coverage and runtime validation checklist.

## PDF highlight precision remediation track (2026-02-10)
1. `done` Confirm strategy (`end-to-end`) and rollout decision (`full reupload/reingest`).
2. `done` Implement page-local chunk block matching in `src/lib/ingest/chunker.ts`.
3. `done` Harden highlight metadata generation in `src/lib/ingest/pipeline.ts`.
4. `done` Harden viewer coarse detection + context fallback + mode badge in `src/components/chat/PDFViewer.tsx`.
5. `done` Improve citation context propagation in `src/components/chat/ChatMessage.tsx`.
6. `done` Expand bbox diagnostic tooling in `scripts/check_bboxes.ts`.
7. `done` Run static gates and regression tests.
8. `in_progress` Reupload/reingest docs and complete runtime citation validation.
9. `done` Clear DB + reingest from Supabase storage (`72/72` processed, dedupe to `22` DB docs).
10. `done` Add viewer retry/suppress logic for coarse highlight race in `src/components/chat/PDFViewer.tsx`.
11. `in_progress` Final browser citation-click validation on known problematic query/PDF.

## PDF context-anchor deep-fix track (2026-02-10)
1. `done` Complete root-cause review (UI evidence + code path + DB metadata).
2. `done` Add dual-read data shape support for `highlightText` (schema/query/agents/API/client types).
3. `done` Add ingest snippet generation for `chunks.highlight_text`.
4. `done` Add DB migration scaffold for `highlight_text`.
5. `done` Replace viewer cache key with page + context + highlight signature.
6. `done` Implement region-first resolver with spatial validation gate in `PDFViewer`.
7. `done` Add deterministic `bbox-fallback` mode and debug reason codes.
8. `done` Add unit tests for context helper + geometry/signature utilities.
9. `in_progress` Browser regression matrix on known problematic citation flow.
10. `done` Run static gates (`tsc`, `lint`, `test:run`, `build`).
11. `planned` Dual-read rollout verification in production and incident closure note.

## DB schema alignment for ingest track (2026-02-10)
1. `done` Confirm real production error (`PG 42703`, `column "highlight_text" does not exist`).
2. `done` Confirm runtime insert path writes `chunks.highlight_text`.
3. `done` Apply production SQL hotfix (`ALTER TABLE public.chunks ADD COLUMN IF NOT EXISTS highlight_text text`).
4. `done` Verify column existence + read query success after hotfix.
5. `done` Run production ingest smoke (`POST /api/ingest`) and confirm `success: true`.
6. `done` Add schema preflight module (`src/lib/db/schema-health.ts`) with 60s cache.
7. `done` Wire preflight check into ingest route before pipeline processing.
8. `done` Add explicit PG `42703` error mapping + `INGEST_SCHEMA_MISMATCH` response path.
9. `done` Add strict guardrail script (`scripts/check_ingest_schema.ts`) + npm script.
10. `done` Production deploy + post-deploy ingest validation for hardening patch.
