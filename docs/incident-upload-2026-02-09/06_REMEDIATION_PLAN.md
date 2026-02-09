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
