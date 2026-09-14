import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createParseJob } from '@/lib/course-parser/job-queue';

// 10-minute threshold shared by the claim RPC, worker reaper, and status API.
const STALE_THRESHOLD_MS = 10 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const MAX_RETRIES_PER_WINDOW = 3;

function isMissingPhaseColumnError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as {
    code?: unknown;
    message?: unknown;
    details?: unknown;
    hint?: unknown;
  };
  const code = String(candidate.code ?? '').toUpperCase();
  const diagnostic = [candidate.message, candidate.details, candidate.hint]
    .filter((value) => typeof value === 'string')
    .join(' ')
    .toLowerCase();
  const mentionsPhase = /(?:column|field|property)\s*[`"']?phase[`"']?\b|[`"']?phase[`"']?\s*(?:column|field|property)|schema cache[^\n]*[`"']?phase[`"']?/i.test(diagnostic);
  return (code === '42703' || code === 'PGRST204') && mentionsPhase;
}

/**
 * POST /api/applications/[id]/retry-parse
 *
 * Retries parsing for a failed, timed-out, or stale-recoverable application.
 *
 * Idempotency & Safety:
 * - If parse is already complete, preserves completed output and returns 200 without changes.
 * - If parse is already pending/queued, returns 200 without creating duplicate work.
 * - If a job is actively processing (not stale), returns active 200 even if application
 *   parse_status temporarily disagrees, avoiding resetting active in-flight work.
 * - If parse is failed, timeout, or stale-recoverable (>10 min inactivity), safely re-enqueues
 *   the job as 'pending' with attempts reset for worker pickup and resets application
 *   parse_status to 'pending'.
 * - Guarded updates: guards the job update with the observed status so concurrent completions
 *   are not clobbered.
 * - Rate limiting: enforces maximum 3 retries per hour, tracked via both attempts and
 *   durable retry history in parsed_data so resetting worker attempts cannot defeat rate limits.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch application
    const { data: application, error: appError } = await supabase
      .from('course_applications')
      .select('id, user_id, parse_status, course_url, university_id, updated_at')
      .eq('id', id)
      .single();

    if (appError || !application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    // Verify ownership
    if (application.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const adminDb = createAdminClient();

    // Fetch parse job
    const { data: job } = await adminDb
      .from('course_parse_jobs')
      .select('id, status, attempts, updated_at, started_at, parsed_data')
      .eq('application_id', id)
      .maybeSingle();

    const reconcileCompletedJob = async (
      expectedStatus: 'pending' | 'failed',
      expectedUpdatedAt: string,
    ) => {
      if (!job) return;
      const completeAt = new Date().toISOString();
      const completePayload: Record<string, unknown> = {
        status: 'complete',
        phase: 'ready',
        completed_at: completeAt,
        locked_by: null,
        updated_at: completeAt,
      };
      const runCompletion = async (payload: Record<string, unknown>) => adminDb
        .from('course_parse_jobs')
        .update(payload)
        .eq('id', job.id)
        .eq('status', expectedStatus)
        .eq('updated_at', expectedUpdatedAt)
        .select('id, status');
      let completionResult = await runCompletion(completePayload);
      if (completionResult.error && isMissingPhaseColumnError(completionResult.error)) {
        const legacyPayload = { ...completePayload };
        delete legacyPayload.phase;
        completionResult = await runCompletion(legacyPayload);
      }
      if (completionResult.error) {
        console.error('Failed to reconcile completed application job:', completionResult.error);
      }
    };

    // 1. Idempotent check: already complete (preserve completed output)
    if (application.parse_status === 'complete' || job?.status === 'complete') {
      if (
        application.parse_status === 'complete'
        && (job?.status === 'pending' || job?.status === 'failed')
        && job.updated_at
      ) {
        await reconcileCompletedJob(job.status, job.updated_at);
      }
      return NextResponse.json({
        success: true,
        parseStatus: 'complete',
        phase: 'ready',
        alreadyComplete: true,
        message: 'Course application parsing is already complete.',
      });
    }

    // 2. Idempotent check: already pending/queued. Trust the queue row when it
    // disagrees with a stale application projection; resetting an already
    // queued job would unnecessarily discard its retry schedule.
    if (job?.status === 'pending') {
      return NextResponse.json({
        success: true,
        parseStatus: 'pending',
        phase: 'queued',
        alreadyQueued: true,
        message: 'Application is already queued for parsing.',
      });
    }

    // 3. Stale & active check: determine based on both job.status and application.parse_status
    const now = Date.now();
    const isJobProcessing = job?.status === 'processing';
    const isAppProcessing = application.parse_status === 'processing';
    const isProcessing = isJobProcessing || isAppProcessing;

    // A failed/pending job's updated_at is not an active lease. When the
    // application projection still says processing, use its own timestamp so
    // a fresh failure cannot hide an actually stale application row.
    const effectiveUpdatedAt = isJobProcessing && (job?.updated_at || job?.started_at)
      ? new Date(job.updated_at || job.started_at!).getTime()
      : application.updated_at
        ? new Date(application.updated_at).getTime()
        : now;

    const isStale = isProcessing && now - effectiveUpdatedAt > STALE_THRESHOLD_MS;

    // If a job is processing and not stale, return active even if app parse_status disagrees
    if ((isJobProcessing || (isAppProcessing && !job)) && !isStale) {
      return NextResponse.json({
        success: true,
        parseStatus: 'processing',
        phase: 'fetching',
        active: true,
        message: 'Application is currently being parsed.',
      });
    }

    // 4. Validate that status is recoverable
    const isRecoverable =
      application.parse_status === 'failed' ||
      application.parse_status === 'timeout' ||
      job?.status === 'failed' ||
      job?.status === 'timeout' ||
      isStale;

    if (!isRecoverable) {
      return NextResponse.json(
        { error: 'Can only retry failed, timed-out, or stale parsing' },
        { status: 400 }
      );
    }

    // 5. Rate limiting: enforce max retries per hour
    const parsedDataObj = (
      job?.parsed_data && typeof job.parsed_data === 'object' ? job.parsed_data : {}
    ) as Record<string, unknown>;

    const existingRetries = Array.isArray(parsedDataObj.manual_retries)
      ? (parsedDataObj.manual_retries as string[])
      : [];

    const recentRetries = existingRetries.filter((ts) => {
      const t = new Date(ts).getTime();
      return !Number.isNaN(t) && now - t < RATE_LIMIT_WINDOW_MS;
    });

    const windowStart = now - RATE_LIMIT_WINDOW_MS;
    const jobActivityAt = job?.updated_at || job?.started_at;
    const jobUpdatedTime = jobActivityAt ? new Date(jobActivityAt).getTime() : 0;
    const legacyAttemptsExhausted =
      Boolean(job) && jobUpdatedTime > windowStart && (job?.attempts ?? 0) >= MAX_RETRIES_PER_WINDOW;

    if (recentRetries.length >= MAX_RETRIES_PER_WINDOW || legacyAttemptsExhausted) {
      return NextResponse.json(
        { error: `Rate limit exceeded. Maximum ${MAX_RETRIES_PER_WINDOW} retries per hour.` },
        { status: 429 }
      );
    }

    const isoNow = new Date().toISOString();
    const nextParsedData = {
      ...parsedDataObj,
      manual_retries: [...recentRetries, isoNow],
    };

    // 6. Reset or create the parse job in pending state with guarded update
    if (job) {
      const retryPayload: Record<string, unknown> = {
        status: 'pending',
        phase: 'queued',
        attempts: 0,
        locked_by: null,
        started_at: null,
        completed_at: null,
        next_attempt_at: isoNow,
        error_message: null,
        parsed_data: nextParsedData,
        updated_at: isoNow,
      };
      const runRetryUpdate = async (payload: Record<string, unknown>) => {
        let query = adminDb
          .from('course_parse_jobs')
          .update(payload)
          .eq('id', job.id)
          .eq('status', job.status); // Guarded by observed status
        // If two retries race while the row remains in the same terminal state,
        // the activity timestamp is the second compare-and-set component. This
        // keeps manual retry history idempotent instead of allowing both writes.
        if (job.updated_at) query = query.eq('updated_at', job.updated_at);
        return query.select('id, status');
      };

      let retryResult = await runRetryUpdate(retryPayload);
      if (retryResult.error && isMissingPhaseColumnError(retryResult.error)) {
        const legacyPayload = { ...retryPayload };
        delete legacyPayload.phase;
        retryResult = await runRetryUpdate(legacyPayload);
      }
      const { data: updatedJob, error: updateJobError } = retryResult;

      if (updateJobError) {
        console.error('Failed to update parse job for retry:', updateJobError);
        return NextResponse.json({ error: 'Failed to retry parsing' }, { status: 500 });
      }

      if (!updatedJob || updatedJob.length === 0) {
        // Status transitioned concurrently (e.g. completed by worker)
        return NextResponse.json({
          success: true,
          message: 'Parse job was updated concurrently.',
        });
      }
    } else if (application.course_url) {
      await createParseJob(
        application.id,
        application.course_url,
        application.university_id ?? null
      );
    }

    // 7. Update application state to pending (correct queued state), guarded by observed status
    let appRetryQuery = adminDb
      .from('course_applications')
      .update({
        parse_status: 'pending',
        progress_percentage: 0,
        parse_error: null,
        updated_at: isoNow,
      })
      .eq('id', id)
      .eq('parse_status', application.parse_status);
    if (application.updated_at) appRetryQuery = appRetryQuery.eq('updated_at', application.updated_at);
    const { data: updatedApplications, error: updateAppError } = await appRetryQuery.select('id, parse_status');

    if (updateAppError) {
      console.error('Failed to update application parse status:', updateAppError);
      return NextResponse.json(
        { error: 'Failed to update application status' },
        { status: 500 }
      );
    }

    if (!updatedApplications || updatedApplications.length === 0) {
      // Another retry, reaper, or worker changed the application projection
      // after the initial read. Do not report success while the job and
      // application disagree; return the state that won the race so the UI can
      // converge without a second destructive reset.
      const { data: currentApplication } = await adminDb
        .from('course_applications')
        .select('parse_status')
        .eq('id', id)
        .maybeSingle();
      if (currentApplication?.parse_status === 'pending') {
        return NextResponse.json({
          success: true,
          parseStatus: 'pending',
          phase: 'queued',
          alreadyQueued: true,
        });
      }
      if (currentApplication?.parse_status === 'complete') {
        // The worker may have completed the application after the job CAS but
        // before this projection update. Close the pending job with its own
        // compare-and-set so a completed application cannot be reprocessed.
        await reconcileCompletedJob('pending', isoNow);
        return NextResponse.json({
          success: true,
          parseStatus: 'complete',
          phase: 'ready',
          alreadyComplete: true,
        });
      }
      return NextResponse.json(
        { error: 'Application state changed while retrying. Refresh and try again.' },
        { status: 409 },
      );
    }

    return NextResponse.json({
      success: true,
      parseStatus: 'pending',
      phase: 'queued',
    });
  } catch (error) {
    console.error('Error retrying parse:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
