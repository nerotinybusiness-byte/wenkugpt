# Risks And Open Questions

## Active risks
1. Identity source ambiguity on client
- Risk: helper may inject wrong email or none.
- Mitigation: define strict resolution order and explicit error state.

2. Hidden stale UI errors
- Risk: old failed queue entries may appear as active incident after fix.
- Mitigation: validate with fresh uploads after page reload and clean list.

3. Env/docs drift
- Risk: `.env.example` suggests behavior not implemented (`ALLOW_HEADERLESS_AUTH`).
- Mitigation: align code and docs in same change cycle.

## Open questions requiring decision
1. What is canonical client-side identity source?
- Option A: `NEXT_PUBLIC_DEFAULT_USER_EMAIL` (simple, static)
- Option B: session/auth provider (correct long-term)
- Option C: local storage profile fallback with strict validation

2. Should preview environment allow controlled headerless fallback?
- Current recommendation: no for production, maybe yes for isolated preview if explicitly gated.

3. Should we add runtime warning banner when auth header is missing?
- Could reduce support load by guiding operator immediately.

## Exit criteria for incident closure
- Header propagation fixed and verified in browser.
- PDF uploads verified on fresh attempts.
- Chat/history/documents flows verified end-to-end.
- Docs and env behavior aligned.
- Live log updated with closure note.
