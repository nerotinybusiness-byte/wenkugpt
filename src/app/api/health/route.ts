import { db } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

export async function GET() {
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
  } catch {
    const durationMs = Date.now() - start;
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

