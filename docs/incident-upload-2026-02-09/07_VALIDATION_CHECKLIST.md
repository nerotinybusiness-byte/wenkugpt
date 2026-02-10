# Validation Checklist

## Pre-implementation checks
- [x] Confirm expected active user email strategy to send in `x-user-email`.
- [ ] Confirm admin allowlist contains active runtime email for ingest/doc APIs.

## Implementation checks
- [x] Shared client request helper added.
- [x] All target components migrated.
- [x] No raw `/api/*` fetch calls left in migrated components.

## Local quality gates
- [x] `npx tsc --noEmit --incremental false` passes.
- [x] `npm run test:run` passes.
- [x] `npm run build` passes.

## Runtime checks (local)
- [ ] Upload TXT succeeds.
- [ ] Upload PDF succeeds.
- [ ] Documents list loads.
- [ ] Document preview loads.
- [ ] Delete document works.
- [ ] Chat send works.
- [ ] History load and clear works.

## Runtime checks (production)
- [ ] Upload TXT succeeds.
- [ ] Upload PDF succeeds.
- [ ] Chat send works.
- [ ] No `Missing identity header` errors.
- [ ] No `DOMMatrix is not defined` on new attempts.

## PDF highlight precision checks (2026-02-10)
- [x] Documents table cleared before validation reingest.
- [x] Full storage reingest completed (`72/72` files processed, dedupe to `22` documents in DB).
- [x] Smoke query `kde je sklad wenku?` returns relevant Wenku citations.
- [ ] Citation click no longer paints full page on known problematic PDF.
- [ ] Inline citation click narrows to the correct text block/line.
- [ ] Footer citation click narrows similarly.
- [ ] Two different citations on the same page do not reuse stale context highlight.
- [ ] Viewer badge reports highlight mode (`bbox` or `context-text`).
- [ ] Coarse fallback still renders safely when text-layer narrowing fails.
- [ ] Fallback mode is explicitly reported as `bbox-fallback` when spatial validation rejects context anchor.
- [ ] Known problematic case no longer shows top-strip false anchor on page `3/4`.
- [ ] Zoom regression check: behavior consistent at `100%` and `125%`.
- [ ] Post-reingest checks confirm improved precision on newly uploaded docs.

## API smoke checks (production CLI)
- [x] `POST /api/ingest` with `x-user-email` returns success.
- [x] `GET /api/history?limit=1` with `x-user-email` returns success.
- [x] `GET /api/history?limit=1` without header returns `AUTH_UNAUTHORIZED`.

## DB schema-alignment checks (`highlight_text`, 2026-02-10)
- [x] `public.chunks.highlight_text` exists in `information_schema.columns`.
- [x] Read-only query `select highlight_text from public.chunks limit 1` succeeds.
- [x] Production ingest smoke after hotfix returns success (no `INGEST_FAILED`).
- [x] `npm run db:check-ingest-schema` passes in strict mode on deployment target.

## Ingest hardening checks
- [ ] `POST /api/ingest` fails fast with `INGEST_SCHEMA_MISMATCH` when required column is missing.
- [ ] Error message explicitly points to missing migration for `chunks.highlight_text` on PG `42703`.

## Regression checks
- [x] Existing parser tests still pass.
- [x] No auth regressions on protected endpoints in automated local checks.
