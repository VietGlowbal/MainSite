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
}

const RETRY_BASE_MINUTES = 5;

/**
 * Compute the next retry time using exponential backoff:
 * NOW() + (attempts^2 * 5 minutes).
 */
function computeNextAttemptAt(attempts: number): string {
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

  const { data, error } = await supabase.rpc('claim_course_parse_jobs', {
    worker_id: workerId,
    batch_size: batchSize,
  });

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
