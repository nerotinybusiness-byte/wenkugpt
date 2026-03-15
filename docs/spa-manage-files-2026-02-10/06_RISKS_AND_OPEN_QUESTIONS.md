# Risks and Open Questions

## Risks
1. Nested overlay behavior (`ManageFilesDialog` + File preview modal) may have z-index/focus-trap conflicts.
- Mitigation: preview overlay rendering moved to `document.body` via `createPortal` with elevated `z-index`.
- Status: mitigated in code; runtime confirmation pending.

2. Responsive usability risk on smaller screens due to dense split layout in modal.
- Mitigation: enforce mobile-first width/height constraints and internal scrolling without horizontal overflow.
- Status: open (manual browser validation pending).

3. Functional drift risk between `/files` and modal UI if layout logic diverges later.
- Mitigation: centralize content in shared `KnowledgeBaseWorkspace`.
- Status: mitigated in code.

## Open confirmations
1. Legacy `/files` remains direct-URL fallback only, no visible fallback link in new modal.
- Decision: confirmed.

2. Manage Files modal visual style follows existing Settings dialog conventions.
- Decision: confirmed.
