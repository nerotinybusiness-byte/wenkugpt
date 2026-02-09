/**
 * WENKUGPT - Security Middleware
 * 
 * Combines rate limiting and security headers:
 * - Rate limiting: Upstash Redis-based (10 req/min chat, 3/hr ingest)
 * - Security headers: CSP, HSTS, X-Frame-Options, etc.
 * 
 * Uses sliding window algorithm for fair limiting
 */

import { NextRequest, NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { createRequestId, logWarn } from '@/lib/logger';

// =============================================================================
// SECURITY HEADERS CONFIGURATION
// =============================================================================

/**
 * Content Security Policy
 * Strict rules with exceptions for our API providers
 */
const CSP_DIRECTIVES = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js needs unsafe-inline for hydration
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://*.supabase.co https://*.google.com https://*.anthropic.com https://*.cohere.com https://*.upstash.io wss://*.supabase.co",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
].join('; ');

/**
 * All security headers to add to responses
 */
const SECURITY_HEADERS: Record<string, string> = {
    // Content Security Policy
    'Content-Security-Policy': CSP_DIRECTIVES,

    // Prevent iframe embedding (clickjacking protection)
    'X-Frame-Options': 'DENY',

    // Prevent MIME-type sniffing
    'X-Content-Type-Options': 'nosniff',

    // XSS protection (legacy, but still useful for older browsers)
    'X-XSS-Protection': '1; mode=block',

    // Referrer policy
    'Referrer-Policy': 'strict-origin-when-cross-origin',

    // HSTS - Force HTTPS (1 year)
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',

    // Permissions policy - disable unused features
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',

    // DNS prefetch control
    'X-DNS-Prefetch-Control': 'on',
};

/**
 * Apply security headers to a response and ensure a request ID is present
 */
function applySecurityHeaders(response: NextResponse): NextResponse {
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
        response.headers.set(key, value);
    }

    if (!response.headers.get('X-Request-ID')) {
        response.headers.set('X-Request-ID', createRequestId());
    }

    return response;
}

// =============================================================================
// RATE LIMITING CONFIGURATION
// =============================================================================

/**
 * Rate limit configuration
 */
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

/**
 * Check if Upstash is configured
 */
function isUpstashConfigured(): boolean {
    return !!(
        process.env.UPSTASH_REDIS_REST_URL &&
        process.env.UPSTASH_REDIS_REST_TOKEN
    );
}

/**
 * Create Redis client (lazy initialization)
 */
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

/**
 * Create rate limiters (lazy initialization)
 */
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

/**
 * Get client IP from request
 */
function getClientIP(request: NextRequest): string {
    // Check various headers for proxy scenarios
    const forwardedFor = request.headers.get('x-forwarded-for');
    if (forwardedFor) {
        return forwardedFor.split(',')[0].trim();
    }

    const realIP = request.headers.get('x-real-ip');
    if (realIP) {
        return realIP;
    }

    // Fallback for development
    return '127.0.0.1';
}

/**
 * Create "Liquid Glass" styled 429 response (with security headers)
 */
function createRateLimitResponse(resetTime: number, limit: number): NextResponse {
    const retryAfterSeconds = Math.ceil((resetTime - Date.now()) / 1000);

    const response = NextResponse.json(
        {
            error: 'rate_limit_exceeded',
            message: 'Příliš mnoho požadavků. Prosím, dej si chvíli pauzu.',
            retryAfter: retryAfterSeconds,
            style: 'liquid_glass',
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

    // Apply security headers to rate limit response too
    return applySecurityHeaders(response);
}

/**
 * Paths that should skip rate limiting (but not security headers)
 */
const SKIP_RATE_LIMIT_PATHS = [
    '/_next',
    '/static',
    '/favicon.ico',
    '/images',
    '/fonts',
    '/api/health',
];

/**
 * Check if path should skip rate limiting
 */
function shouldSkipRateLimit(pathname: string): boolean {
    return SKIP_RATE_LIMIT_PATHS.some(skip => pathname.startsWith(skip));
}

// =============================================================================
// MAIN MIDDLEWARE
// =============================================================================

/**
 * Main middleware function
 */
export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Skip static assets entirely (no security headers needed for _next)
    if (pathname.startsWith('/_next') || pathname.startsWith('/static')) {
        return NextResponse.next();
    }

    // For non-API routes, just apply security headers
    if (!pathname.startsWith('/api/')) {
        const response = NextResponse.next();
        return applySecurityHeaders(response);
    }

    // Skip rate limiting for certain paths
    if (shouldSkipRateLimit(pathname)) {
        const response = NextResponse.next();
        return applySecurityHeaders(response);
    }

    // Skip rate limiting if Upstash is not configured (development mode)
    if (!isUpstashConfigured()) {
        logWarn('Rate limiting disabled: Upstash Redis not configured');
        const response = NextResponse.next();
        return applySecurityHeaders(response);
    }

    const ip = getClientIP(request);

    // Apply rate limits based on endpoint
    try {
        if (pathname === '/api/chat') {
            const limiter = getChatLimiter();
            if (limiter) {
                const { success, reset, remaining } = await limiter.limit(ip);

                if (!success) {
                    logWarn('Rate limit exceeded on /api/chat', { route: '/api/chat', ip });
                    return createRateLimitResponse(reset, RATE_LIMITS.chat.requests);
                }

                // Add rate limit headers to response
                const response = NextResponse.next();
                response.headers.set('X-RateLimit-Remaining', String(remaining));
                response.headers.set('X-RateLimit-Limit', String(RATE_LIMITS.chat.requests));
                return applySecurityHeaders(response);
            }
        }

        if (pathname === '/api/ingest') {
            const limiter = getIngestLimiter();
            if (limiter) {
                const { success, reset, remaining } = await limiter.limit(ip);

                if (!success) {
                    logWarn('Rate limit exceeded on /api/ingest', { route: '/api/ingest', ip });
                    return createRateLimitResponse(reset, RATE_LIMITS.ingest.requests);
                }

                const response = NextResponse.next();
                response.headers.set('X-RateLimit-Remaining', String(remaining));
                response.headers.set('X-RateLimit-Limit', String(RATE_LIMITS.ingest.requests));
                return applySecurityHeaders(response);
            }
        }

    } catch (error) {
        // If rate limiting fails, allow the request through (fail open)
        logWarn('Rate limiting error, failing open', { route: pathname }, error);
        const response = NextResponse.next();
        return applySecurityHeaders(response);
    }

    // Default: apply security headers
    const response = NextResponse.next();
    return applySecurityHeaders(response);
}

/**
 * Middleware configuration
 * Match all routes except Next.js internals and static files
 */
export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
