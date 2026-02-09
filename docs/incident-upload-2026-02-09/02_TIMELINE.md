# Incident Timeline

Date baseline: 2026-02-09

## Timeline (ordered)
1. User reported inability to upload files in Knowledge Base UI.
2. UI showed repeated `DOMMatrix is not defined` errors for PDF uploads.
3. Additional UI evidence showed `Missing identity header. Set x-user-email.` from chat/API.
4. Backend parser path was patched and local parsing/tests/build were validated.
5. Production endpoint check with manual header (`x-user-email`) returned success for ingest.
6. Code search confirmed frontend requests to `/api/*` are missing identity header injection.
7. Root cause narrowed to frontend auth header propagation gap.
8. Next phase requested: continue investigation and produce robust markdown handoff docs.

## Timeline confidence
- High confidence on missing header root cause.
- Medium confidence that all remaining `DOMMatrix` messages are stale attempts; requires final browser verification after header fix.
