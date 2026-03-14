import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
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

async function resolveUserByClerkSession(
    clerkUserId: string,
    email: string,
    name?: string | null,
    imageUrl?: string | null,
): Promise<RequestUser> {
    const adminAllowlist = parseAdminAllowlist();
    const isAllowlistedAdmin = adminAllowlist.has(email.toLowerCase());
    const role: UserRole = isAllowlistedAdmin ? 'admin' : 'user';

    // 1. Lookup by clerkId
    const byClerk = await db.select().from(users).where(eq(users.clerkId, clerkUserId)).limit(1);
    if (byClerk.length > 0) {
        const existing = byClerk[0];
        // Sync profile and role if changed
        const needsUpdate =
            existing.email !== email ||
            existing.name !== (name ?? existing.name) ||
            existing.imageUrl !== (imageUrl ?? existing.imageUrl) ||
            existing.role !== role;

        if (needsUpdate) {
            await db.update(users).set({
                email,
                ...(name != null && { name }),
                ...(imageUrl != null && { imageUrl }),
                role,
                updatedAt: new Date(),
            }).where(eq(users.id, existing.id));
        }

        return { id: existing.id, email, role };
    }

    // 2. Lookup by email — backfill clerkId (migration path)
    const byEmail = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (byEmail.length > 0) {
        const existing = byEmail[0];
        await db.update(users).set({
            clerkId: clerkUserId,
            ...(name != null && { name }),
            ...(imageUrl != null && { imageUrl }),
            role,
            updatedAt: new Date(),
        }).where(eq(users.id, existing.id));

        return { id: existing.id, email, role };
    }

    // 3. Create new user
    const [created] = await db.insert(users).values({
        clerkId: clerkUserId,
        email,
        name: name ?? undefined,
        imageUrl: imageUrl ?? undefined,
        role,
    }).returning();

    return { id: created.id, email: created.email, role: created.role };
}

/** Legacy dev fallback when CLERK_SECRET_KEY is absent */
async function resolveDevFallbackUser(): Promise<RequestUser | null> {
    if (process.env.NODE_ENV === 'production') return null;
    if (process.env.CLERK_SECRET_KEY) return null;

    const devEmail = process.env.DEV_DEFAULT_USER_EMAIL?.trim().toLowerCase();
    const email = devEmail && devEmail.includes('@')
        ? devEmail
        : [...parseAdminAllowlist()][0];

    if (!email) return null;

    const adminAllowlist = parseAdminAllowlist();
    const isAllowlistedAdmin = adminAllowlist.has(email);
    const role: UserRole = isAllowlistedAdmin ? 'admin' : 'user';

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
        // Dev fallback: no Clerk in local dev
        const devUser = await resolveDevFallbackUser();
        if (devUser) return { ok: true, user: devUser };

        const { userId: clerkUserId } = await auth();
        if (!clerkUserId) {
            return {
                ok: false,
                response: apiError('AUTH_UNAUTHORIZED', 'Not authenticated.', 401),
            };
        }

        const clerkUser = await currentUser();
        if (!clerkUser) {
            return {
                ok: false,
                response: apiError('AUTH_UNAUTHORIZED', 'Not authenticated.', 401),
            };
        }

        const email = clerkUser.emailAddresses[0]?.emailAddress;
        if (!email) {
            return {
                ok: false,
                response: apiError('AUTH_UNAUTHORIZED', 'No email address associated with account.', 401),
            };
        }

        const user = await resolveUserByClerkSession(
            clerkUserId,
            email.toLowerCase(),
            clerkUser.fullName,
            clerkUser.imageUrl,
        );

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
