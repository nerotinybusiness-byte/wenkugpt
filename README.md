# WenkuGPT

Production-focused RAG application for document search and chat with citations.

## Core Features
- PDF/TXT ingestion pipeline (parse -> chunk -> embed -> store).
- Hybrid retrieval (vector + full text) with reranking.
- Chat with source citations and PDF deep-linking.
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

## Local Auth Header (current stage)
Until full OAuth session wiring is finished, API auth expects:
- `x-user-email: user@example.com`

Local development fallback is supported via:
- `DEV_DEFAULT_USER_EMAIL`
- first email from `ADMIN_EMAILS` (non-production only)

Only emails in `ADMIN_EMAILS` can access:
- `POST /api/ingest`
- `GET /api/documents`
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

Helper/debug scripts are stored under `scripts/` and linted separately from the production app.

## Migrations
- `npx drizzle-kit push`

## API Contract
- See `docs/api.md` for unified response envelope and auth rules.
