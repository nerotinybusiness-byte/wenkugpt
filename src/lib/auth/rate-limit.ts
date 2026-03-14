/**
 * WENKUGPT - Per-user rate limiting
 *
 * Uses the daily_prompt_count / last_prompt_reset columns on the users table.
 * Limit: 50 queries per rolling 24-hour window.
 */

import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

const DAILY_LIMIT = 50;
const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface RateLimitResult {
    ok: boolean;
    remaining: number;
    resetsAt: Date;
}

/**
 * Check and increment the per-user rate limit.
 *
 * Atomically resets the counter if the window has elapsed, otherwise increments.
 * Returns { ok: false } when the limit has been exceeded.
 */
export async function checkUserRateLimit(userId: string): Promise<RateLimitResult> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - WINDOW_MS);

    // Atomic: if window expired → reset to 1, else increment
    const rows = await db
        .update(users)
        .set({
            dailyPromptCount: sql`CASE
                WHEN ${users.lastPromptReset} < ${windowStart.toISOString()}::timestamptz
                    THEN 1
                ELSE ${users.dailyPromptCount} + 1
            END`,
            lastPromptReset: sql`CASE
                WHEN ${users.lastPromptReset} < ${windowStart.toISOString()}::timestamptz
                    THEN NOW()
                ELSE ${users.lastPromptReset}
            END`,
        })
        .where(eq(users.id, userId))
        .returning({
            dailyPromptCount: users.dailyPromptCount,
            lastPromptReset: users.lastPromptReset,
        });

    if (rows.length === 0) {
        // User not found — shouldn't happen after requireUser(), treat as allowed
        return { ok: true, remaining: DAILY_LIMIT - 1, resetsAt: new Date(now.getTime() + WINDOW_MS) };
    }

    const { dailyPromptCount, lastPromptReset } = rows[0];
    const resetsAt = new Date(new Date(lastPromptReset).getTime() + WINDOW_MS);
    const remaining = Math.max(0, DAILY_LIMIT - dailyPromptCount);

    return {
        ok: dailyPromptCount <= DAILY_LIMIT,
        remaining,
        resetsAt,
    };
}
