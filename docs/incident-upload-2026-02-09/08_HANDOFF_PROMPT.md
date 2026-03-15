# Handoff Prompt (Paste into Next Window)

Use this exact brief to continue without re-discovery:

---
Continue from latest production state of the upload/chat hardening + empty-state UX track.

Context:
1. Incident folder: `docs/incident-upload-2026-02-09/`
2. Read in order:
   - `01_EXEC_SUMMARY.md`
   - `04_ROOT_CAUSE.md`
   - `06_REMEDIATION_PLAN.md`
   - `14_IMPLEMENTATION_TRACKER.md`
   - `09_LIVE_LOG.md`
3. Core incident is already stabilized in production:
   - auth header propagation fixed,
   - schema drift fixed (migrations `0005`, `0006`, `0007`),
   - zero-chunk scan hardening shipped,
   - OCR engine switch (`gemini`/`tesseract`) shipped (warning-only policy retained).

Current implementation status (latest):
1. Empty-state suggestion system is live:
   - clickable suggestion cards in `src/components/chat/EmptyState.tsx`
   - random pool in `src/components/chat/suggestionPool.ts`
2. Motion/hover polish is live:
   - staggered entrance animation + refined timing in `src/app/globals.css`
3. Custom icon system is live:
   - registry in `src/components/chat/icons/custom/registry.tsx`
   - icon IDs in `src/components/chat/icons/custom/types.ts`
   - V2 icon refresh deployed (sport/apparel/lifestyle + generic/context/brand)
4. Rope icon was removed from active icon set:
   - deleted file `src/components/chat/icons/custom/IconSportRope.tsx`
   - removed from `types.ts` and `registry.tsx`
   - pool item remapped in `suggestionPool.ts`
5. Latest production deployment:
   - deployment id `dpl_9xtSkacA1E3YSw4pju88N54GwDiH`
   - URL `https://wenkugpt-copy-diwcxv4fg-nerotinys-projects.vercel.app`
   - alias `https://wenkugpt-copy.vercel.app`
6. Latest branch commit:
   - `a2dfadf` (`feat(ui): add liquid-glass chat bubble favicon`)
7. Local working-tree delta (not yet committed/deployed):
   - `src/components/chat/EmptyState.tsx`: hero title changed from `Liquid Glass Chat` to `WenkuGPT`.

Immediate objective:
1. Visual QA pass on alias for empty-state cards:
   - dark/light contrast
   - icon clarity at 1x/2x DPI
   - hover/motion smoothness
2. Tune suggestion/icon mapping only if user requests style/content changes.
3. Keep OCR runtime telemetry monitoring in parallel (no policy changes unless requested).
4. If branding rename is approved, commit/push/deploy the local `WenkuGPT` hero title patch and update logs.

Constraints:
1. Do not weaken production auth requirement.
2. Keep OCR rescue warning-only behavior.
3. Keep docs append-only and update `09/10/14/15` after each material UI change.
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

Zero-chunk scan hardening update (2026-02-11):
1. Root cause addressed for docs that reached `Ready` with `0` chunks.
2. OCR rescue now includes short-text re-chunk fallback (`minTokens=1`) before declaring no usable output.
3. If final chunk count is still zero, document is persisted as `failed` with explicit `processingError`.
4. Preview endpoint now returns explicit `DOCUMENT_PREVIEW_EMPTY` for failed docs without chunks.
5. Upload UI now maps ingest `stats.chunkCount === 0` to error state (not success) and file list disables preview for failed docs.
6. Validation gates are green (`tsc`, `lint`, `test:run`, `build`); deployment step follows.
7. Deployment completed:
   - commit `6f035cb`
   - `https://wenkugpt-copy-agizq24wt-nerotinys-projects.vercel.app`
   - alias `https://wenkugpt-copy.vercel.app` updated.

