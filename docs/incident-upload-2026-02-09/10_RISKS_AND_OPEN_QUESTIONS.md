# Risks And Open Questions

## Active risks
1. Identity source ambiguity on client
- Risk: helper may inject wrong email or none.
- Mitigation: define strict resolution order and explicit error state.

2. Hidden stale UI errors
- Risk: old failed queue entries may appear as active incident after fix.
- Mitigation: validate with fresh uploads after page reload and clean list.

3. Env/docs drift (resolved 2026-02-09)
- Risk: `.env.example` previously suggested behavior not implemented (`ALLOW_HEADERLESS_AUTH`).
- Mitigation: removed obsolete variable from `.env.example` and aligned docs with implemented auth flow.
- Status: closed.

4. RAG v2 semantic drift and ambiguity handling (opened 2026-02-10)
- Risk: unresolved or conflicting internal meanings can degrade answer quality.
- Mitigation: scope/time-aware graph definitions, ambiguity policies (`ask/show_both/strict`), strict grounding flag.
- Status: in progress.

5. RAG v2 rollout regression risk (opened 2026-02-10)
- Risk: v2 graph flow could impact latency/quality during rollout.
- Mitigation: staged rollout with feature flags and server kill-switch (`RAG_V2_KILL_SWITCH`).
- Status: in progress.

6. PDF citation highlight precision on production (updated 2026-02-10)
- Risk: some PDFs may still render coarse highlight if text-layer tokenization differs from citation context or if text layer is not ready on first render.
- Mitigation: page-local ingest matching fix, bounded highlightBoxes generation, strengthened coarse detection + context-text fallback, viewer retry logic for context highlight resolution, temporary suppression of coarse overlay while context resolution is pending, full document reupload/reingest.
- Status: in progress.

7. False-positive `context-text` success state (opened 2026-02-10)
- Risk: viewer can show `context-text` badge while selected anchor is spatially wrong (top-strip match on same page).
- Mitigation: narrow context payloads, region-first resolver, spatial validation gate, key-based context cache with highlight signature, deterministic `bbox-fallback`.
- Status: in progress.

8. Migration drift between runtime code and production DB schema (opened 2026-02-10)
- Risk: code writes newly introduced columns (e.g., `chunks.highlight_text`) before migration is applied on target DB, causing ingest runtime failures (`PG 42703`).
- Mitigation: immediate DB hotfix + ingest schema preflight (`schema-health`) + strict schema check script in deployment runbook.
- Status: closed for current schema baseline (migrations 0005-0007 applied and preflight checks green); keep deployment guardrail active.

9. Template detection quality drift (opened 2026-02-10)
- Risk: false-positive/false-negative template matches can over-filter useful chunks or under-filter boilerplate, impacting answer quality.
- Mitigation: profile-based matching thresholds, warning-only mode, telemetry (`template_match_rate`, `template_boilerplate_chunks_filtered`, `retrieval_boilerplate_hit_rate`), iterative profile tuning with reference PDFs.
- Status: in progress.

10. OCR fallback latency/cost in ingest (opened 2026-02-10)
- Risk: OCR fallback for low-text PDF pages can add ingest latency and model cost spikes.
- Mitigation: gated by feature flag (`TEMPLATE_OCR_FALLBACK_ENABLED`), sampled-pages strategy (10% pages, min 3, max 12), timeout warning (`ocr_timeout`) and phased rollout.
- Status: in progress.

11. Tesseract runtime variability in OCR rescue (opened 2026-02-11)
- Risk: `tesseract.js` warm-up/WASM startup and CPU-heavy page rendering may increase ingest latency variance across environments.
- Mitigation: user-level opt-in engine switch, hard page cap for Tesseract rescue (`6` pages), warning-only behavior on provider failure (`ocr_rescue_tesseract_unavailable`, `ocr_rescue_timeout`), telemetry by engine.
- Status: in progress.

12. Empty-state custom icon consistency drift (opened 2026-02-11)
- Risk: rapid iteration on custom SVG set may create style mismatch (stroke density/optical center) or broken registry references when IDs change.
- Mitigation: keep single typed taxonomy (`CustomSuggestionIconId`), run lint/tsc on every icon-set edit, verify dark/light rendering on aliased production before closure.
- Status: in progress.

