import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createParseJob } from '@/lib/course-parser/job-queue';

const STALE_THRESHOLD_MS = 5 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const MAX_RETRIES_PER_WINDOW = 3;

/**
 * POST /api/applications/[id]/retry-parse
 *
 * Retries parsing for a failed, timed-out, or stale-recoverable application.
 *
 * Idempotency & Safety:
 * - If parse is already complete, preserves completed output and returns 200 without changes.
 * - If parse is already pending/queued, returns 200 without creating duplicate work.
 * - If parse is actively processing (not stale), returns 200 to avoid duplicate active jobs.
 * - If parse is failed, timeout, or stale-recoverable (>5 min inactivity), safely re-enqueues
 *   the job as 'pending' with attempts reset and resets application parse_status to 'pending'.
 * - Enforces rate limiting (max 3 manual retries per hour per application).
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
      .select('id, status, attempts, updated_at, started_at')
      .eq('application_id', id)
      .maybeSingle();

    // 1. Idempotent check: already complete
    if (application.parse_status === 'complete' || job?.status === 'complete') {
      return NextResponse.json({
        success: true,
        parseStatus: 'complete',
        phase: 'ready',
        alreadyComplete: true,
        message: 'Course application parsing is already complete.',
      });
    }

    // 2. Idempotent check: already pending/queued
    if (application.parse_status === 'pending' && job?.status === 'pending') {
      return NextResponse.json({
        success: true,
        parseStatus: 'pending',
        phase: 'queued',
        alreadyQueued: true,
        message: 'Application is already queued for parsing.',
      });
    }

    // 3. Stale check if currently processing
    const now = Date.now();
    const effectiveUpdatedAt = job?.updated_at
      ? new Date(job.updated_at).getTime()
      : application.updated_at
        ? new Date(application.updated_at).getTime()
        : now;
    const isStale =
      application.parse_status === 'processing' && now - effectiveUpdatedAt > STALE_THRESHOLD_MS;

    if (application.parse_status === 'processing' && !isStale) {
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

    // 5. Rate limiting: maximum retries per hour
    if (job) {
      const windowStart = now - RATE_LIMIT_WINDOW_MS;
      const jobUpdatedTime = new Date(job.updated_at).getTime();
      if (jobUpdatedTime > windowStart && job.attempts >= MAX_RETRIES_PER_WINDOW) {
        return NextResponse.json(
          { error: `Rate limit exceeded. Maximum ${MAX_RETRIES_PER_WINDOW} retries per hour.` },
          { status: 429 }
        );
      }
    }

    const isoNow = new Date().toISOString();

    // 6. Reset or create the parse job in pending state
    if (job) {
      const { error: updateJobError } = await adminDb
        .from('course_parse_jobs')
        .update({
          status: 'pending',
          phase: 'queued',
          attempts: 0,
          locked_by: null,
          started_at: null,
          completed_at: null,
          next_attempt_at: isoNow,
          error_message: null,
          updated_at: isoNow,
        })
        .eq('id', job.id);

      if (updateJobError) {
        console.error('Failed to update parse job for retry:', updateJobError);
        return NextResponse.json({ error: 'Failed to retry parsing' }, { status: 500 });
      }
    } else if (application.course_url) {
      await createParseJob(
        application.id,
        application.course_url,
        application.university_id ?? null
      );
    }

    // 7. Update application state to pending (correct queued state)
    const { error: updateAppError } = await adminDb
      .from('course_applications')
      .update({
        parse_status: 'pending',
        progress_percentage: 0,
        parse_error: null,
        updated_at: isoNow,
      })
      .eq('id', id);

    if (updateAppError) {
      console.error('Failed to update application parse status:', updateAppError);
      return NextResponse.json(
        { error: 'Failed to update application status' },
        { status: 500 }
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
