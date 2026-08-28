import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import type { PersonalReportTrigger } from '../domain';

export type ApplicationPersonalReportGenerationJobStatus =
  | 'pending'
  | 'processing'
  | 'retry'
  | 'complete'
  | 'blocked';

export type ApplicationPersonalReportGenerationJob = {
  id: string;
  user_id: string;
  application_id: string;
  status: ApplicationPersonalReportGenerationJobStatus;
  trigger: PersonalReportTrigger;
  idempotency_key: string | null;
  force_requested: boolean;
  attempts: number;
  next_attempt_at: string;
  locked_at: string | null;
  locked_by: string | null;
  confirmed_snapshot_id: string | null;
  input_hash: string | null;
  report_version_id: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

const TABLE = 'application_personal_report_generation_jobs';
const ACTIVE = new Set<ApplicationPersonalReportGenerationJobStatus>(['pending', 'processing', 'retry']);
const RETRY_BASE_MS = 5 * 60 * 1000;
const MAX_RETRY_MS = 6 * 60 * 60 * 1000;

export function isPersonalReportGenerationJobsMigrationMissing(error: { code?: string; message?: string } | null | undefined): boolean {
  return Boolean(error && (error.code === '42P01' || /application_personal_report_generation_jobs/i.test(error.message ?? '')));
}

function asJob(value: unknown): ApplicationPersonalReportGenerationJob | null {
  return value && typeof value === 'object' ? value as ApplicationPersonalReportGenerationJob : null;
}

export async function getApplicationPersonalReportGeneration(
  supabase: SupabaseClient,
  args: { userId: string; applicationId: string },
): Promise<{ job: ApplicationPersonalReportGenerationJob | null; migrationMissing: boolean }> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', args.userId)
    .eq('application_id', args.applicationId)
    .maybeSingle();
  if (error) {
    return { job: null, migrationMissing: isPersonalReportGenerationJobsMigrationMissing(error) };
  }
  return { job: asJob(data), migrationMissing: false };
}

export async function enqueueApplicationPersonalReportGeneration(
  supabase: SupabaseClient,
  args: { userId: string; applicationId: string; trigger: PersonalReportTrigger; force?: boolean; idempotencyKey?: string },
): Promise<{ job: ApplicationPersonalReportGenerationJob | null; migrationMissing: boolean }> {
  const current = await getApplicationPersonalReportGeneration(supabase, args);
  if (current.migrationMissing) return current;
  if (
    current.job &&
    args.idempotencyKey &&
    current.job.idempotency_key === args.idempotencyKey
  ) return current;
  if (current.job && ACTIVE.has(current.job.status)) {
    if (!args.force || current.job.force_requested) return current;
    const now = new Date().toISOString();
    const isWaitingToRun = current.job.status === 'pending' || current.job.status === 'retry';
    const { data, error } = await supabase.from(TABLE).update({
      force_requested: !isWaitingToRun,
      ...(isWaitingToRun ? {
        status: 'pending',
        next_attempt_at: now,
        error_code: null,
        error_message: null,
      } : {}),
      idempotency_key: args.idempotencyKey ?? current.job.idempotency_key,
      trigger: args.trigger,
      updated_at: now,
    })
      .eq('id', current.job.id).select().single();
    if (error) return { job: null, migrationMissing: isPersonalReportGenerationJobsMigrationMissing(error) };
    return { job: asJob(data), migrationMissing: false };
  }

  const now = new Date().toISOString();
  const values = {
    user_id: args.userId,
    application_id: args.applicationId,
    status: 'pending' as const,
    trigger: args.trigger,
    idempotency_key: args.idempotencyKey ?? null,
    // `force_requested` is only a concurrent rerun marker for a processing job.
    // A newly queued job must be completable by the worker.
    force_requested: false,
    attempts: 0,
    next_attempt_at: now,
    locked_at: null,
    locked_by: null,
    confirmed_snapshot_id: null,
    input_hash: null,
    report_version_id: null,
    error_code: null,
    error_message: null,
    completed_at: null,
    updated_at: now,
  };
  const write = current.job
    ? supabase.from(TABLE).update(values).eq('id', current.job.id)
    : supabase.from(TABLE).insert(values);
  const { data, error } = await write.select().single();
  if (error) {
    if (error.code === '23505') return getApplicationPersonalReportGeneration(supabase, args);
    return { job: null, migrationMissing: isPersonalReportGenerationJobsMigrationMissing(error) };
  }
  return { job: asJob(data), migrationMissing: false };
}

export async function claimApplicationPersonalReportGenerations(
  workerId: string,
  batchSize: number,
): Promise<ApplicationPersonalReportGenerationJob[]> {
  const { data, error } = await createAdminClient().rpc('claim_application_personal_report_generation_jobs', {
    p_worker_id: workerId,
    p_batch_size: batchSize,
  });
  if (error) throw error;
  return Array.isArray(data) ? data.map(asJob).filter((job): job is ApplicationPersonalReportGenerationJob => Boolean(job)) : [];
}

export async function markApplicationPersonalReportGenerationComplete(
  jobId: string,
  args: { reportVersionId: string; confirmedSnapshotId: string | null; inputHash: string },
): Promise<void> {
  const now = new Date().toISOString();
  const admin = createAdminClient();
  const { data, error } = await admin.from(TABLE).update({
    status: 'complete', report_version_id: args.reportVersionId,
    confirmed_snapshot_id: args.confirmedSnapshotId, input_hash: args.inputHash,
    error_code: null, error_message: null, locked_at: null, locked_by: null, force_requested: false,
    completed_at: now, updated_at: now,
  }).eq('id', jobId).eq('force_requested', false).select('id').maybeSingle();
  if (error) throw error;
  // A force request may have arrived after the worker claimed this job. The
  // conditional completion above then affects zero rows; requeue the same
  // durable row so the request cannot be lost.
  if (!data) {
    const { error: requeueError } = await admin.from(TABLE).update({
      status: 'pending', next_attempt_at: now, locked_at: null, locked_by: null,
      completed_at: null, error_code: null, error_message: null, updated_at: now,
    }).eq('id', jobId).eq('force_requested', true);
    if (requeueError) throw requeueError;
  }
}

export async function blockApplicationPersonalReportGeneration(
  jobId: string,
  errorCode: string,
  errorMessage: string,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await createAdminClient().from(TABLE).update({
    status: 'blocked', error_code: errorCode, error_message: errorMessage,
    locked_at: null, locked_by: null, completed_at: now, updated_at: now,
  }).eq('id', jobId);
  if (error) throw error;
}

export async function retryApplicationPersonalReportGeneration(
  jobId: string,
  attempts: number,
  errorCode: string,
  errorMessage: string,
): Promise<void> {
  const delay = Math.min(Math.max(attempts, 1) ** 2 * RETRY_BASE_MS, MAX_RETRY_MS);
  const now = new Date().toISOString();
  const { error } = await createAdminClient().from(TABLE).update({
    status: 'retry', next_attempt_at: new Date(Date.now() + delay).toISOString(),
    error_code: errorCode, error_message: errorMessage.slice(0, 1_000),
    locked_at: null, locked_by: null, updated_at: now,
  }).eq('id', jobId);
  if (error) throw error;
}
