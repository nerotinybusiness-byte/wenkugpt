# Code Map (Auth + API Call Sites)

## Backend auth gate
- `src/lib/auth/request-auth.ts`
  - `getRequestEmail()` reads `x-user-email`
  - production path rejects missing header
  - unauthorized message: `Missing identity header. Set x-user-email.`

## Protected API routes
- `src/app/api/ingest/route.ts` (admin)
- `src/app/api/documents/route.ts` (admin)
- `src/app/api/documents/[id]/route.ts` (admin)
- `src/app/api/documents/[id]/preview/route.ts` (admin)
- `src/app/api/chat/route.ts` (user)
- `src/app/api/history/route.ts` (user)

## Client call sites lacking centralized auth header (current)
- `src/components/ingest/FileUploader.tsx`
  - `fetch('/api/ingest', ...)`
- `src/components/ingest/FileList.tsx`
  - `fetch('/api/documents', ...)`
  - `fetch('/api/documents/${id}', { method: 'DELETE' })`
  - `fetch('/api/documents/${doc.id}/preview')`
- `src/components/chat/ChatPanel.tsx`
  - `fetch('/api/chat?chatId=...')`
  - `fetch('/api/history?limit=20')`
  - `fetch('/api/chat', { method: 'POST' ... })`
  - `fetch('/api/history', { method: 'DELETE' })`

## Supporting docs
- `docs/api.md` documents `x-user-email` requirement.
- `.env.example` includes `DEV_DEFAULT_USER_EMAIL` and `ALLOW_HEADERLESS_AUTH` notes.

## Parser patch location
- `src/lib/ingest/parser.ts` local modifications present in working tree.
