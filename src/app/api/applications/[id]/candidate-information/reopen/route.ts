import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { countApplicationReportGenerations } from '@/features/apply/api';
import { APPLICATION_REPORT_GENERATION_LIMIT } from '@/features/apply/domain';
import { logger, startTimer } from '@/server/observability';

/**
 * POST /api/applications/[id]/candidate-information/reopen
 *
 * Lets a student edit Candidate Information again for ONE application by
 * clearing that application's `candidate_confirmed_at` lock.
 *
 * ─── WHAT REOPENING IS AND IS NOT ─────────────────────────────────────────────
 *
 * It is ONLY an unlock: `course_applications.candidate_confirmed_at` goes back
 * to NULL so the reflection/achievements pages render editable and
 * `PATCH /api/reflection` accepts edits in this application's context again.
 * The review timestamps (`personal_summary_reviewed_at`,
 * `achievements_reviewed_at`) are deliberately RETAINED so the student lands
 * on read-only views for every section they did NOT ask to change.
 *
 * It is never destructive: previously confirmed snapshots and every generated
 * report version stay exactly where they are. Re-confirming appends a NEW
 * snapshot that supersedes the old one (see the confirm route), so history is
 * append-only end to end.
 *
 * Ownership is verified server-side against `course_applications.user_id`
 * before any write — application B can never reopen application A.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const getElapsed = startTimer();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: applicationId } = await context.params;

  // Ownership check FIRST — a 404 must precede any write, so one user can
  // never even attempt to flip another user's lock.
  const owned = await supabase
    .from('course_applications')
    .select('id')
    .eq('id', applicationId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (owned.error) {
    logger.error('candidate_confirmation', owned.error, {
      userId: user.id,
      applicationId,
      stage: 'failed',
      outcome: 'failed',
      durationMs: getElapsed(),
    });
    return NextResponse.json({ error: 'Could not reopen this application' }, { status: 500 });
  }
  if (!owned.data) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  }

  const quota = await countApplicationReportGenerations(supabase, { userId: user.id, applicationId });
  if (quota.count >= APPLICATION_REPORT_GENERATION_LIMIT) {
    return NextResponse.json(
      {
        code: 'REPORT_LIMIT_REACHED',
        reportCount: quota.count,
        reportLimit: APPLICATION_REPORT_GENERATION_LIMIT,
        message: 'You have reached the maximum number of report generations.',
      },
      { status: 409 },
    );
  }

  // The unlock itself. Scoped by BOTH columns (defence in depth on top of
  // RLS); no other column is written, so review timestamps survive.
  const unlocked = await supabase
    .from('course_applications')
    .update({ candidate_confirmed_at: null })
    .eq('id', applicationId)
    .eq('user_id', user.id);
  if (unlocked.error) {
    logger.error('candidate_confirmation', unlocked.error, {
      userId: user.id,
      applicationId,
      stage: 'persisted',
      outcome: 'failed',
      durationMs: getElapsed(),
    });
    return NextResponse.json({ error: 'Could not reopen this application' }, { status: 500 });
  }

  logger.info('candidate_confirmation', {
    userId: user.id,
    applicationId,
    stage: 'completed',
    outcome: 'success',
    durationMs: getElapsed(),
  });

  return NextResponse.json({ status: 'reopened', applicationId });
}
