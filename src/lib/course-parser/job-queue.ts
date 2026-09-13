/**
 * Course Parse Job Queue — Data access layer
 *
 * Durable background job queue for parsing official course pages and building
 * application checklists. Jobs are stored in the `course_parse_jobs` table and
 * claimed atomically by background workers via the `claim_course_parse_jobs`
 * PostgreSQL function (FOR UPDATE SKIP LOCKED).
 *
 * Retry strategy: exponential backoff using `NOW() + attempts^2 * 5 minutes`.
 *
 * These operations run with the service-role client so they can manage the
 * queue regardless of the calling user's RLS scope.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { recoverGatewayTimeout } from '@/lib/supabase/recover-gateway-timeout';

export type ParseJobStatus =
  | 'pending'
  | 'processing'
  | 'complete'
  | 'timeout'
  | 'failed';

export interface CourseParseJob {
  id: string;
  application_id: string;
  course_url: string;
  university_id: number | null;
  status: ParseJobStatus;
  attempts: number;
  max_attempts: number;
  next_attempt_at: string | null;
  error_message: string | null;
  parsed_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
  locked_by?: string | null;
  phase?: string | null;
}

const RETRY_BASE_MINUTES = 5;

/**
 * Compute the next retry time using exponential backoff:
 * NOW() + (attempts^2 * 5 minutes).
 */
export function computeNextAttemptAt(attempts: number): string {
  const delayMs = attempts * attempts * RETRY_BASE_MINUTES * 60 * 1000;
  return new Date(Date.now() + delayMs).toISOString();
}

/**
 * Create a parse job for a single application.
 *
 * Uses upsert on `application_id` (which is UNIQUE) so re-adding a course does
 * not create duplicate jobs.
 */
export async function createParseJob(
  applicationId: string,
  courseUrl: string,
  universityId: number | null
): Promise<CourseParseJob | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('course_parse_jobs')
    .upsert(
      {
        application_id: applicationId,
        course_url: courseUrl,
        university_id: universityId,
        status: 'pending',
        attempts: 0,
        next_attempt_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'application_id' }
    )
    .select()
    .single();

  if (error) {
    console.error('Failed to create parse job:', error);
    throw error;
  }

  return data as CourseParseJob;
}

/**
 * Create parse jobs for a batch of applications.
 */
export async function createParseJobsForApplications(
  applications: Array<{
    applicationId: string;
    courseUrl: string;
    universityId: number | null;
  }>
): Promise<CourseParseJob[]> {
  if (applications.length === 0) return [];

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const rows = applications.map((app) => ({
    application_id: app.applicationId,
    course_url: app.courseUrl,
    university_id: app.universityId,
    status: 'pending' as const,
    attempts: 0,
    next_attempt_at: now,
    updated_at: now,
  }));

  const { data, error } = await supabase
    .from('course_parse_jobs')
    .upsert(rows, { onConflict: 'application_id' })
    .select();

  if (error) {
    console.error('Failed to create parse jobs batch:', error);
    throw error;
  }

  return (data || []) as CourseParseJob[];
}

/**
 * Atomically claim a batch of pending jobs for a worker.
 */
export async function claimPendingJobs(
  workerId: string,
  batchSize: number
): Promise<CourseParseJob[]> {
  const supabase = createAdminClient();

  const { data, error } = await recoverGatewayTimeout(
    async () => supabase.rpc('claim_course_parse_jobs', {
      worker_id: workerId,
      batch_size: batchSize,
    }),
    async () => {
      const { data: claimed, error: recoveryError } = await supabase
        .from('course_parse_jobs')
        .select('*')
        .eq('locked_by', workerId)
        .eq('status', 'processing');
      return recoveryError ? null : Array.isArray(claimed) ? claimed as CourseParseJob[] : [];
    },
  );

  if (error) {
    console.error('Failed to claim parse jobs:', error);
    throw error;
  }

  return (data || []) as CourseParseJob[];
}

/**
 * Update a job's status and optional fields (parsed data, timestamps).
 */
