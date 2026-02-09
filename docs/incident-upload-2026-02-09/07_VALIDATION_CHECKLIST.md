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

## API smoke checks (production CLI)
- [x] `POST /api/ingest` with `x-user-email` returns success.
- [x] `GET /api/history?limit=1` with `x-user-email` returns success.
- [x] `GET /api/history?limit=1` without header returns `AUTH_UNAUTHORIZED`.

## Regression checks
- [x] Existing parser tests still pass.
- [x] No auth regressions on protected endpoints in automated local checks.
