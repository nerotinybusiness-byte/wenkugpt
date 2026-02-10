# RAG v2 Test Plan

## Unit
1. alias normalization/token generation
2. scope matching resolver
3. temporal validity resolver
4. ambiguity construction
5. candidate extraction (pattern + n-gram)

## Integration
1. ingestion -> `term_candidates` persistence
2. query flow with scope/effectiveAt
3. strict failure mode for ambiguity or missing critical definition
4. v2 response includes `interpretation`, `ambiguities`, `engineMeta`

## Regression
1. `v1` remains default and stable
2. kill-switch enforces `v1` fallback
3. existing chat/history/auth tests remain green

## Acceptance Gates
1. `npx tsc --noEmit --incremental false`
2. `npm run lint`
3. `npm run test:run`
