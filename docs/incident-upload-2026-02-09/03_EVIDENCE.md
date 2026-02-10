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

## G) PDF highlight regression evidence (2026-02-10)
- Production viewer screenshots show badge `1 highlights found (context-text)` while rendered highlight appears as a thin top strip on page `3/4`, not at cited paragraph.
- Screenshots with `Refining highlight...` confirm context resolver executes, but final anchor can still be semantically wrong.
- Repro path is stable on known scenario: query `kde je sklad wenku?` with citation to `Manual_na_Wenku_2025_03-5.pdf`.

## H) Code-path evidence for mis-anchor
- `src/components/chat/ChatMessage.tsx` passed broad context payload (`localContext + source.content.slice(0, 220)` for inline and full `source.content` for footer), which can bias token overlap to top-of-page spans.
- `src/components/chat/PDFViewer.tsx` ranked spans by lexical overlap only and did not enforce a spatial consistency gate against coarse citation geometry.
- `src/components/chat/PDFViewer.tsx` cached resolved highlights by page key, which could reuse an incorrect resolution for another citation on the same page.
- DB inspection of problematic chunk/page showed coarse envelopes and long chunk content that starts near page header text, matching observed top-strip anchoring.

## I) Ingest schema mismatch evidence (`highlight_text`, 2026-02-10)
- Production ingest failed at chunk insert with SQL payload including `highlight_text`:
  - `insert into "chunks" (..., "highlight_boxes", "highlight_text", ..., "fts_vector", ...)`
- Confirmed database error code and message:
  - `code: 42703`
  - `message: column "highlight_text" does not exist`
- Read-only schema inspection before fix showed `chunks` columns included `highlight_boxes` but not `highlight_text`.
- Immediate production hotfix applied:
  - `ALTER TABLE public.chunks ADD COLUMN IF NOT EXISTS highlight_text text;`
- Post-hotfix verification:
  - `information_schema.columns` confirms `highlight_text` exists.
  - `select highlight_text from public.chunks limit 1` succeeds.
- Functional smoke after hotfix:
  - `POST https://wenkugpt-copy.vercel.app/api/ingest` with admin `x-user-email` returned `200` + `success: true` (no `INGEST_FAILED`).
