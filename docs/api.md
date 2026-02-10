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
- `ALLOW_HEADERLESS_AUTH` is intentionally unsupported in runtime auth logic.
- Admin-only endpoints require an allowlisted admin user (`ADMIN_EMAILS`):
  - `POST /api/ingest`
  - `GET /api/documents`
  - `DELETE /api/documents/:id`
  - `GET /api/documents/:id/preview`
  - `GET /api/debug` (and disabled in production)

## Core Endpoints

- `POST /api/chat` -> `data: { chatId, response, sources, verified, confidence, stats }`
  - `settings.ragEngine` supports `v1` and `v2`; unsupported values are sanitized to `v1`.
  - `settings.contextScope?: { team?: string; product?: string; region?: string; process?: string }`
  - `settings.effectiveAt?: string` (ISO or datetime-local compatible value)
  - `settings.ambiguityPolicy?: 'ask' | 'show_both' | 'strict'`
  - `settings.generatorModel` currently accepts `gemini-2.5-flash`; unsupported values are sanitized to this default.
  - Optional response extensions for `v2`:
    - `interpretation?: { detectedTerms, resolvedConcepts, definitionVersionIds, rewrittenQuery }`
    - `ambiguities?: { term, candidateConcepts, reason }[]`
    - `engineMeta?: { engine: 'v1' | 'v2', mode: 'compat' | 'graph' }`
- `GET /api/chat?chatId=...` -> `data: { messages }`
- `GET /api/history` -> `data: { history, nextCursor }`
- `DELETE /api/history` -> `data: { cleared: true }`
- `GET /api/documents` -> `data: { documents, nextCursor }`
  - document item includes template diagnostics:
    - `templateProfileId?: string | null`
    - `templateMatched?: boolean`
    - `templateMatchScore?: number | null`
    - `templateBoilerplateChunks?: number`
    - `templateDetectionMode?: 'text' | 'ocr' | 'hybrid' | 'none' | null`
    - `templateWarnings?: string[] | null`
- `DELETE /api/documents/:id` -> `data: { id, message }`
- `GET /api/documents/:id/preview` -> `data: { content }`
- `POST /api/ingest` -> `data: { documentId, stats, template }`
  - `options` supports:
    - `templateProfileId?: string` (override default template profile registry selection)
  - `template` shape:
    - `profileId: string | null`
    - `matched: boolean`
    - `matchScore: number | null`
    - `detectionMode: 'text' | 'ocr' | 'hybrid' | 'none'`
    - `boilerplateChunks: number`
    - `warnings: string[]`
- `GET /api/ingest` -> `data: { name, version, endpoints, limits }`
- `GET /api/health` -> `data: { status, db, durationMs }` on success

## RAG v2 Feature Flags

- `RAG_V2_GRAPH_ENABLED` - enables graph-memory expansion stages.
- `RAG_V2_REWRITE_ENABLED` - enables fallback term classification/rewrite behavior.
- `RAG_V2_STRICT_GROUNDING` - fail closed for unresolved critical definitions/ambiguity constraints.
- `RAG_V2_KILL_SWITCH` - force `v1` execution even when client requests `v2`.

## Template Ingest Feature Flags

- `TEMPLATE_AWARE_FILTERING_ENABLED` - enable template profile matching and boilerplate chunk exclusion from retrieval index.
- `TEMPLATE_OCR_FALLBACK_ENABLED` - enable Gemini OCR fallback for sampled PDF pages with weak/no text layer.

