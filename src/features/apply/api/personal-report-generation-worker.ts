import { randomUUID } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  blockApplicationPersonalReportGeneration,
  claimApplicationPersonalReportGenerations,
  markApplicationPersonalReportGenerationComplete,
  retryApplicationPersonalReportGeneration,
  type ApplicationPersonalReportGenerationJob,
} from './personal-report-generation-job-queue';
import { regeneratePersonalReport } from './personal-report-generation';

export const DEFAULT_PERSONAL_REPORT_GENERATION_BATCH = 2;
export const MAX_PERSONAL_REPORT_GENERATION_BATCH = 5;

async function processJob(job: ApplicationPersonalReportGenerationJob) {
  try {
    const result = await regeneratePersonalReport({
      supabase: createAdminClient(),
      userId: job.user_id,
      applicationId: job.application_id,
      trigger: job.trigger,
      force: job.force_requested,
    });
    if (result.status === 'cached' || result.status === 'regenerated') {
      await markApplicationPersonalReportGenerationComplete(job.id, {
        reportVersionId: result.record.id,
        confirmedSnapshotId: result.record.confirmedSnapshotId,
        inputHash: result.record.inputHash,
      });
      return 'complete' as const;
    }
    if (
      result.status === 'snapshot_missing' ||
      result.status === 'insufficient_evidence' ||
      result.status === 'migration_missing' ||
      result.status === 'not_configured'
    ) {
      await blockApplicationPersonalReportGeneration(
        job.id,
        result.status.toUpperCase(),
        result.status === 'snapshot_missing'
          ? 'Confirm Candidate Information before generating this report.'
          : result.status === 'insufficient_evidence'
            ? 'Add reflections, activities, or achievements before generating this report.'
            : 'Generation prerequisites are unavailable.',
      );
      return 'blocked' as const;
    }
    await retryApplicationPersonalReportGeneration(job.id, job.attempts, 'AI_GENERATION_FAILED', result.message);
    return 'retry' as const;
  } catch (error) {
    await retryApplicationPersonalReportGeneration(
      job.id,
      job.attempts,
      'WORKER_ERROR',
      error instanceof Error ? error.message : 'Unknown worker failure.',
    );
    return 'retry' as const;
  }
}

/**
 * Claims durable jobs before running them. It is safe for the request-time
 * kick and Vercel Cron to race: the RPC lease gives one worker each job.
 */
export async function processApplicationPersonalReportGenerations(batchSize = DEFAULT_PERSONAL_REPORT_GENERATION_BATCH) {
  const jobs = await claimApplicationPersonalReportGenerations(
    `personal-report-worker-${randomUUID()}`,
    Math.min(Math.max(batchSize, 1), MAX_PERSONAL_REPORT_GENERATION_BATCH),
  );
  const results = await Promise.all(jobs.map(processJob));
  return {
    claimed: jobs.length,
    complete: results.filter((result) => result === 'complete').length,
    retry: results.filter((result) => result === 'retry').length,
    blocked: results.filter((result) => result === 'blocked').length,
  };
}
