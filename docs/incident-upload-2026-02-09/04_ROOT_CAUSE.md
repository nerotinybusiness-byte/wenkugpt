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
