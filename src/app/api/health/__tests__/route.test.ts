import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

describe('GET /api/health', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    it('returns ok status when db check succeeds', async () => {
        const execute = vi.fn().mockResolvedValue(undefined);
        vi.doMock('@/lib/db', () => ({ db: { execute } }));

        const { GET } = await import('@/app/api/health/route');
        const response = await GET(new NextRequest('http://localhost/api/health'));

        expect(response.status).toBe(200);
        const payload = await response.json();
        expect(payload.success).toBe(true);
        expect(payload.data.status).toBe('ok');
        expect(payload.data.db).toBe('ok');
        expect(typeof payload.data.durationMs).toBe('number');
    });

    it('returns degraded status when db check fails', async () => {
        const execute = vi.fn().mockRejectedValue(new Error('db down'));
        vi.doMock('@/lib/db', () => ({ db: { execute } }));

        const { GET } = await import('@/app/api/health/route');
        const response = await GET(new NextRequest('http://localhost/api/health'));

        expect(response.status).toBe(503);
        const payload = await response.json();
        expect(payload).toMatchObject({
            success: false,
            code: 'HEALTH_DB_DEGRADED',
            error: 'Database connectivity check failed',
        });
        expect(payload.details.status).toBe('degraded');
        expect(payload.details.db).toBe('error');
    });
});
