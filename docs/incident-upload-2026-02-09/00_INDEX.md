# Upload Incident Docs Index

Last Updated: 2026-02-09
Incident Scope: Upload failures in Knowledge Base UI (`DOMMatrix is not defined`) and API auth failures (`Missing identity header. Set x-user-email.`)
Status: Investigation active, root cause identified, implementation plan finalized, remediation pending implementation.

## Maintenance policy
This folder is a living runbook.
From this point forward, every major investigation or implementation step should be recorded here.
The objective is zero context loss across chat windows.

## Reading order
1. `01_EXEC_SUMMARY.md`
2. `04_ROOT_CAUSE.md`
3. `06_REMEDIATION_PLAN.md`
4. `14_IMPLEMENTATION_TRACKER.md`
5. `07_VALIDATION_CHECKLIST.md`
6. `08_HANDOFF_PROMPT.md`

## File map
- `01_EXEC_SUMMARY.md`: Current state, confirmed facts, impact.
- `02_TIMELINE.md`: Ordered event timeline.
- `03_EVIDENCE.md`: Repro details, code evidence, command evidence.
- `04_ROOT_CAUSE.md`: Technical causal analysis.
- `05_DECISIONS.md`: Decisions taken and open decisions.
- `06_REMEDIATION_PLAN.md`: Workstreams and concrete tasks.
- `07_VALIDATION_CHECKLIST.md`: Test checklist and go/no-go gates.
- `08_HANDOFF_PROMPT.md`: Paste-ready context prompt for next window.
- `09_LIVE_LOG.md`: Ongoing update log.
- `10_RISKS_AND_OPEN_QUESTIONS.md`: Risks, unknowns, required confirmations.
- `11_CODE_MAP.md`: Backend auth and frontend API call-site map.
- `12_IMPLEMENTATION_SPEC.md`: Shared client request helper contract.
- `13_TEST_MATRIX.md`: Functional verification matrix by endpoint.
- `14_IMPLEMENTATION_TRACKER.md`: Current task execution status.
- `15_CONVERSATION_CONTEXT.md`: Compact record of key user requests and decisions.

## Fast status snapshot
- Parser side: server-side PDF runtime handling has local patch in `src/lib/ingest/parser.ts`.
- Production API check: ingest succeeds when `x-user-email` is explicitly provided.
- Frontend side: key `/api/*` calls do not send `x-user-email`, causing auth failures in production.
- User-visible outcome: uploads and chat can fail even when backend endpoints are healthy.

## Immediate next action
Implement centralized client API helper that injects `x-user-email` and migrate all browser `fetch('/api/...')` calls to that helper.
