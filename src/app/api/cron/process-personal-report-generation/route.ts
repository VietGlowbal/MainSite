import { NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/cron-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  blockApplicationPersonalReportGeneration,
  claimApplicationPersonalReportGenerations,
  markApplicationPersonalReportGenerationComplete,
  regeneratePersonalReport,
  retryApplicationPersonalReportGeneration,
} from '@/features/apply/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DEFAULT_BATCH = 2;
const MAX_BATCH = 5;

async function processJob(job: Awaited<ReturnType<typeof claimApplicationPersonalReportGenerations>>[number]) {
  try {
    const result = await regeneratePersonalReport({
      supabase: createAdminClient(), userId: job.user_id, applicationId: job.application_id,
      trigger: job.trigger, force: job.force_requested,
    });
    if (result.status === 'cached' || result.status === 'regenerated') {
      await markApplicationPersonalReportGenerationComplete(job.id, {
        reportVersionId: result.record.id,
        confirmedSnapshotId: result.record.confirmedSnapshotId,
        inputHash: result.record.inputHash,
      });
      return 'complete';
    }
    if (result.status === 'snapshot_missing' || result.status === 'migration_missing' || result.status === 'not_configured') {
      await blockApplicationPersonalReportGeneration(
        job.id,
        result.status.toUpperCase(),
        result.status === 'snapshot_missing' ? 'Confirm Candidate Information before generating this report.' : 'Generation prerequisites are unavailable.',
      );
      return 'blocked';
    }
    await retryApplicationPersonalReportGeneration(job.id, job.attempts, 'AI_GENERATION_FAILED', result.message);
    return 'retry';
  } catch (error) {
    await retryApplicationPersonalReportGeneration(
      job.id, job.attempts, 'WORKER_ERROR', error instanceof Error ? error.message : 'Unknown worker failure.',
    );
    return 'retry';
  }
}

async function handle(request: Request) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const requested = Number.parseInt(new URL(request.url).searchParams.get('batch') ?? '', 10);
  const batchSize = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), MAX_BATCH) : DEFAULT_BATCH;
  const jobs = await claimApplicationPersonalReportGenerations(`vercel-cron-${Date.now()}`, batchSize);
  const results = await Promise.all(jobs.map(processJob));
  return NextResponse.json({ claimed: jobs.length, complete: results.filter((result) => result === 'complete').length, retry: results.filter((result) => result === 'retry').length, blocked: results.filter((result) => result === 'blocked').length });
}

export async function GET(request: Request) { return handle(request); }
export async function POST(request: Request) { return handle(request); }