export async function updateJobStatus(
  jobId: string,
  status: ParseJobStatus,
  data: Partial<Pick<CourseParseJob, 'parsed_data' | 'error_message'>> = {}
): Promise<void> {
  const supabase = createAdminClient();

  const update: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
    ...data,
  };

  if (status === 'complete' || status === 'failed' || status === 'timeout') {
    update.completed_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('course_parse_jobs')
    .update(update)
    .eq('id', jobId);

  if (error) {
    console.error('Failed to update job status:', error);
    throw error;
  }
}

/**
 * Record a job failure. When `shouldRetry` is true the job is returned to the
 * pending queue with an exponential-backoff `next_attempt_at`; otherwise it is
 * marked failed.
 */
export async function recordJobFailure(
  jobId: string,
  error: string,
  shouldRetry: boolean
): Promise<void> {
  const supabase = createAdminClient();

  // Read current attempts to compute backoff.
  const { data: job } = await supabase
    .from('course_parse_jobs')
    .select('attempts')
    .eq('id', jobId)
    .single();

  const attempts = job?.attempts ?? 1;

  const update: Record<string, unknown> = {
    error_message: error,
    updated_at: new Date().toISOString(),
  };

  if (shouldRetry) {
    update.status = 'pending';
    update.next_attempt_at = computeNextAttemptAt(attempts);
  } else {
    update.status = 'failed';
    update.completed_at = new Date().toISOString();
  }

  const { error: updateError } = await supabase
    .from('course_parse_jobs')
    .update(update)
    .eq('id', jobId);

  if (updateError) {
    console.error('Failed to record job failure:', updateError);
    throw updateError;
  }
}

/**
 * Get the parse job for a given application, if any.
 */
export async function getJobByApplicationId(
  applicationId: string
): Promise<CourseParseJob | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('course_parse_jobs')
    .select('*')
    .eq('application_id', applicationId)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch job by application id:', error);
    return null;
  }

  return (data as CourseParseJob) || null;
}

/**
 * Count jobs currently pending (claimable now).
 */
export async function getPendingJobsCount(): Promise<number> {
  const supabase = createAdminClient();

  const { count, error } = await supabase
    .from('course_parse_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  if (error) {
    console.error('Failed to count pending jobs:', error);
    return 0;
  }

  return count || 0;
}

export interface StaleJobReapDetail {
  id: string;
  applicationId: string;
  action: 'recovered' | 'failed';
  attempts: number;
  reason: string;
}

export interface StaleJobReapResult {
  reaped: number;
  recovered: number;
  failed: number;
  jobs: StaleJobReapDetail[];
}

/**
 * Watchdog/reaper: safely reclaims stale or zombie course parse jobs that
 * remained in the `processing` status due to worker timeouts, crashes, or unhandled
 * errors.
 *
 * - Stale jobs within the retry budget (attempts < max_attempts) are returned
 *   to `pending` status with exponential backoff and application parse_status
 *   reset to `pending`.
 * - Jobs that have exhausted their retry budget or reached a terminal threshold
 *   are marked `failed` with a user-facing timeout message.
 * - Stranded application rows in `processing` with no active job are also reconciled.
 */
