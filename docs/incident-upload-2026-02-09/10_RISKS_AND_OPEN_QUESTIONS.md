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
- Status: mitigated (service restored, guardrails deployed; continue monitoring).

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

## Exit criteria for incident closure
- Header propagation fixed and verified in browser.
- PDF uploads verified on fresh attempts.
- Chat/history/documents flows verified end-to-end.
- Docs and env behavior aligned.
- Live log updated with closure note.
