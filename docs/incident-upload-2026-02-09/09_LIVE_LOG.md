# Live Log

Use this file as append-only progress log.

## 2026-02-09
- Created incident documentation bundle for cross-window continuity.
- Confirmed root cause path: missing `x-user-email` in client fetch calls.
- Confirmed production ingest works when header is provided manually.
- Confirmed parser file has local modifications under active validation.
- User requested explicit implementation plan before code fix execution.
- User requested continuous markdown evidence across chat windows.
- Added implementation tracker and conversation context docs to support that process.
- Locked next action: implement shared client API helper and migrate target fetch call sites.
- Implemented shared helper `src/lib/api/client-request.ts` with identity resolution and `apiFetch`.
- Migrated API calls in `src/components/ingest/FileUploader.tsx`.
- Migrated API calls in `src/components/ingest/FileList.tsx`.
- Migrated API calls in `src/components/chat/ChatPanel.tsx`.
- Ran verification gates:
  - `npx tsc --noEmit --incremental false` passed.
  - `npm run test:run` passed (27 tests).
  - `npm run build` passed.
- Current status: ready for runtime validation (local browser + production browser).
- Deployed production build:
  - `https://wenkugpt-copy-96rf8aw2g-nerotinys-projects.vercel.app`
  - Alias `https://wenkugpt-copy.vercel.app` points to this deployment.
- Production ingest API smoke check with header passed:
  - `POST /api/ingest` returned `success: true`.
- Production history API smoke checks:
  - With header: `GET /api/history?limit=1` returned `success: true`.
  - Without header: `GET /api/history?limit=1` returned `AUTH_UNAUTHORIZED`.
- Remaining validation: browser-based upload/chat flow confirmation with new frontend header injection.
- Added temporary compatibility fallback in client helper when env/storage identity is missing:
  - fallback email: `admin@example.com`.
- Re-ran verification gates after fallback change:
  - `npx tsc --noEmit --incremental false` passed.
  - `npm run test:run` passed (27 tests).
  - `npm run build` passed.
- Deployed updated build:
  - `https://wenkugpt-copy-jh17adf7h-nerotinys-projects.vercel.app`
  - Alias `https://wenkugpt-copy.vercel.app` now points to this deployment.
- Re-ran production API smoke checks:
  - `POST /api/ingest` with header returned `success: true`.
  - `GET /api/history?limit=1` with header returned `success: true`.
  - `GET /api/history?limit=1` without header returned `AUTH_UNAUTHORIZED`.
- Remaining validation: explicit browser UX check (upload/chat/list/delete/preview) on the deployed frontend.
- User reported confusing file names in library (storage key visible in UI).
- Root cause confirmed: ingest stores `filename` as internal storage key format `userId_uuid_safeFilename`.
- UI refinement implemented in `src/components/ingest/FileList.tsx`:
  - display now strips technical prefix when pattern matches UUID_UUID_name.
  - filtering now works with both display filename and raw stored filename.
  - preview modal title uses cleaned display filename.
- Re-ran local gates after UI refinement:
  - `npx tsc --noEmit --incremental false` passed.
  - `npm run test:run` passed (27 tests).
  - `npm run build` passed.
- Deployed UI filename refinement:
  - `https://wenkugpt-copy-22h90gzbc-nerotinys-projects.vercel.app`
  - alias `https://wenkugpt-copy.vercel.app` updated.

- Closed UI/docs follow-up:
  - fixed chat history class typo `truncat` -> `truncate` in `src/components/chat/ChatPanel.tsx`.
  - removed obsolete `ALLOW_HEADERLESS_AUTH` from `.env.example`.
  - documented unsupported status of `ALLOW_HEADERLESS_AUTH` in `README.md` and `docs/api.md`.
  - updated risk register entry for env/docs drift as resolved.
- EOD handoff prepared for 2026-02-10: `17_EOD_HANDOFF_2026-02-09.md` with summary, open items, and restart checklist.

## 2026-02-10
- Started RAG v2 implementation track (`Slang-aware Context Graph Memory`) on branch `feat/rag-engine-switch`.
- Added dedicated v2 documentation and append-only live log under `docs/rag-v2/`.
- Implemented v2 graph-memory schema + migration, query flow scaffolding, feature flags, and API wiring.
- Extended Settings payload for scoped/temporal/ambiguity controls.
- Validation after v2 implementation:
  - `npx tsc --noEmit --incremental false` passed.
  - `npm run lint` passed.
  - `npm run test:run` passed (32 tests).
## Next log entry template
- Date:
- Change made:
- Files touched:
- Verification run:
- Result:
- New risk or blocker:
- Next action:

