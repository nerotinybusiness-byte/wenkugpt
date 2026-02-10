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
