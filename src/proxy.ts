/**
 * WENKUGPT - Security Proxy
 *
 * Combines rate limiting and security headers:
 * - Rate limiting: Upstash Redis-based (10 req/min chat, 3/hr ingest)
 * - Security headers: CSP, HSTS, X-Frame-Options, etc.
 *
 * Uses sliding window algorithm for fair limiting.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { createRequestId, logWarn } from '@/lib/logger';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const scriptSrcDirective = IS_PRODUCTION
  ? "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'"
  : "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'";

const CSP_DIRECTIVES = [
  "default-src 'self'",
  scriptSrcDirective,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "worker-src 'self' blob:",
  "connect-src 'self' https://*.supabase.co https://*.google.com https://*.anthropic.com https://*.cohere.com https://api.cohere.com https://*.upstash.io wss://*.supabase.co",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ');

const SECURITY_HEADERS_BASE: Record<string, string> = {
  'Content-Security-Policy': CSP_DIRECTIVES,
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  'X-DNS-Prefetch-Control': 'on',
};

function getSecurityHeaders(): Record<string, string> {
  return IS_PRODUCTION
    ? {
      ...SECURITY_HEADERS_BASE,
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    }
    : SECURITY_HEADERS_BASE;
}

function applySecurityHeaders(response: NextResponse, requestId: string): NextResponse {
  for (const [key, value] of Object.entries(getSecurityHeaders())) {
    response.headers.set(key, value);
  }

  response.headers.set('X-Request-ID', requestId);
  return response;
}

function createPassThroughResponse(request: NextRequest): { response: NextResponse; requestId: string } {
  const requestHeaders = new Headers(request.headers);
  const requestId = requestHeaders.get('x-request-id') ?? createRequestId();
  requestHeaders.set('x-request-id', requestId);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  return { response, requestId };
}

const RATE_LIMITS = {
  chat: {
    requests: 10,
    window: '1 m',
    prefix: 'ratelimit:chat',
  },
  ingest: {
    requests: 3,
    window: '1 h',
    prefix: 'ratelimit:ingest',
  },
} as const;

function isUpstashConfigured(): boolean {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

let redis: Redis | null = null;
function getRedis(): Redis | null {
  if (!isUpstashConfigured()) return null;

  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return redis;
}

let chatLimiter: Ratelimit | null = null;
let ingestLimiter: Ratelimit | null = null;

function getChatLimiter(): Ratelimit | null {
  const redisClient = getRedis();
  if (!redisClient) return null;

  if (!chatLimiter) {
    chatLimiter = new Ratelimit({
      redis: redisClient,
      limiter: Ratelimit.slidingWindow(RATE_LIMITS.chat.requests, RATE_LIMITS.chat.window),
      prefix: RATE_LIMITS.chat.prefix,
      analytics: true,
    });
  }
  return chatLimiter;
}

function getIngestLimiter(): Ratelimit | null {
  const redisClient = getRedis();
  if (!redisClient) return null;

  if (!ingestLimiter) {
    ingestLimiter = new Ratelimit({
      redis: redisClient,
      limiter: Ratelimit.slidingWindow(RATE_LIMITS.ingest.requests, RATE_LIMITS.ingest.window),
      prefix: RATE_LIMITS.ingest.prefix,
      analytics: true,
    });
  }
  return ingestLimiter;
}

function getClientIP(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  return '127.0.0.1';
}

function createRateLimitResponse(resetTime: number, limit: number, requestId: string): NextResponse {
  const retryAfterSeconds = Math.ceil((resetTime - Date.now()) / 1000);

  const response = NextResponse.json(
    {
      success: false,
      data: null,
      error: 'Rate limit exceeded. Please retry later.',
      code: 'RATE_LIMIT_EXCEEDED',
      details: {
        retryAfter: retryAfterSeconds,
      },
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSeconds),
        'X-RateLimit-Limit': String(limit),
        'X-RateLimit-Reset': String(resetTime),
        'Content-Type': 'application/json',
      },
    }
  );

  return applySecurityHeaders(response, requestId);
}

const SKIP_RATE_LIMIT_PATHS = [
  '/_next',
  '/static',
  '/favicon.ico',
  '/images',
  '/fonts',
  '/api/health',
];

function shouldSkipRateLimit(pathname: string): boolean {
  return SKIP_RATE_LIMIT_PATHS.some(skip => pathname.startsWith(skip));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/_next') || pathname.startsWith('/static')) {
    return NextResponse.next();
  }

  const { response, requestId } = createPassThroughResponse(request);

  if (!pathname.startsWith('/api/')) {
    return applySecurityHeaders(response, requestId);
  }

  if (shouldSkipRateLimit(pathname)) {
    return applySecurityHeaders(response, requestId);
  }

  if (!isUpstashConfigured()) {
    logWarn('Rate limiting disabled: Upstash Redis not configured', { route: pathname, requestId });
    return applySecurityHeaders(response, requestId);
  }

  const ip = getClientIP(request);

  try {
    if (pathname === '/api/chat') {
      const limiter = getChatLimiter();
      if (limiter) {
        const { success, reset, remaining } = await limiter.limit(ip);

        if (!success) {
          logWarn('Rate limit exceeded on /api/chat', { route: '/api/chat', ip, requestId });
          return createRateLimitResponse(reset, RATE_LIMITS.chat.requests, requestId);
        }

        response.headers.set('X-RateLimit-Remaining', String(remaining));
        response.headers.set('X-RateLimit-Limit', String(RATE_LIMITS.chat.requests));
        return applySecurityHeaders(response, requestId);
      }
    }

    if (pathname === '/api/ingest') {
      const limiter = getIngestLimiter();
      if (limiter) {
        const { success, reset, remaining } = await limiter.limit(ip);

        if (!success) {
          logWarn('Rate limit exceeded on /api/ingest', { route: '/api/ingest', ip, requestId });
          return createRateLimitResponse(reset, RATE_LIMITS.ingest.requests, requestId);
        }

        response.headers.set('X-RateLimit-Remaining', String(remaining));
        response.headers.set('X-RateLimit-Limit', String(RATE_LIMITS.ingest.requests));
        return applySecurityHeaders(response, requestId);
      }
    }
  } catch (error) {
    logWarn('Rate limiting error, failing open', { route: pathname, ip, requestId }, error);
    return applySecurityHeaders(response, requestId);
  }

  return applySecurityHeaders(response, requestId);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