13. Suggestion pool topical drift (opened 2026-02-11)
- Risk: randomized pool can surface cards that feel off-topic for current customer context if prompt set is not curated.
- Mitigation: keep all suggestions centralized in `src/components/chat/suggestionPool.ts`, curate pool after each feedback round, keep only approved icon IDs.
- Status: in progress.

14. Local-vs-deployed UI copy drift (opened 2026-02-11)
- Risk: handoff confusion when hero copy change is present locally but not yet deployed (example: `Liquid Glass Chat` -> `WenkuGPT`).
- Mitigation: always log local pending deltas explicitly in handoff prompt/live log and complete commit+deploy before closure.
- Status: in progress.

15. Bejroska model-viewer loader vs CSP mismatch (opened 2026-02-11)
- Risk: loading `model-viewer` from remote CDN (`unpkg`) conflicts with production CSP (`script-src 'self'`), so 3D component may not initialize.
- Mitigation: switch to local package import (`@google/model-viewer`) and keep CSP strict.
- Status: mitigated in local code; production deploy verification pending.

16. Bejroska overlay timeout vs model cold-load (opened 2026-02-11)
- Risk: fixed `3000ms` overlay close can end showcase before a ~23MB GLB is visibly rendered on slower clients.
- Mitigation: user-requested manual close policy applied locally (no auto-timeout); showcase remains open until user click.
- Status: partially mitigated locally (pending production deploy and local-loader migration).

## Open questions requiring decision
1. What is canonical client-side identity source?
- Option A: `NEXT_PUBLIC_DEFAULT_USER_EMAIL` (simple, static)
- Option B: session/auth provider (correct long-term)
- Option C: local storage profile fallback with strict validation

2. Should preview environment allow controlled headerless fallback?
- Current recommendation: no for production, maybe yes for isolated preview if explicitly gated.

3. Should we add runtime warning banner when auth header is missing?
- Could reduce support load by guiding operator immediately.

4. Should we add explicit "highlight mode" badge in PDF viewer? (resolved 2026-02-10)
- Decision: show when highlight is `bbox` vs `context-text` fallback for easier debugging.

5. What is the minimum acceptable spatial overlap threshold for `context-text` acceptance?
- Proposed default: require spatial gate support of at least 2 spans and merged area >= `0.0008`.

6. Should `db:check-ingest-schema` become a required predeploy gate for production?
- Proposed default: yes for production path; optional in local dev.

7. What should be the default active template profile in production?
- Proposed default: start with `wenku-manual-v1` only in preview, then promote after match-quality review.

8. Should boilerplate exclusion be enabled globally or scoped to selected projects/docs first?
- Proposed default: staged enablement via `TEMPLATE_AWARE_FILTERING_ENABLED` (preview -> 10% -> 100%).

9. Should `OCR_TESSERACT_ENABLED` stay enabled in all preview environments?
- Proposed default: keep `true` where tested, disable selectively (`false`) in unstable/low-CPU previews while preserving warning-only upload behavior.

10. Should we lock a final V2 icon subset now (freeze taxonomy for a week) before additional style edits?
- Proposed default: yes, freeze after current V2 + rope removal deploy, then batch only curated additions.

11. Should branding text in empty-state hero be permanently locked to `WenkuGPT`?
- Proposed default: yes, lock to `WenkuGPT` and avoid marketing-title experiments unless explicitly requested.

12. For Bejroska overlay close policy, do we prefer deterministic timeout or model-ready close with cap?
- Proposed default: model-ready close with hard cap `12000ms` and minimum visible window `3000ms`.

## Exit criteria for incident closure
- Header propagation fixed and verified in browser.
- PDF uploads verified on fresh attempts.
- Chat/history/documents flows verified end-to-end.
- Docs and env behavior aligned.
- Live log updated with closure note.
- Template-aware ingest migration applied and schema preflight green on target environment.
- Template flags rolled out with stable telemetry (no regression in retrieval quality/latency).


## Update 2026-02-11 (post-migration rollout)
- Closed immediate production blocker behind `Ingest schema preflight failed` by aligning DB schema with backend expectations.
- Confirmed migrations `0005`, `0006`, and `0007` are applied on production DB used by deployed app.
- Confirmed schema health command is green (`ingest_schema_ok=true`) and no required ingest columns are missing.
- Confirmed OCR rescue behavior remains warning-only under provider unavailability (`tesseract` path) and does not hard-fail ingest.
