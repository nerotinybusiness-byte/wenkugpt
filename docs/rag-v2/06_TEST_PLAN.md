# RAG v2 Test Plan

## Unit
1. alias normalization/token generation
2. scope matching resolver
3. temporal validity resolver
4. ambiguity construction
5. candidate extraction (pattern + n-gram)
6. PDF highlight utility heuristics (`isCoarse`, envelope/merge behavior)
7. chunker page-local source block matching (no cross-page bbox bleed)

## Integration
1. ingestion -> `term_candidates` persistence
2. query flow with scope/effectiveAt
3. strict failure mode for ambiguity or missing critical definition
4. v2 response includes `interpretation`, `ambiguities`, `engineMeta`
5. PDF citation click path uses bounded highlight metadata and narrows coarse highlights when possible

## Regression
1. `v1` remains default and stable
2. kill-switch enforces `v1` fallback
3. existing chat/history/auth tests remain green
4. known problematic citation (`kde je sklad wenku?`) no longer paints whole page after reingest

## Acceptance Gates
1. `npx tsc --noEmit --incremental false`
2. `npm run lint`
3. `npm run test:run`
