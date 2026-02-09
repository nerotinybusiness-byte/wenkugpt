# Decisions Log

## Accepted decisions
1. Keep strict production auth requiring explicit `x-user-email`.
2. Fix client-side header propagation instead of relaxing backend auth.
3. Introduce one shared browser API helper to remove duplicated fetch auth logic.
4. Keep incident docs as a living runbook and update after each significant step.
5. Client identity resolution order is:
   - `NEXT_PUBLIC_DEFAULT_USER_EMAIL`
   - localStorage keys (`x-user-email`, `wenkugpt:user-email`, `userEmail`)
   - sessionStorage keys (`x-user-email`, `wenkugpt:user-email`, `userEmail`)
   - temporary fallback: `admin@example.com`

## Process decision (new)
- User requested full continuity across windows.
- Implementation and investigation state must be logged continuously in this folder.
- `09_LIVE_LOG.md` is append-only.
- `14_IMPLEMENTATION_TRACKER.md` is the source of task status truth.

## Deferred decisions
1. Canonical source of client identity email:
   - `NEXT_PUBLIC_DEFAULT_USER_EMAIL`
   - session/auth provider value
   - localStorage fallback key
2. Whether to wire or remove `ALLOW_HEADERLESS_AUTH` in code/docs.
3. Whether to add an operator-visible UI warning when identity header source is missing.

## Rejected approaches
1. Disabling auth checks in production: rejected (security regression).
2. Patching each fetch call manually without shared helper: rejected (high drift risk).

## Decision owner
Current implementer: Codex session, validated with user in current thread.
