import { NextResponse, type NextRequest } from 'next/server';
import { isAuthorizedCron } from '@/lib/cron-auth';
import { claimPendingJobs } from '@/lib/course-parser/job-queue';
import { processParseJob } from '@/lib/course-parser/job-processor';

/**
 * GET/POST /api/cron/process-parse-jobs
 *
 * Scheduled worker that drains the course parse queue. Each run atomically
 * claims a batch of pending jobs (FOR UPDATE SKIP LOCKED) and processes them:
 * fetch + AI-parse the official course page, then write the extracted details
 * onto the course_applications row.
 *
 * This replaces the need to run scripts/course-parse-worker.mjs as a long-lived
 * process — Vercel Cron invokes this on a schedule instead.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer $CRON_SECRET`; manual runs can
 * use the service-role key. See src/lib/cron-auth.ts.
 *
 * Wire-up (vercel.json):
 *   { "path": "/api/cron/process-parse-jobs", "schedule": "* * * * *" }
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DEFAULT_BATCH = 5;
const MAX_BATCH = 20;

async function handle(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const requested = Number.parseInt(url.searchParams.get('batch') ?? '', 10);
  const batchSize = Number.isFinite(requested)
    ? Math.min(Math.max(requested, 1), MAX_BATCH)
    : DEFAULT_BATCH;

  const workerId = `vercel-cron-${Date.now()}`;

  let claimed;
  try {
    claimed = await claimPendingJobs(workerId, batchSize);
  } catch (error) {
    console.error('[process-parse-jobs] Failed to claim jobs:', error);
    return NextResponse.json(
      { error: 'Failed to claim jobs' },
      { status: 500 }
    );
  }

  if (!claimed || claimed.length === 0) {
    return NextResponse.json({ claimed: 0, processed: 0, results: [] });
  }

  // Process claimed jobs concurrently; each is independent.
  const results = await Promise.all(claimed.map((job) => processParseJob(job)));

  const summary = {
    claimed: claimed.length,
    processed: results.length,
    complete: results.filter((r) => r.status === 'complete').length,
    retried: results.filter((r) => r.status === 'retry').length,
    failed: results.filter((r) => r.status === 'failed').length,
    results,
  };

  console.log('[process-parse-jobs]', summary);
  return NextResponse.json(summary);
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
