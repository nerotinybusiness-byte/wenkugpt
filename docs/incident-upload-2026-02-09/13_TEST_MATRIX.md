# Test Matrix

## Unit/static checks
- TypeScript compile: pass
- Existing test suite: pass
- Build: pass

## Functional checks by endpoint
1. `POST /api/ingest`
- Scenario A: PDF upload with valid header -> 200 success
- Scenario B: TXT upload with valid header -> 200 success
- Scenario C: missing header -> 401 AUTH_UNAUTHORIZED

2. `GET /api/documents`
- Admin header -> success
- Missing header -> 401
- Non-admin header -> 403 (if enforced by auth role)

3. `DELETE /api/documents/:id`
- Admin header -> success
- Missing header -> 401

4. `GET /api/documents/:id/preview`
- Admin header -> success
- Missing header -> 401

5. `POST /api/chat`
- User header -> success
- Missing header -> 401

6. `GET /api/history`
- User header -> success
- Missing header -> 401

7. PDF citation highlight behavior
- Scenario A: coarse single-box citation -> viewer narrows highlight using context-text fallback.
- Scenario B: coarse multi-box citation -> viewer narrows highlight using context-text fallback.
- Scenario C: text-layer mismatch -> viewer keeps bbox fallback and remains usable.
- Scenario D: post-reingest citations -> highlight stays localized (no page-wide overlay).

8. PDF context-anchor regression matrix (2026-02-10 deep-fix)
- Scenario A: inline citation on known problematic PDF page -> localized paragraph anchor, no top-strip.
- Scenario B: footer citation on same source/page -> localized paragraph anchor, no top-strip.
- Scenario C: two different citations on same page -> no stale cache reuse across clicks.
- Scenario D: context validation failure -> deterministic `bbox-fallback` badge and usable coarse highlight.
- Scenario E: zoom at `100%` vs `125%` -> same anchor quality and same mode behavior.

## Browser checks
- Fresh page load, clear stale upload queue
- Upload one new PDF and one TXT
- Send one chat message
- Open history menu
- Delete one doc and preview one doc

## Production checks
- Validate against deployed alias after release
- Confirm no `Missing identity header` messages in UI
- Confirm no new `DOMMatrix is not defined` on fresh uploads
- Confirm known problematic citation (`kde je sklad wenku?`) highlights only target region after reingest