export async function reapStaleParseJobs(
  staleThresholdMinutes = 10
): Promise<StaleJobReapResult> {
  const supabase = createAdminClient();
  const cutoffMs = Date.now() - staleThresholdMinutes * 60 * 1000;
  const cutoffIso = new Date(cutoffMs).toISOString();

  const details: StaleJobReapDetail[] = [];

  // Query jobs currently in 'processing' status
  const { data: processingJobs, error: fetchError } = await supabase
    .from('course_parse_jobs')
    .select('id, application_id, status, attempts, max_attempts, started_at, updated_at, error_message')
    .eq('status', 'processing');

  if (fetchError) {
    console.error('[job-queue] Failed to fetch processing jobs for reaping:', fetchError);
    return { reaped: 0, recovered: 0, failed: 0, jobs: [] };
  }

  const staleJobs = (processingJobs || []).filter((job) => {
    const started = job.started_at ? new Date(job.started_at).getTime() : null;
    const updated = job.updated_at ? new Date(job.updated_at).getTime() : null;
    const effectiveTime = started ?? updated;
    return effectiveTime !== null && effectiveTime <= cutoffMs;
  });

  for (const job of staleJobs) {
    const attempts = job.attempts ?? 1;
    const maxAttempts = job.max_attempts ?? 3;
    const canRetry = attempts < maxAttempts;

    if (canRetry) {
      const nextAttemptAt = computeNextAttemptAt(attempts);
      // Concurrency guard: update only if still in 'processing' status to avoid racing completions
      const { data: updatedJobRows, error: jobUpdateError } = await supabase
        .from('course_parse_jobs')
        .update({
          status: 'pending',
          locked_by: null,
          next_attempt_at: nextAttemptAt,
          error_message: 'Job processing timed out; re-enqueued for retry.',
          phase: 'queued',
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id)
        .eq('status', 'processing')
        .select('id, status');

      if (jobUpdateError || !updatedJobRows || updatedJobRows.length === 0) {
        // Job was completed or claimed concurrently; do not overwrite
        continue;
      }

      // Settle the application row back to pending, guarded by parse_status='processing'
      await supabase
        .from('course_applications')
        .update({
          parse_status: 'pending',
          progress_percentage: 0,
          parse_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.application_id)
        .eq('parse_status', 'processing');

      details.push({
        id: job.id,
        applicationId: job.application_id,
        action: 'recovered',
        attempts,
        reason: 'Stale processing lease expired; re-enqueued to pending with backoff.',
      });
    } else {
      // Concurrency guard for exhausted attempts
      const { data: updatedJobRows, error: jobUpdateError } = await supabase
        .from('course_parse_jobs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: 'Course parsing timed out after maximum attempts.',
          phase: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id)
        .eq('status', 'processing')
        .select('id, status');

      if (jobUpdateError || !updatedJobRows || updatedJobRows.length === 0) {
        continue;
      }

      await supabase
        .from('course_applications')
        .update({
          parse_status: 'failed',
          progress_percentage: 0,
          parse_error: 'Reading this course page timed out. You can try again.',
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.application_id)
        .eq('parse_status', 'processing');

      details.push({
        id: job.id,
        applicationId: job.application_id,
        action: 'failed',
        attempts,
        reason: 'Retry budget exhausted during processing timeout.',
      });
    }
  }

  // Defensively reconcile any application stuck in 'processing' whose updated_at <= cutoffIso
  try {
    const { data: strandedApps } = await supabase
      .from('course_applications')
      .select('id, parse_status, updated_at')
      .eq('parse_status', 'processing')
      .lte('updated_at', cutoffIso);

    if (strandedApps && strandedApps.length > 0) {
      const reapedAppIds = new Set(details.map((d) => d.applicationId));
      for (const app of strandedApps) {
        if (reapedAppIds.has(app.id)) continue;

        // Check if there is an existing job for this application
        const { data: job } = await supabase
          .from('course_parse_jobs')
          .select('id, status, error_message')
          .eq('application_id', app.id)
          .maybeSingle();

        if (job?.status === 'complete') {
          await supabase
            .from('course_applications')
            .update({ parse_status: 'complete', updated_at: new Date().toISOString() })
            .eq('id', app.id)
            .eq('parse_status', 'processing');
        } else if (job?.status === 'pending') {
          // Reconcile application to pending queued state
          await supabase
            .from('course_applications')
            .update({
              parse_status: 'pending',
              progress_percentage: 0,
              parse_error: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', app.id)
            .eq('parse_status', 'processing');
        } else if (job?.status === 'failed' || job?.status === 'timeout') {
          await supabase
            .from('course_applications')
            .update({
              parse_status: 'failed',
              parse_error: job.error_message || 'Reading this course page failed. You can try again.',
              updated_at: new Date().toISOString(),
            })
            .eq('id', app.id)
            .eq('parse_status', 'processing');
        } else if (!job) {
          // No job at all; mark application failed so student can retry
          await supabase
            .from('course_applications')
            .update({
              parse_status: 'failed',
              parse_error: 'Course reading was interrupted. You can try again.',
              updated_at: new Date().toISOString(),
            })
            .eq('id', app.id)
            .eq('parse_status', 'processing');
        }
      }
    }
  } catch (err) {
    console.error('[job-queue] Stranded applications check warning:', err);
  }

  return {
    reaped: details.length,
    recovered: details.filter((d) => d.action === 'recovered').length,
    failed: details.filter((d) => d.action === 'failed').length,
    jobs: details,
  };
}
