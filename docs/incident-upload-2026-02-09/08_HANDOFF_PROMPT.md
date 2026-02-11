# Handoff Prompt (Paste into Next Window)

Use this exact brief to continue without re-discovery:

---
Continue incident resolution for upload/chat failures.

Context:
- Incident folder: `docs/incident-upload-2026-02-09/`
- Read in order: `01_EXEC_SUMMARY.md`, `04_ROOT_CAUSE.md`, `06_REMEDIATION_PLAN.md`, `07_VALIDATION_CHECKLIST.md`.
- OCR engine switch track added (2026-02-11): user-level `gemini`/`tesseract` selection for empty/low chunk OCR rescue.
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
1. Apply DB migration `drizzle/0007_ocr_engine_switch.sql` on target environment.
2. Verify ingest behavior for both OCR engine settings (`gemini`, `tesseract`) with warning-only failure semantics.
3. Run and record full gates: `npx tsc --noEmit --incremental false`, `npm run lint`, `npm run test:run`, `npm run build`.
4. Update `07_VALIDATION_CHECKLIST.md`, `14_IMPLEMENTATION_TRACKER.md`, and closure note in `09_LIVE_LOG.md`.

Constraints:
- Do not weaken production auth requirement.
- Keep docs current after each material change.
- Include exact file references and verification outputs in summaries.
---


Post-rollout update (2026-02-11):
1. Production DB migrations applied: `0005`, `0006`, `0007`.
2. Schema preflight check passed: `npm run db:check-ingest-schema` -> `ingest_schema_ok=true`.
3. OCR rescue smoke matrix passed on alias `https://wenkugpt-copy.vercel.app`:
   - OFF path warning-only (`ocr_rescue_disabled`).
   - ON+gemini success.
   - ON+tesseract success with warning-only unavailable behavior when provider unavailable.
4. Latest deployment:
   - `https://wenkugpt-copy-2a7ezi84x-nerotinys-projects.vercel.app`
   - deployment id `dpl_FjkzRouUgBSRjfyFCBYUr3m1H9EF`
   - alias `https://wenkugpt-copy.vercel.app` updated.
5. Immediate objective is now browser UX closure + telemetry monitoring, not DB migration rollout.
