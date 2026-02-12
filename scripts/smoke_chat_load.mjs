#!/usr/bin/env node

const baseUrl = (process.env.SMOKE_CHAT_URL || 'http://localhost:3000').replace(/\/$/, '');
const totalRequests = Number(process.env.SMOKE_CHAT_TOTAL || 200);
const concurrency = Number(process.env.SMOKE_CHAT_CONCURRENCY || 30);
const path = process.env.SMOKE_CHAT_PATH || '/api/chat';
const timeoutMs = Number(process.env.SMOKE_CHAT_TIMEOUT_MS || 30000);
const thresholdErrorRate = Number(process.env.SMOKE_CHAT_MAX_ERROR_RATE || 0.01);
const thresholdDegradedRate = Number(process.env.SMOKE_CHAT_MAX_DEGRADED_RATE || 0.10);
const thresholdP95 = Number(process.env.SMOKE_CHAT_MAX_P95_MS || 8000);

const testEmails = [
  'load-test-01@example.com',
  'load-test-02@example.com',
  'load-test-03@example.com',
  'load-test-04@example.com',
  'load-test-05@example.com',
  'load-test-06@example.com',
  'load-test-07@example.com',
  'load-test-08@example.com',
  'load-test-09@example.com',
  'load-test-10@example.com',
];

const endpoint = `${baseUrl}${path}`;

const stats = {
  success: 0,
  degraded: 0,
  errors: 0,
  durations: [],
  statusCounts: new Map(),
};

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function incrementStatus(status) {
  stats.statusCounts.set(status, (stats.statusCounts.get(status) || 0) + 1);
}

async function runOne(index) {
  const email = testEmails[index % testEmails.length];
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-email': email,
      },
      body: JSON.stringify({
        query: `Smoke load request #${index + 1}`,
        settings: { ragEngine: 'v1' },
      }),
      signal: controller.signal,
    });

    const elapsed = Date.now() - startedAt;
    stats.durations.push(elapsed);
    incrementStatus(response.status);

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    const success = Boolean(response.ok && payload?.success === true);
    const degraded = Boolean(payload?.data?.degraded === true);

    if (success) {
      stats.success += 1;
      if (degraded) stats.degraded += 1;
    } else {
      stats.errors += 1;
    }
  } catch {
    const elapsed = Date.now() - startedAt;
    stats.durations.push(elapsed);
    incrementStatus('network_error');
    stats.errors += 1;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function run() {
  const startedAt = Date.now();
  let cursor = 0;

  async function worker() {
    while (true) {
      const current = cursor;
      cursor += 1;
      if (current >= totalRequests) return;
      await runOne(current);
    }
  }

  const workers = Array.from({ length: Math.max(1, concurrency) }, () => worker());
  await Promise.all(workers);

  const elapsed = Date.now() - startedAt;
  const p95 = percentile(stats.durations, 95);
  const successRate = stats.success / totalRequests;
  const degradedRate = stats.degraded / totalRequests;
  const errorRate = stats.errors / totalRequests;

  const summary = {
    endpoint,
    total_requests: totalRequests,
    concurrency,
    duration_ms: elapsed,
    success_count: stats.success,
    degraded_count: stats.degraded,
    error_count: stats.errors,
    success_rate: Number(successRate.toFixed(4)),
    degraded_rate: Number(degradedRate.toFixed(4)),
    error_rate: Number(errorRate.toFixed(4)),
    p95_ms: p95,
    status_counts: Object.fromEntries(stats.statusCounts.entries()),
    acceptance: {
      max_error_rate: thresholdErrorRate,
      max_degraded_rate: thresholdDegradedRate,
      max_p95_ms: thresholdP95,
      passed: errorRate <= thresholdErrorRate
        && degradedRate <= thresholdDegradedRate
        && p95 <= thresholdP95,
    },
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!summary.acceptance.passed) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error('[smoke_chat_load] fatal error', error);
  process.exit(1);
});
