#!/usr/bin/env node
/**
 * Course Parse Worker (poller)
 *
 * Production parsing runs on Vercel Cron via /api/cron/process-parse-jobs.
 * This script is a thin long-lived poller for local dev or non-Vercel hosting:
 * it repeatedly calls that same endpoint so all parsing logic lives in one
 * place (src/lib/course-parser/*).
 *
 * Usage:
 *   # against a running dev server
 *   npm run worker:dev
 *   # or explicitly
 *   WORKER_TARGET_URL=http://localhost:3000 \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   node --env-file=.env.local scripts/course-parse-worker.mjs
 *
 * Env:
 *   WORKER_TARGET_URL          Base URL of the app (default http://localhost:3000)
 *   SUPABASE_SERVICE_ROLE_KEY  Used as the cron Authorization bearer (or CRON_SECRET)
 *   CRON_SECRET                Alternative bearer token
 *   POLL_INTERVAL_MS           Poll cadence (default 5000)
 *   BATCH_SIZE                 Jobs per poll (default 5)
 */

const TARGET = (process.env.WORKER_TARGET_URL || 'http://localhost:3000').replace(/\/$/, '');
const TOKEN = process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '5000', 10);
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '5', 10);
const ENDPOINT = `${TARGET}/api/cron/process-parse-jobs?batch=${BATCH_SIZE}`;

if (!TOKEN) {
  console.error('Missing CRON_SECRET or SUPABASE_SERVICE_ROLE_KEY for cron auth.');
  process.exit(1);
}

let shuttingDown = false;

function log(message, meta = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), message, ...meta }));
}

async function pollOnce() {
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (!res.ok) {
      log('poll failed', { status: res.status });
      return;
    }
    const data = await res.json();
    if (data.claimed > 0) {
      log('processed batch', {
        claimed: data.claimed,
        complete: data.complete,
        retried: data.retried,
        failed: data.failed,
      });
    }
  } catch (err) {
    log('poll error', { error: err instanceof Error ? err.message : String(err) });
  }
}

async function loop() {
  log('worker started', { target: ENDPOINT, intervalMs: POLL_INTERVAL_MS });
  while (!shuttingDown) {
    await pollOnce();
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  log('worker stopped');
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    shuttingDown = true;
    log('shutting down', { signal: sig });
    setTimeout(() => process.exit(0), 100);
  });
}

loop();
