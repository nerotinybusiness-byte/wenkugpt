import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, type UserRole } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { apiError } from '@/lib/api/response';
import { logError } from '@/lib/logger';

export interface RequestUser {
    id: string;
    email: string;
    role: UserRole;
}

type AuthResult =
    | { ok: true; user: RequestUser }
    | { ok: false; response: NextResponse };

function parseAdminAllowlist(): Set<string> {
    return new Set(
        (process.env.ADMIN_EMAILS ?? '')
            .split(',')
            .map((email) => email.trim().toLowerCase())
            .filter(Boolean)
    );
}

/**
 * Resolves the caller's identity email from (in priority order):
 * 1. x-user-email request header
 * 2. DEV_DEFAULT_USER_EMAIL env var
 * 3. First entry in ADMIN_EMAILS env var
 *
 * Returns null if no identity can be determined → caller gets 401.
 */
function resolveIdentityEmail(request: NextRequest): string | null {
    const headerEmail = request.headers.get('x-user-email')?.trim().toLowerCase();
    if (headerEmail?.includes('@')) return headerEmail;

    const devEmail = process.env.DEV_DEFAULT_USER_EMAIL?.trim().toLowerCase();
    if (devEmail?.includes('@')) return devEmail;

    return [...parseAdminAllowlist()][0] ?? null;
}

async function resolveOrCreateUserByEmail(email: string): Promise<RequestUser> {
    const adminAllowlist = parseAdminAllowlist();
    const role: UserRole = adminAllowlist.has(email) ? 'admin' : 'user';

    const found = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (found.length > 0) {
        const existing = found[0];
        if (existing.role !== role) {
            await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, existing.id));
        }
        return { id: existing.id, email: existing.email, role };
    }

    const [created] = await db.insert(users).values({ email, role }).returning();
    return { id: created.id, email: created.email, role: created.role };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function requireUser(request: NextRequest): Promise<AuthResult> {
    try {
        const email = resolveIdentityEmail(request);
        if (!email) {
            return {
                ok: false,
                response: apiError('AUTH_UNAUTHORIZED', 'Not authenticated. Set x-user-email header.', 401),
            };
        }

        const user = await resolveOrCreateUserByEmail(email);
        return { ok: true, user };
    } catch (error) {
        logError('Auth resolution failed', { route: 'auth' }, error);
        return {
            ok: false,
            response: apiError('AUTH_RESOLUTION_FAILED', 'Could not resolve user identity.', 500),
        };
    }
}

export async function requireAdmin(request: NextRequest): Promise<AuthResult> {
    const authResult = await requireUser(request);
    if (!authResult.ok) return authResult;

    if (authResult.user.role !== 'admin') {
        return {
            ok: false,
            response: apiError('AUTH_FORBIDDEN', 'Admin role is required for this endpoint.', 403),
        };
    }

    return authResult;
}
