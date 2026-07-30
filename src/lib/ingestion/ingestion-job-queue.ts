/**
 * Programme Ingestion Job Queue — Data access layer
 *
 * Durable background job queue for the Python-based programme ingestion worker.
 * Jobs are stored in `programme_ingestion_jobs` and claimed atomically via the
 * `claim_programme_ingestion_jobs` RPC (FOR UPDATE SKIP LOCKED).
 *
 * All operations use the service-role client (server-only).
 */

import { createAdminClient } from '@/lib/supabase/admin';

export type IngestionJobStatus =
  | 'pending'
  | 'processing'
  | 'complete'
  | 'needs_review'
  | 'retry'
  | 'failed'
  | 'cancelled';

export type IngestionJobStage =
  | 'queued'
  | 'cache_lookup'
  | 'policy_check'
  | 'fetching'
  | 'extracting_deterministic'
  | 'extracting_deep'
  | 'validating'
  | 'persisting'
  | 'complete'
  | 'needs_review'
  | 'failed';

export interface ProgrammeIngestionJob {
  id: string;
  application_id: string;
  user_id: string;
  university_id: number | null;
  institution_id: string | null;
  submitted_url: string;
  canonical_url: string;
  status: IngestionJobStatus;
  stage: IngestionJobStage | null;
  progress_percentage: number;
  attempts: number;
  max_attempts: number;
  next_attempt_at: string;
  locked_at: string | null;
  locked_by: string | null;
  result_run_id: string | null;
  result_programme_id: string | null;
  cache_hit: boolean | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
}

const RETRY_BASE_MINUTES = 5;

function computeNextAttemptAt(attempts: number): string {
  const delayMs = attempts * attempts * RETRY_BASE_MINUTES * 60 * 1000;
  return new Date(Date.now() + delayMs).toISOString();
}

/**
 * Create or upsert an ingestion job for an application.
 * Idempotent: re-submitting the same application_id resets to pending
 * only if the existing job is failed/cancelled.
 */
export async function createIngestionJob(opts: {
  applicationId: string;
  userId: string;
  universityId: number | null;
  institutionId: string | null;
  submittedUrl: string;
  canonicalUrl: string;
}): Promise<ProgrammeIngestionJob> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: existing, error: lookupError } = await supabase
    .from('programme_ingestion_jobs')
    .select('*')
    .eq('application_id', opts.applicationId)
    .maybeSingle();

  if (lookupError) {
    console.error('[ingestion-job-queue] Failed to look up job:', lookupError);
    throw lookupError;
  }
  if (
    existing &&
    !['failed', 'cancelled'].includes(existing.status as string)
  ) {
    return existing as ProgrammeIngestionJob;
  }

  const values = {
    application_id: opts.applicationId,
    user_id: opts.userId,
    university_id: opts.universityId,
    institution_id: opts.institutionId,
    submitted_url: opts.submittedUrl,
    canonical_url: opts.canonicalUrl,
    status: 'pending',
    stage: 'queued',
    progress_percentage: 0,
    attempts: 0,
    next_attempt_at: now,
    locked_at: null,
    locked_by: null,
    error_code: null,
    error_message: null,
    completed_at: null,
    updated_at: now,
  };

  const query = existing
    ? supabase
        .from('programme_ingestion_jobs')
        .update(values)
        .eq('id', existing.id)
    : supabase.from('programme_ingestion_jobs').insert(values);

  const { data, error } = await query
    .select()
    .single();

  if (error || !data) {
    console.error('[ingestion-job-queue] Failed to create job:', error);
    throw error ?? new Error('Failed to create ingestion job');
  }

  return data as ProgrammeIngestionJob;
}

/**
 * Get an ingestion job by application ID, if one exists.
 */
export async function getIngestionJobByApplicationId(
  applicationId: string
): Promise<ProgrammeIngestionJob | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('programme_ingestion_jobs')
    .select('*')
    .eq('application_id', applicationId)
    .maybeSingle();

  if (error) {
    console.error('[ingestion-job-queue] Failed to fetch job:', error);
    return null;
  }

  return (data as ProgrammeIngestionJob) ?? null;
}

/**
 * Mark an ingestion job as a cache hit with the resolved programme data.
 */
export async function markJobCacheHit(
  jobId: string,
  runId: string,
  programmeId: string
): Promise<void> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('programme_ingestion_jobs')
    .update({
      status: 'complete',
      stage: 'complete',
      progress_percentage: 100,
      cache_hit: true,
      result_run_id: runId,
      result_programme_id: programmeId,
      completed_at: now,
      updated_at: now,
    })
    .eq('id', jobId);

  if (error) {
    console.error('[ingestion-job-queue] Failed to mark cache hit:', error);
    throw error;
  }
}

/**
 * Update job progress/stage (called by the Python worker via Supabase REST).
 * This TypeScript version is used if server-side progress updates are needed.
 */
export async function updateIngestionJobProgress(
  jobId: string,
  stage: IngestionJobStage,
  progressPercentage: number
): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('programme_ingestion_jobs')
    .update({
      stage,
      progress_percentage: progressPercentage,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  if (error) {
    console.error('[ingestion-job-queue] Failed to update progress:', error);
    throw error;
  }
}

/**
 * Mark an ingestion job as complete with result identifiers.
 */
export async function markJobComplete(
  jobId: string,
  opts: {
    runId: string;
    programmeId: string;
    cacheHit?: boolean;
  }
): Promise<void> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('programme_ingestion_jobs')
    .update({
      status: 'complete',
      stage: 'complete',
      progress_percentage: 100,
      cache_hit: opts.cacheHit ?? false,
      result_run_id: opts.runId,
      result_programme_id: opts.programmeId,
      completed_at: now,
      updated_at: now,
    })
    .eq('id', jobId);

  if (error) {
    console.error('[ingestion-job-queue] Failed to mark complete:', error);
    throw error;
  }
}

/**
 * Mark an ingestion job as failed (non-retryable) or schedule retry.
 */
export async function recordIngestionJobFailure(
  jobId: string,
  errorCode: string,
  errorMessage: string,
  opts: { shouldRetry: boolean; attempts: number; maxAttempts?: number }
): Promise<void> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const update: Record<string, unknown> = {
    error_code: errorCode,
    error_message: errorMessage,
    updated_at: now,
    locked_at: null,
    locked_by: null,
  };

  if (opts.shouldRetry && opts.attempts < (opts.maxAttempts ?? 3)) {
    update.status = 'retry';
    update.stage = null;
    update.next_attempt_at = computeNextAttemptAt(opts.attempts);
  } else {
    update.status = 'failed';
    update.stage = 'failed';
    update.completed_at = now;
  }

  const { error } = await supabase
    .from('programme_ingestion_jobs')
    .update(update)
    .eq('id', jobId);

  if (error) {
    console.error('[ingestion-job-queue] Failed to record failure:', error);
    throw error;
  }
}
