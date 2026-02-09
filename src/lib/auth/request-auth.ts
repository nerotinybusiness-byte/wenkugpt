import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, type UserRole } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { apiError } from '@/lib/api/response';
import { getRequestId, logError } from '@/lib/logger';

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

function getRequestEmail(request: NextRequest): string | null {
    const headerEmail = request.headers.get('x-user-email');
    if (!headerEmail) {
        // Security hardening: production always requires explicit identity header.
        if (process.env.NODE_ENV !== 'production') {
            const devEmail = process.env.DEV_DEFAULT_USER_EMAIL?.trim().toLowerCase();
            if (devEmail && devEmail.includes('@')) return devEmail;

            // Optional local fallback to first admin allowlist email
            const firstAdmin = [...parseAdminAllowlist()][0];
            if (firstAdmin) return firstAdmin;
        }
        return null;
    }

    const normalized = headerEmail.trim().toLowerCase();
    if (!normalized || !normalized.includes('@')) return null;
    return normalized;
}

async function resolveUserByEmail(email: string): Promise<RequestUser> {
    const adminAllowlist = parseAdminAllowlist();
    const isAllowlistedAdmin = adminAllowlist.has(email);

    const found = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (found.length > 0) {
        const existing = found[0];
        const role = isAllowlistedAdmin ? 'admin' : existing.role;

        // Keep DB role aligned with allowlist when needed
        if (existing.role !== role) {
            await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, existing.id));
        }

        return {
            id: existing.id,
            email: existing.email,
            role,
        };
    }

    const [created] = await db.insert(users).values({
        email,
        role: isAllowlistedAdmin ? 'admin' : 'user',
    }).returning();

    return {
        id: created.id,
        email: created.email,
        role: created.role,
    };
}

export async function requireUser(request: NextRequest): Promise<AuthResult> {
    const email = getRequestEmail(request);
    if (!email) {
        return {
            ok: false,
            response: apiError(
                'AUTH_UNAUTHORIZED',
                'Missing identity header. Set x-user-email.',
                401
            ),
        };
    }

    try {
        const user = await resolveUserByEmail(email);
        return { ok: true, user };
    } catch (error) {
        const requestId = getRequestId(request);
        logError('Auth resolution failed', { route: 'auth', requestId }, error);
        return {
            ok: false,
            response: apiError(
                'AUTH_RESOLUTION_FAILED',
                'Could not resolve user identity.',
                500
            ),
        };
    }
}

export async function requireAdmin(request: NextRequest): Promise<AuthResult> {
    const auth = await requireUser(request);
    if (!auth.ok) return auth;

    if (auth.user.role !== 'admin') {
        return {
            ok: false,
            response: apiError(
                'AUTH_FORBIDDEN',
                'Admin role is required for this endpoint.',
                403
            ),
        };
    }

    return auth;
}
