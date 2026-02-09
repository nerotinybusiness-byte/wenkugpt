import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

describe('API auth negative paths', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    it('returns AUTH_UNAUTHORIZED on GET /api/documents when auth fails', async () => {
        const requireAdmin = vi.fn().mockResolvedValue({
            ok: false,
            response: NextResponse.json(
                {
                    success: false,
                    data: null,
                    error: 'Missing identity header. Set x-user-email.',
                    code: 'AUTH_UNAUTHORIZED',
                },
                { status: 401 }
            ),
        });

        vi.doMock('@/lib/auth/request-auth', () => ({ requireAdmin }));
        vi.doMock('@/lib/db', () => ({ db: { select: vi.fn() } }));
        vi.doMock('@/lib/db/schema', () => ({ documents: { createdAt: 'createdAt' } }));
        vi.doMock('drizzle-orm', () => ({
            desc: vi.fn((value: unknown) => value),
            lt: vi.fn((left: unknown, right: unknown) => ({ left, right })),
        }));

        const { GET } = await import('@/app/api/documents/route');
        const response = await GET(new NextRequest('http://localhost/api/documents'));

        expect(response.status).toBe(401);
        const payload = await response.json();
        expect(payload).toMatchObject({
            success: false,
            code: 'AUTH_UNAUTHORIZED',
        });
    });

    it('returns AUTH_UNAUTHORIZED on GET /api/history when auth fails', async () => {
        const requireUser = vi.fn().mockResolvedValue({
            ok: false,
            response: NextResponse.json(
                {
                    success: false,
                    data: null,
                    error: 'Missing identity header. Set x-user-email.',
                    code: 'AUTH_UNAUTHORIZED',
                },
                { status: 401 }
            ),
        });

        vi.doMock('@/lib/auth/request-auth', () => ({ requireUser }));
        vi.doMock('@/lib/db', () => ({ db: { select: vi.fn(), delete: vi.fn() } }));
        vi.doMock('@/lib/db/schema', () => ({ chats: { userId: 'userId', updatedAt: 'updatedAt' } }));
        vi.doMock('drizzle-orm', () => ({
            and: vi.fn((left: unknown, right: unknown) => ({ left, right })),
            desc: vi.fn((value: unknown) => value),
            eq: vi.fn((left: unknown, right: unknown) => ({ left, right })),
            lt: vi.fn((left: unknown, right: unknown) => ({ left, right })),
        }));

        const { GET } = await import('@/app/api/history/route');
        const response = await GET(new NextRequest('http://localhost/api/history'));

        expect(response.status).toBe(401);
        const payload = await response.json();
        expect(payload).toMatchObject({
            success: false,
            code: 'AUTH_UNAUTHORIZED',
        });
    });

    it('returns AUTH_FORBIDDEN on DELETE /api/documents/:id for non-admin', async () => {
        const requireAdmin = vi.fn().mockResolvedValue({
            ok: false,
            response: NextResponse.json(
                {
                    success: false,
                    data: null,
                    error: 'Admin role is required for this endpoint.',
                    code: 'AUTH_FORBIDDEN',
                },
                { status: 403 }
            ),
        });

        vi.doMock('@/lib/auth/request-auth', () => ({ requireAdmin }));
        vi.doMock('@/lib/db', () => ({ db: { delete: vi.fn() } }));
        vi.doMock('@/lib/db/schema', () => ({ documents: { id: 'id' } }));
        vi.doMock('drizzle-orm', () => ({
            eq: vi.fn((left: unknown, right: unknown) => ({ left, right })),
        }));

        const { DELETE } = await import('@/app/api/documents/[id]/route');
        const request = new NextRequest('http://localhost/api/documents/doc-1', { method: 'DELETE' });
        const response = await DELETE(request, {
            params: Promise.resolve({ id: 'doc-1' }),
        });

        expect(response.status).toBe(403);
        const payload = await response.json();
        expect(payload).toMatchObject({
            success: false,
            code: 'AUTH_FORBIDDEN',
        });
    });
});
