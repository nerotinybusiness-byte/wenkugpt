# Evidence

## A) User-visible evidence
- Upload UI displayed per-file errors: `DOMMatrix is not defined`.
- Chat UI displayed: `Missing identity header. Set x-user-email.`

## B) Backend auth evidence
File: `src/lib/auth/request-auth.ts`
- Reads header: `request.headers.get('x-user-email')`.
- In production, missing header returns unauthorized.
- Error text matches user screenshot exactly.

## C) Frontend request evidence
These browser calls are missing explicit identity header injection:
- `src/components/ingest/FileUploader.tsx:131` -> `fetch('/api/ingest', ...)`
- `src/components/ingest/FileList.tsx:50` -> `fetch('/api/documents', ...)`
- `src/components/ingest/FileList.tsx:120` -> `fetch('/api/documents/${id}', { method: 'DELETE' })`
- `src/components/ingest/FileList.tsx:159` -> `fetch('/api/documents/${doc.id}/preview')`
- `src/components/chat/ChatPanel.tsx:169` -> `fetch('/api/chat?chatId=...')`
- `src/components/chat/ChatPanel.tsx:211` -> `fetch('/api/history?limit=20')`
- `src/components/chat/ChatPanel.tsx:241` -> `fetch('/api/chat', { method: 'POST' ... })`
- `src/components/chat/ChatPanel.tsx:493` -> `fetch('/api/history', { method: 'DELETE' })`

## D) Contract evidence
File: `docs/api.md`
- Declares identity header requirement: `x-user-email`.

## E) Production sanity evidence
Manual production request to `/api/ingest` with explicit `x-user-email` succeeded.
Conclusion: endpoint itself can work when auth header is present.

## F) Parser patch evidence
`src/lib/ingest/parser.ts` has local modifications replacing worker bootstrap approach with preloaded `pdfjsWorker` strategy.
This reduces worker resolution issues in serverless runtime and was validated locally in prior run.
