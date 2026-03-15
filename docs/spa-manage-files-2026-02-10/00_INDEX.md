# SPA Manage Files Feature Docs Index

Last Updated: 2026-02-10
Feature Scope: Convert `Manage Files` action in chat menu from `/files` redirect to in-place SPA modal while keeping `/files` as legacy fallback route.
Status: Implemented in code; automated validation passed; manual browser validation pending.

## Maintenance policy
This folder is a living runbook for the SPA Manage Files implementation.
Record every material implementation, validation, and risk update to avoid context loss across chat windows.

## Reading order
1. `01_EXEC_SUMMARY.md`
2. `02_IMPLEMENTATION_PLAN.md`
3. `05_IMPLEMENTATION_TRACKER.md`
4. `04_VALIDATION_CHECKLIST.md`
5. `03_LIVE_LOG.md`
6. `06_RISKS_AND_OPEN_QUESTIONS.md`

## File map
- `01_EXEC_SUMMARY.md`: Current implementation state and outcome snapshot.
- `02_IMPLEMENTATION_PLAN.md`: Decision-complete plan being executed.
- `03_LIVE_LOG.md`: Append-only execution log.
- `04_VALIDATION_CHECKLIST.md`: Functional and regression validation checklist.
- `05_IMPLEMENTATION_TRACKER.md`: Task-by-task status tracker.
- `06_RISKS_AND_OPEN_QUESTIONS.md`: Risks, assumptions, and open confirmations.

## Fast status snapshot
- `Manage Files` in `ChatPanel` now opens an in-place modal (`ManageFilesDialog`) and no longer navigates to `/files`.
- Shared `KnowledgeBaseWorkspace` now powers both modal flow and `/files` route.
- Preview overlay in `FileList` was moved to `document.body` portal for safer layering inside nested dialog flow.
- Automated gates are green: `tsc`, `lint`, `test:run`, `build`.

## Immediate next action
Execute manual browser smoke matrix for modal flow parity and mobile UX.
