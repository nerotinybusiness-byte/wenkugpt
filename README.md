# WenkuGPT

Production-focused RAG application for document search and chat with citations.

## Core Features
- PDF/TXT ingestion pipeline (parse -> chunk -> embed -> store).
- OCR rescue for low/empty PDF chunk outcomes (user toggle + engine choice `gemini`/`tesseract`, warning-only policy).
- Zero-chunk hardening: documents with no usable extracted text are marked as failed (not shown as ready).
- Hybrid retrieval (vector + full text) with reranking.
- Chat with source citations and PDF deep-linking.
- Conversational empty-state suggestion cards (4 random prompts from editable pool) with custom inline SVG icon set.
- Runtime RAG engine switch (`v1` / `v2`) from Settings UI.
- Knowledge Base folder organization (flat folders): set folder on upload, filter list, bulk move/clear.
- Semantic cache (Redis + Postgres vector fallback).
- Admin-only document management APIs.

## Tech Stack
- Next.js (App Router)
- Supabase Postgres + pgvector
- Drizzle ORM
- Google Gemini + Anthropic + Cohere
- Upstash Redis (cache and rate limit)

## Environment
Create `.env.local` based on `.env.example`.

Required keys:
- `DATABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `GOOGLE_GENERATIVE_AI_API_KEY`
- `ANTHROPIC_API_KEY` (optional if auditor disabled)
- `COHERE_API_KEY` (optional; fallback ranking works without it)
- `ADMIN_EMAILS` (comma-separated allowlist for admin-only document endpoints)

Optional RAG v2 flags:
- `RAG_V2_GRAPH_ENABLED` (`true` to enable graph memory flow)
- `RAG_V2_REWRITE_ENABLED` (`true` to enable fallback term rewrite/classifier)
- `RAG_V2_STRICT_GROUNDING` (`true` to require strict definition grounding)
- `RAG_V2_KILL_SWITCH` (`true` to force server fallback to `v1`)

Optional template-ingest flags:
- `TEMPLATE_AWARE_FILTERING_ENABLED` (`true` to enable template matching + boilerplate exclusion)
- `TEMPLATE_OCR_FALLBACK_ENABLED` (`true` to allow Gemini OCR fallback for low-text PDF pages)

Optional OCR rescue flags:
- `OCR_TESSERACT_ENABLED` (`true` by default; set `false` to force Tesseract engine unavailable while keeping uploads warning-only)

OCR rescue for low/empty PDF chunk outcomes is controlled per user in the Settings dialog
(`OCR rescue for empty/low PDF chunks`) and defaults to `OFF`.
When enabled, user can choose OCR engine in Settings:
- `gemini` (default, recommended)
- `tesseract` (lower quality, no fallback to Gemini in rescue path)

OCR rescue remains warning-only (it does not block document upload).

## Local Auth Header (current stage)
Until full OAuth session wiring is finished, API auth expects:
- `x-user-email: user@example.com`

Local development fallback is supported via:
- `DEV_DEFAULT_USER_EMAIL`
- first email from `ADMIN_EMAILS` (non-production only)
- `ALLOW_HEADERLESS_AUTH` is not used by current auth flow and should remain unset.

Only emails in `ADMIN_EMAILS` can access:
- `POST /api/ingest`
- `GET /api/documents`
- `PATCH /api/documents/[id]`
- `DELETE /api/documents/[id]`
- `GET /api/documents/[id]/preview`
- `GET /api/debug` (dev only)

## Scripts
- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run lint:scripts`
- `npm run test:run`
- `npx tsc --noEmit`
- `npm run db:check-ingest-schema`
- `npm run template:build-profile -- ./path/to/reference.pdf --profile-id my-template`

Helper/debug scripts are stored under `scripts/` and linted separately from the production app.

## Migrations
- `npx drizzle-kit push`

## API Contract
- See `docs/api.md` for unified response envelope and auth rules.

