# API Contract

All API routes return a unified JSON envelope:

```json
{
  "success": true,
  "data": {},
  "error": null,
  "code": null
}
```

Error responses:

```json
{
  "success": false,
  "data": null,
  "error": "Human readable message",
  "code": "MACHINE_READABLE_CODE"
}
```

## Auth

- Identity header: `x-user-email: user@example.com`
- In `production`, headerless fallback is disabled.
- In non-production, missing header falls back to `DEV_DEFAULT_USER_EMAIL` or the first `ADMIN_EMAILS` entry.
- Admin-only endpoints require an allowlisted admin user (`ADMIN_EMAILS`):
  - `POST /api/ingest`
  - `GET /api/documents`
  - `DELETE /api/documents/:id`
  - `GET /api/documents/:id/preview`
  - `GET /api/debug` (and disabled in production)

## Core Endpoints

- `POST /api/chat` -> `data: { chatId, response, sources, verified, confidence, stats }`
  - `settings.generatorModel` currently accepts `gemini-2.5-flash`; unsupported values are sanitized to this default.
- `GET /api/chat?chatId=...` -> `data: { messages }`
- `GET /api/history` -> `data: { history, nextCursor }`
- `DELETE /api/history` -> `data: { cleared: true }`
- `GET /api/documents` -> `data: { documents, nextCursor }`
- `DELETE /api/documents/:id` -> `data: { id, message }`
- `GET /api/documents/:id/preview` -> `data: { content }`
- `POST /api/ingest` -> `data: { documentId, stats }`
- `GET /api/ingest` -> `data: { name, version, endpoints, limits }`
- `GET /api/health` -> `data: { status, db, durationMs }` on success