Empty-state UX update (2026-02-11, latest):
1. Conversational suggestions were added and iterated to liquid-glass visual parity.
2. Suggestion pool now renders 4 random cards from editable pool.
3. Custom inline SVG icon system introduced (`src/components/chat/icons/custom/*`) and then refreshed to V2.
4. Rope icon removed from V2 set and from active type registry.
5. Latest deploy carrying this state:
   - `https://wenkugpt-copy-diwcxv4fg-nerotinys-projects.vercel.app`
   - alias `https://wenkugpt-copy.vercel.app` ready.
6. Branding parity update:
   - favicon switched to liquid-glass chat bubble (`public/favicon.svg`, metadata in `src/app/layout.tsx`).
   - hero title text normalization to `WenkuGPT` is currently local and pending deployment.

Bejroska easter-egg follow-up (new immediate plan):
1. Current production symptom:
   - `Bejroska?` card triggers chat + overlay, but 3D hoodie model is often not visible.
2. Confirmed likely root causes from code:
   - `src/components/chat/BejroskaShowcase.tsx` loads `model-viewer` via `https://unpkg.com/...`.
   - production CSP in `src/proxy.ts` uses `script-src 'self' 'unsafe-inline'`, so external unpkg script is blocked.
   - overlay auto-closes after `3000ms` (`durationMs={3000}` in `src/components/chat/ChatPanel.tsx`), which is short for ~23MB GLB cold load.
3. Decision-complete implementation plan:
   1. Replace remote script loading with local package import:
      - add dependency `@google/model-viewer`
      - remove unpkg `<script>` injection logic
      - register model-viewer from local module inside client code
   2. Keep CSP strict (`script-src 'self'`) and do not whitelist unpkg.
   3. Extend overlay timing:
      - default from 3000ms to 8000ms OR close after `max(3000ms, model-ready)` with hard cap 12000ms.
      - preferred: model-ready close rule with hard cap.
   4. Keep fallback UI when GLB fails to load (no chat regression).
   5. Validate:
      - `npm run lint`
      - `npx tsc --noEmit --incremental false`
      - `npm run build`
      - manual production check on alias: card click => query sent + model visibly rendered.
4. Constraints:
   - no API/DB changes
   - keep `Send + Show together` behavior for `Bejroska?`
   - keep docs append-only (`09/10/14/15`) after fix deploy.

Bejroska easter-egg status refresh (2026-02-11, latest):
1. Deployed production alias currently points to:
   - deployment id `dpl_BoBmwbCDZmDHqaWRW6vmVvXG4TMW`
   - URL `https://wenkugpt-copy-8cuublfo0-nerotinys-projects.vercel.app`
   - alias `https://wenkugpt-copy.vercel.app`
2. GLB asset is now committed in repo and deployed:
   - commit `95106d5` (`chore(chat): add Bejroska hoodie GLB asset`)
   - file path `public/models/bejroska-hoodie.glb`
   - runtime URL `/models/bejroska-hoodie.glb`
3. Symptom still open:
   - overlay opens, but model may not render before close for some clients.
4. Locked implementation plan for next window:
   1. Replace remote `unpkg` loader in `src/components/chat/BejroskaShowcase.tsx` with local package import (`@google/model-viewer`) so CSP `script-src 'self'` remains valid.
   2. Keep CSP strict in `src/proxy.ts` (do not whitelist external script origins).
   3. Adjust overlay close behavior in `src/components/chat/ChatPanel.tsx`:
      - replace fixed `durationMs=3000` with model-ready aware close (`min 3000ms`, hard cap `12000ms`).
   4. Keep fallback rendering path if model load fails (chat send must remain unaffected).
   5. Run gates: `npm run lint`, `npx tsc --noEmit --incremental false`, `npm run build`.
   6. Deploy prod and verify on alias:
      - `HEAD /models/bejroska-hoodie.glb` returns `200`
      - click `Bejroska?` shows visible model before overlay close.
