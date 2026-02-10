# Remediation Plan

## Objective
Restore production browser upload/chat flows by enforcing reliable client identity header propagation while preserving strict backend auth.

## Constraints
- Do not weaken production auth requirement.
- Keep parser patch in `src/lib/ingest/parser.ts` unless disproven by validation.
- Keep documentation current after each material step.

## Phase 0 - Preflight
Status: Done

Tasks:
1. Confirm active email to be sent in `x-user-email`.
2. Confirm this email has expected role for protected endpoints.
3. Confirm where email should come from on client (temporary plus long-term).

Output:
- Clear identity source policy recorded in docs.

## Phase 1 - Shared client request helper
Status: Done

Tasks:
1. Create `src/lib/api/client-request.ts`.
2. Implement:
   - email resolver
   - header merge function
   - `apiFetch()` wrapper for `/api/*`
3. Ensure wrapper does not break `FormData` uploads.

Output:
- Single standard call path for browser requests.

## Phase 2 - Migrate call sites
Status: Done

Tasks:
1. Replace direct `fetch` in `src/components/ingest/FileUploader.tsx`.
2. Replace direct `fetch` in `src/components/ingest/FileList.tsx`.
3. Replace direct `fetch` in `src/components/chat/ChatPanel.tsx`.

Output:
- All target routes consistently send `x-user-email`.

## Phase 3 - Verification
Status: In progress

Tasks:
1. Run local gates:
   - `npx tsc --noEmit --incremental false`
   - `npm run test:run`
   - `npm run build`
2. Browser validation locally:
   - upload PDF/TXT
   - docs list/preview/delete
   - chat/history load/clear

Output:
- Local pass evidence in `09_LIVE_LOG.md`.

## Phase 4 - Deploy plus production validation
Status: In progress

Tasks:
1. Deploy production build.
2. Verify live browser flows.
3. Confirm no fresh `Missing identity header` and no fresh `DOMMatrix` errors.

Output:
- Incident closure readiness check.

## Phase 5 - Closure and hardening
Status: Planned

Tasks:
1. Align env docs (`ALLOW_HEADERLESS_AUTH` truth).
2. Add troubleshooting notes for operators.
3. Add postmortem summary and closure record.

Output:
- Operationally stable and documented system.

## Phase 6 - PDF citation highlight precision remediation (2026-02-10)
Status: In progress

Tasks:
1. Ingest matching fix:
   - enforce page-local block matching in `src/lib/ingest/chunker.ts`
   - prevent cross-page source block merges for chunk bbox generation
2. Highlight metadata hardening:
   - sanitize/deduplicate/merge/cap `highlightBoxes` in `src/lib/ingest/pipeline.ts`
3. Viewer fallback hardening:
   - coarse detection for both single and multi-box highlight sets
   - context-text narrowing fallback for coarse sets
   - visible mode badge (`bbox` vs `context-text`) for diagnostics
4. Verification:
   - run `npx tsc --noEmit --incremental false`, `npm run lint`, `npm run test:run`
   - run manual citation smoke test on known problematic query/doc
5. Data rollout:
   - clear old documents
   - reupload/reingest full document set
   - re-validate highlight precision

Output:
- Page-wide highlights no longer appear for targeted citation clicks on verified documents.

## Phase 7 - Context anchor correctness hardening (2026-02-10)
Status: In progress

Tasks:
1. Context payload narrowing:
   - inline citations use only local answer snippet
   - footer citations prefer ingest snippet (`highlightText`) and fallback to local answer snippet
2. Dual-read data rollout:
   - add nullable `chunks.highlight_text`
   - wire through query + agent + API payloads
3. Ingest snippet generation:
   - build `highlightText` from ordered source blocks (`y,x`), normalize whitespace, cap length
4. Viewer spatial validation hardening:
   - region-first candidate selection from coarse boxes
   - lexical + region coverage composite scoring
   - spatial gate before accepting `context-text`
   - deterministic `bbox-fallback` when spatial gate fails
5. Cache correctness:
   - key context cache by page + normalized context + highlight signature
6. Validation:
   - unit tests for context helpers and geometry helpers
   - manual browser smoke on known problematic PDF

Output:
- `context-text` is reported only for spatially valid anchors.
- Wrong top-strip anchors degrade to explicit `bbox-fallback` instead of false precision.
