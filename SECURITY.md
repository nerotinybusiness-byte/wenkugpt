# SECURITY MANIFEST

**WENKUGPT** adheres to strict security, performance, and data residency standards. This document outlines the core security features implemented in the system.

## 🛡️ Infrastructure & Residency

### EU Data Residency
*   **Status**: ENFORCED
*   **Policy**: All data processing and storage occurs exclusively within EU zones (Frankfurt `eu-central-1` preferred).
*   **Databases**: Supabase (PostgreSQL) and Upstash Redis are configured to use EU endpoints.
*   **Ingestion Pipeline**: Automatically verifies region compliance before processing any document.
*   **Privacy Badge**: Visible indicator in the UI confirming data residency.

## 🔒 Application Security

### Security Headers (Middleware)
All responses include strict security headers to protect against common web vulnerabilities:

*   **Content-Security-Policy (CSP)**: Strict `default-src 'self'` policy with whitelisted external providers (Supabase, Google, Anthropic, Cohere, Upstash).
*   **HSTS**: HTTP Strict Transport Security enabled (`max-age=31536000`, `includeSubDomains`) to enforce HTTPS.
*   **X-Frame-Options**: `DENY` to prevent clickjacking attacks via iframes.
*   **X-Content-Type-Options**: `nosniff` to prevent MIME-type sniffing.
*   **Permissions-Policy**: Disables access to sensitive browser features (camera, microphone, geolocation).

### Rate Limiting
API endpoints are protected by a distributed sliding-window rate limiter powered by Upstash Redis:

*   **Chat API** (`/api/chat`): 10 requests / minute per IP.
*   **Ingestion API** (`/api/ingest`): 3 uploads / hour per IP.
*   **Fail-Open**: Designed to prioritize availability; if rate limiting service fails, requests are allowed.
*   **Liquid Glass Response**: Custom 429 error pages match the application's aesthetic.

## ⚡ Performance Optimization

### Semantic Caching (L1 + L2)
A two-layer caching system ensures instant responses for frequent queries while minimizing database load:

1.  **L1 Cache (Redis)**:
    *   **Mechanism**: Exact Hash Match (SHA-256).
    *   **Latency**: ~5ms.
    *   **TTL**: Configurable (default 24h).

2.  **L2 Cache (Postgres pgvector)**:
    *   **Mechanism**: Vector Similarity Search (>= 95% similarity).
    *   **Fallback**: Used only when L1 cache misses.

### Ingestion Pipeline
*   **Parallel Processing**: Documents are parsed and chunked efficiently.
*   **Deduplication**: SHA-256 file hashing prevents duplicate document processing.

## 🔍 Auditing & Verification

*   **Triple-Agent Architecture**: Every response is generated, verified, and audited before presentation.
*   **Confidence Scoring**: Responses with low confidence (< 0.85) are flagged or withheld to prevent hallucinations.
*   **Citation Tracking**: All answers include direct citations to source text blocks with page numbers.

---

*Verified by Antigravity*
*Date: 2026-02-05*
