import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getRequestId, logWarn } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const start = Date.now();
  try {
    // Simple DB connectivity check
    await db.execute('SELECT 1');

    const durationMs = Date.now() - start;
    return apiSuccess({
      status: 'ok',
      db: 'ok',
      durationMs,
    });
  } catch (error) {
    const durationMs = Date.now() - start;
    const requestId = getRequestId(request);
    logWarn('Health check degraded', { route: '/api/health', requestId, durationMs }, error);
    return apiError(
      'HEALTH_DB_DEGRADED',
      'Database connectivity check failed',
      503,
      {
        status: 'degraded',
        db: 'error',
        durationMs,
      },
    );
  }
}

