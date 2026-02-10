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
- [ ] Viewer badge reports highlight mode (`bbox` or `context-text`).
- [ ] Coarse fallback still renders safely when text-layer narrowing fails.
- [ ] Post-reingest checks confirm improved precision on newly uploaded docs.

## API smoke checks (production CLI)
- [x] `POST /api/ingest` with `x-user-email` returns success.
- [x] `GET /api/history?limit=1` with `x-user-email` returns success.
- [x] `GET /api/history?limit=1` without header returns `AUTH_UNAUTHORIZED`.

## Regression checks
- [x] Existing parser tests still pass.
- [x] No auth regressions on protected endpoints in automated local checks.
