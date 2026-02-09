# Handoff Prompt (Paste into Next Window)

Use this exact brief to continue without re-discovery:

---
Continue incident resolution for upload/chat failures.

Context:
- Incident folder: `docs/incident-upload-2026-02-09/`
- Read in order: `01_EXEC_SUMMARY.md`, `04_ROOT_CAUSE.md`, `06_REMEDIATION_PLAN.md`, `07_VALIDATION_CHECKLIST.md`.
- Root cause is confirmed: frontend `/api/*` fetch calls do not send required `x-user-email` header.
- Production backend works when header is present.
- `src/lib/ingest/parser.ts` already has local changes for pdf worker handling; keep them unless disproven.

Current implementation status:
1. Shared browser helper implemented: `src/lib/api/client-request.ts`.
2. Migrations complete in:
   - `src/components/ingest/FileUploader.tsx`
   - `src/components/ingest/FileList.tsx`
   - `src/components/chat/ChatPanel.tsx`
3. Local checks passed:
   - `npx tsc --noEmit --incremental false`
   - `npm run test:run`
   - `npm run build`
4. Latest production deploy:
   - `https://wenkugpt-copy-jh17adf7h-nerotinys-projects.vercel.app`
   - alias `https://wenkugpt-copy.vercel.app`
5. API smoke checks passed; browser UX verification remains.

Immediate objective:
1. Verify browser upload/chat flows on production UI.
2. Confirm no fresh `Missing identity header` and no fresh `DOMMatrix` error.
3. Update `07_VALIDATION_CHECKLIST.md` and `14_IMPLEMENTATION_TRACKER.md`.
4. Write closure note in `09_LIVE_LOG.md`.

Constraints:
- Do not weaken production auth requirement.
- Keep docs current after each material change.
- Include exact file references and verification outputs in summaries.
---
