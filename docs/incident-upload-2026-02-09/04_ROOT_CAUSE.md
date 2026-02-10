# Root Cause Analysis

## Primary root cause
Frontend browser requests to protected `/api/*` routes do not attach required `x-user-email` header.

### Why this breaks
- Auth middleware requires explicit identity in production.
- Missing header triggers `AUTH_UNAUTHORIZED` with message:
  `Missing identity header. Set x-user-email.`
- Upload/chat/document management APIs are all behind this auth gate.

## Secondary contributing factor
Historical parser runtime failures (`DOMMatrix is not defined`) generated failed upload entries that can remain visible in UI queue/history and obscure current root cause.

## Tertiary process gap
No centralized client API abstraction exists for identity propagation.
Each component uses ad hoc `fetch`, so auth header behavior is inconsistent and easy to miss.

## Non-root observations
- `ALLOW_HEADERLESS_AUTH` appears in env template but is not wired in auth code path.
- This can mislead operators expecting fallback behavior in preview/production.

## Causal chain
1. Browser sends `/api/*` request without `x-user-email`.
2. Server auth rejects request in production.
3. UI surfaces generic or propagated error.
4. User experiences failed upload/chat and retries.
5. Mixed old/new errors accumulate, reducing debuggability.

## Addendum - PDF citation highlight mis-anchor (2026-02-10)
### Primary cause
`context-text` narrowing could resolve to lexically similar text at the top of the page because context payload was too broad and ranking was lexical-first.

### Secondary cause
Viewer lacked strict spatial validation against the coarse citation envelope, so an incorrect lexical match could still be accepted as `context-text`.

### Tertiary cause
Context highlight cache key did not include citation geometry signature, enabling stale reuse between different citations on the same page.

### Addendum causal chain
1. Citation click sends broad `contextText`.
2. Viewer ranks text-layer spans by token overlap.
3. Top lexical spans can come from header/top region.
4. No spatial gate rejects this mismatch.
5. UI reports `context-text` while highlight is visually misplaced.
