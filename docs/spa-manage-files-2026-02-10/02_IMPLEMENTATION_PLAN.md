# Implementation Plan

## Title
SPA Manage Files in Chat Without `/files` Redirect

## Summary
Introduce a reusable `KnowledgeBaseWorkspace` component, preserve `/files` route using that workspace, and add a new `ManageFilesDialog` in chat so `Manage Files` opens in-place as a modal.

## Planned public interfaces
- `src/components/ingest/KnowledgeBaseWorkspace.tsx`
  - `className?: string`
  - `leftPaneClassName?: string`
  - `rightPaneClassName?: string`
- `src/components/chat/ManageFilesDialog.tsx`
  - `open: boolean`
  - `onOpenChange: (open: boolean) => void`

## Work phases
1. Documentation scaffold.
2. Shared workspace extraction from `/files` page.
3. New `ManageFilesDialog` implementation.
4. `ChatPanel` integration (replace redirect with modal open).
5. Validate preview layering inside modal and adjust if needed.
6. Run automated checks and finalize docs.

## Validation commands
1. `npx tsc --noEmit --incremental false`
2. `npm run lint`
3. `npm run test:run`
4. `npm run build`

## Execution status (2026-02-10)
- Implementation complete in code.
- All planned validation commands passed.
- Manual browser validation remains the last open step.
