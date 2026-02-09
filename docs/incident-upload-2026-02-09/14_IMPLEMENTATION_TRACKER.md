# Implementation Tracker

Status legend:
- `planned`
- `in_progress`
- `blocked`
- `done`

## Current sprint goal
Fix missing `x-user-email` propagation in browser API requests.

## Task board
1. `done` Define client identity source policy.
2. `done` Implement `src/lib/api/client-request.ts`.
3. `done` Migrate `src/components/ingest/FileUploader.tsx`.
4. `done` Migrate `src/components/ingest/FileList.tsx`.
5. `done` Migrate `src/components/chat/ChatPanel.tsx`.
6. `done` Run `tsc`, tests, build.
7. `in_progress` Deploy and verify in production browser (deploy and API smoke done, browser verification pending).
8. `planned` Record closure evidence and update handoff docs.

## Blockers
- None currently.

## Dependencies
- Valid email source available on client at runtime.
- Target email has admin permissions where required.

## Exit criteria
- Upload/chat/document flows pass in production.
- No missing identity errors in fresh attempts.
- Tracker items 1-8 marked `done`.
