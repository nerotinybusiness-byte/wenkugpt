# Executive Summary

## Incident summary
Users cannot reliably upload files in the Knowledge Base UI.
Observed UI errors include:
- `DOMMatrix is not defined`
- `Missing identity header. Set x-user-email.`

## Current truth (as of 2026-02-09)
1. The backend auth layer in production requires `x-user-email` header.
2. Multiple frontend API calls do not include this header.
3. Production ingest endpoint works when called with explicit `x-user-email`.
4. Prior parser/runtime issue existed, but auth header gap is currently the dominant blocker for user flows.

## Impact
- Upload flow (`POST /api/ingest`) can fail from browser.
- Chat flow (`POST /api/chat`, `GET /api/history`) can fail from browser.
- Admin document list and deletion flows can fail (`/api/documents*`).

## Severity
High (core product flows broken for normal browser usage in production).

## Scope
Affected areas in client code:
- `src/components/ingest/FileUploader.tsx`
- `src/components/ingest/FileList.tsx`
- `src/components/chat/ChatPanel.tsx`

## Primary remediation target
Create one browser API wrapper that:
- Resolves active user email (deterministic strategy).
- Injects `x-user-email` on all `/api/*` requests.
- Is used by all relevant components.

## Done definition
- All relevant client API calls include `x-user-email`.
- Upload and chat succeed in production browser session.
- No regressions in `tsc`, tests, build.
- Incident log updated in this folder.
