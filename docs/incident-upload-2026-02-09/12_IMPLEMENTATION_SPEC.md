# Implementation Spec: Client Auth Header Injection

## Goal
Ensure all browser calls to internal `/api/*` endpoints include `x-user-email`.

## Proposed new module
- Path: `src/lib/api/client-request.ts`

## Proposed API
```ts
export function resolveClientEmail(): string | null
export function withUserHeader(init?: RequestInit): RequestInit
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>
```

## Behavior requirements
1. Header injection
- If request target is `/api/*`, add `x-user-email` if missing.
- Preserve existing headers and do not overwrite explicit caller value.

2. Email resolution order (proposal)
1. Existing explicit header in call options.
2. `NEXT_PUBLIC_DEFAULT_USER_EMAIL` (if configured).
3. localStorage or sessionStorage fallback keys:
   - `x-user-email`
   - `wenkugpt:user-email`
   - `userEmail`
4. Temporary hardcoded fallback: `admin@example.com`.

3. Error handling
- If identity cannot be resolved by configured strategy, surface descriptive client error before request.

4. Compatibility
- Works for JSON and `FormData` requests.
- Keeps `Content-Type` untouched when body is `FormData`.

## Migration targets
- `src/components/ingest/FileUploader.tsx`
- `src/components/ingest/FileList.tsx`
- `src/components/chat/ChatPanel.tsx`

## Non-goals
- Do not relax backend auth policy.
- Do not introduce server-side identity fallback in production.
