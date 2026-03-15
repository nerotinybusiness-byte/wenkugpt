# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev           # Start Next.js dev server
npm run build         # Production build
npm run lint          # ESLint on src/
npm run lint:scripts  # ESLint on scripts/ (separate config)
npm run test:run      # Run all tests once (vitest)
npm run test          # Run tests in watch mode
npx tsc --noEmit      # Type-check without emitting

# Run a single test file
npx vitest run src/lib/auth/__tests__/request-auth.test.ts

# DB (Drizzle)
npm run db:push       # Push schema changes to DB (no migration file)
npm run db:generate   # Generate migration SQL
npm run db:migrate    # Apply pending migrations
npm run db:studio     # Open Drizzle Studio

# Test ingestion pipeline from CLI
npx tsx src/lib/ingest/pipeline.ts <path-to-file> [--skip-db] [--skip-embed]
```

## Architecture

### Triple-Agent RAG Pipeline (`src/lib/ai/agents.ts`)
The core of the system. Every `/api/chat` request runs through three agents:
1. **Retriever** — hybrid search (vector + FTS) + Cohere reranking
2. **Generator** (Gemini) — produces a Czech-language response with `[N]` inline citations
3. **Auditor** (Claude `claude-3-5-haiku-latest`) — NLI fact-check; removes hallucinated claims

Verified responses are cached. If `ANTHROPIC_API_KEY` is absent, auditing is skipped (confidence defaults to 0.5).

### Semantic Cache (`src/lib/ai/cache.ts`)
Two-layer cache sitting before the RAG pipeline:
- **L1**: Redis (exact SHA-256 hash match, ~5ms)
- **L2**: Postgres pgvector (≥95% cosine similarity)

Cache hits bypass all three agents entirely and rehydrate source chunks from the DB.

### Ingestion Pipeline (`src/lib/ingest/pipeline.ts`)
`processPipeline(buffer, mimeType, filename, options)` → parse → chunk → embed → store.
- Parser: `src/lib/ingest/parser.ts` (PDF via `pdfjs-dist`, TXT)
- Chunker: `src/lib/ingest/chunker.ts` (semantic chunking with header tracking)
- Embedder: `src/lib/ingest/embedder.ts` (Google `text-embedding-004`, 768 dimensions)
- Deduplication via SHA-256 file hash — duplicate uploads reuse the existing document record
- Chunks are stored in batches of 100 inside a transaction

### Database Schema (`src/lib/db/schema.ts`)
Drizzle ORM + Supabase Postgres. Key tables:
- `chunks` — content + `vector(768)` embedding + `tsvector` for FTS; HNSW and GIN indexes created via migration SQL (not in Drizzle schema)
- `semantic_cache` — cached query embeddings and verified answers
- `audit_logs` — per-request Triple-Agent tracing
- `documents`, `users`, `chats`, `messages`, `config`

### Auth (`src/lib/auth/request-auth.ts`)
Header-based identity only — no session tokens yet. Send `x-user-email: user@example.com`.
- In non-production, falls back to `DEV_DEFAULT_USER_EMAIL` or the first `ADMIN_EMAILS` entry.
- `requireAdmin()` checks role against `ADMIN_EMAILS` allowlist.
- Users are auto-created in the DB on first request.

### API Response Envelope (`src/lib/api/response.ts`)
All routes use `apiSuccess(data)` / `apiError(code, message, status)`. Always returns `{ success, data, error, code }`.

### Hybrid Search (`src/lib/db/queries.ts`)
Combines cosine vector similarity (`<=>`) with `tsvector` FTS. Weights are configurable (`vectorWeight` + `textWeight`). Filtered by `userId` via `accessLevel`.

## Key Conventions

- **Path alias**: `@/` maps to `src/` (configured in `tsconfig.json` and `vitest.config.ts`)
- **Logging**: Use `devLog()` (dev-only) and `logError()` from `src/lib/logger.ts`; never `console.log` in lib/
- **Generator model**: `gemini-2.5-flash` is the default and only accepted value; unsupported values are sanitized back to it
- **Embeddings**: Fixed at 768 dimensions (`text-embedding-004`). Never change without a full migration
- **Czech language**: The Generator agent produces Czech responses. The system prompt, FTS vectors, and UI copy are Czech-optimized
- **EU residency**: `src/lib/config/regions.ts` enforces EU data zones; `logResidencyStatus()` is called at pipeline start
- **`.backup.ts` files**: There are `.backup.ts` and `.backup.tsx` files in the tree — these are dead code and should be ignored

## Environment Variables

See `README.md` for the full list. Critical ones:
- `DATABASE_URL` — Postgres connection string
- `GOOGLE_GENERATIVE_AI_API_KEY` — Gemini (generator + embedder)
- `ANTHROPIC_API_KEY` — Claude auditor (optional; auditing skipped if absent)
- `COHERE_API_KEY` — Reranker (optional; fallback ranking works without it)
- `ADMIN_EMAILS` — comma-separated admin allowlist
- `DEV_DEFAULT_USER_EMAIL` — local dev fallback identity
