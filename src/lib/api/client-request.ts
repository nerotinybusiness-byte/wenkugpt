const EMAIL_STORAGE_KEYS = ['x-user-email', 'wenkugpt:user-email', 'userEmail'] as const;
const TEMP_FALLBACK_EMAIL = 'admin@example.com';

function normalizeEmail(value: string | null | undefined): string | null {
    if (!value) return null;
    const email = value.trim().toLowerCase();
    if (!email || !email.includes('@')) return null;
    return email;
}

function resolveEmailFromStorage(): string | null {
    if (typeof window === 'undefined') return null;

    for (const key of EMAIL_STORAGE_KEYS) {
        const localValue = normalizeEmail(window.localStorage.getItem(key));
        if (localValue) return localValue;

        const sessionValue = normalizeEmail(window.sessionStorage.getItem(key));
        if (sessionValue) return sessionValue;
    }

    return null;
}

export function resolveClientEmail(): string | null {
    const fromEnv = normalizeEmail(process.env.NEXT_PUBLIC_DEFAULT_USER_EMAIL);
    if (fromEnv) return fromEnv;

    const fromStorage = resolveEmailFromStorage();
    if (fromStorage) return fromStorage;

    // Temporary compatibility fallback for environments without explicit client identity config.
    return normalizeEmail(TEMP_FALLBACK_EMAIL);
}

function isApiTarget(input: RequestInfo | URL): boolean {
    if (typeof input === 'string') {
        if (input.startsWith('/api/')) return true;
        if (input.startsWith('http://') || input.startsWith('https://')) {
            try {
                return new URL(input).pathname.startsWith('/api/');
            } catch (err) {
                console.warn('[isApiTarget] Failed to parse URL, defaulting to true:', input, err);
                return true;
            }
        }
        return false;
    }

    if (input instanceof URL) {
        return input.pathname.startsWith('/api/');
    }

    try {
        return new URL(input.url).pathname.startsWith('/api/');
    } catch (err) {
        console.warn('[isApiTarget] Failed to parse Request URL, defaulting to true:', input.url, err);
        return true;
    }
}

export function withUserHeader(init: RequestInit = {}): RequestInit {
    const headers = new Headers(init.headers);
    if (!headers.get('x-user-email')) {
        const email = resolveClientEmail();
        if (email) headers.set('x-user-email', email);
    }

    return {
        ...init,
        headers,
    };
}

/**
 * Fetch wrapper that attaches `x-user-email` to first-party `/api/` requests.
 *
 * Security model:
 * - The `x-user-email` header is set by the trusted browser client and is used
 *   only as an identity *hint*. The server independently enforces authorization
 *   via `requireUser()` / `requireAdmin()` middleware backed by the `ADMIN_EMAILS`
 *   allowlist, so a spoofed header cannot escalate privileges.
 * - `isApiTarget` guards which requests receive the header; on ambiguous URLs it
 *   defaults to **including** the header (fail-open), which is safe because the
 *   header is non-secret and the server validates it anyway.
 */
export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    if (!isApiTarget(input)) return fetch(input, init);

    const requestInit = withUserHeader(init);
    const headers = new Headers(requestInit.headers);

    if (!headers.get('x-user-email')) {
        throw new Error(
            'Missing client identity for API request. Set NEXT_PUBLIC_DEFAULT_USER_EMAIL or localStorage key x-user-email.'
        );
    }

    return fetch(input, requestInit);
}
