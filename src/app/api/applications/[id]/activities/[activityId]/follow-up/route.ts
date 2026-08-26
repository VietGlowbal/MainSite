import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { logger, startTimer } from '@/server/observability';
import {
  FOLLOW_UP_DIMENSION_PRIORITY,
  MAX_ATTEMPTS_PER_DIMENSION,
  MAX_QUESTIONS_PER_ACTIVITY,
  type ExistingAnswer,
  type FollowUpDimension,
  nextFollowUpQuestion,
  recordFollowUpAnswer,
} from '@/lib/ai/adaptive-follow-up';

/**
 * POST /api/applications/[id]/activities/[activityId]/follow-up
 *
 * Adaptive Follow-up Q&A about ONE shared activity, asked inside ONE
 * application's context.
 *
 * Body `{ action: 'question' }` returns the NEXT question (deterministic
 * priority ladder; AI phrasing falls back to templates).
 * Body `{ action: 'answer', dimension, round, question, answer }` appends an
 * append-only row to `student_activity_follow_up_answers` (see
 * supabase-application-personal-report-state.sql); a later round supersedes,
 * never deletes, the previous one. Resolved answers are copied into THIS
 * application's next confirmed snapshot by the confirm flow.
 *
 * Requires an EDITABLE (reopened / not-yet-confirmed) application — a locked
 * application cannot grow new follow-up history. Ownership is verified on
 * BOTH the application and the activity before any read/write.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('question') }),
  z.object({
    action: z.literal('answer'),
    dimension: z.enum(FOLLOW_UP_DIMENSION_PRIORITY),
    round: z.number().int().min(1).max(MAX_ATTEMPTS_PER_DIMENSION),
    question: z.string().min(4).max(500),
    answer: z.string().min(2).max(2000),
  }),
]);

function migrationMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === '42P01' || error.code === '42703' || error.code === 'PGRST204' || error.code === 'PGRST205';
}

export async function POST(request: Request, context: { params: Promise<{ id: string; activityId: string }> }) {
  const getElapsed = startTimer();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: applicationId, activityId } = await context.params;

  let parsedBody: z.infer<typeof bodySchema>;
  try {
    parsedBody = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 422 });
  }

  // ── ownership: application ────────────────────────────────────────────────
  const application = await supabase
    .from('course_applications')
    .select('id, candidate_confirmed_at')
    .eq('id', applicationId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!application.data) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  }
  if ((application.data as { candidate_confirmed_at: string | null }).candidate_confirmed_at) {
    // A confirmed application's follow-up set is frozen into its snapshot;
    // reopen Candidate Information to continue the conversation.
    return NextResponse.json(
      { error: 'APPLICATION_CONFIRMED', message: 'Reopen candidate information to add follow-up answers.' },
      { status: 409 },
    );
  }

  // ── ownership: activity ───────────────────────────────────────────────────
  const activity = await supabase
    .from('student_activities')
    .select('id, title, description')
    .eq('id', activityId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!activity.data) {
    return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
  }

  // Existing answers for THIS activity + application — the deterministic
  // engine's entire state.
  const answersResult = await supabase
    .from('student_activity_follow_up_answers')
    .select('question_id_fallback, dimension, question, answer, round')
    .eq('user_id', user.id)
    .eq('application_id', applicationId)
    .eq('activity_id', activityId)
    .order('created_at', { ascending: true });
  if (answersResult.error && !migrationMissing(answersResult.error)) {
    logger.error('roadmap_tasks_generate', answersResult.error, {
      userId: user.id,
      applicationId,
      stage: 'failed',
      durationMs: getElapsed(),
    });
    return NextResponse.json({ error: 'Could not load follow-up state' }, { status: 500 });
  }

  const existingAnswers: ExistingAnswer[] = ((answersResult.data ?? []) as Array<Record<string, unknown>>).map(
    (row, index) => ({
      questionId: `stored:${index}`,
      dimension: String(row.dimension) as FollowUpDimension,
      round: Number(row.round ?? 1),
      answer: String(row.answer ?? ''),
    }),
  );

  if (parsedBody.action === 'question') {
    if (existingAnswers.length >= MAX_QUESTIONS_PER_ACTIVITY) {
      return NextResponse.json({ status: 'complete', question: null });
    }
    const next = await nextFollowUpQuestion({
      activityFreeText:
        [activity.data.title, activity.data.description].filter(Boolean).join('. ') || 'Activity',
      existingAnswers,
      askedQuestions: [],
    });
    if (!next.ok) {
      return NextResponse.json({ status: 'complete', question: null });
    }
    return NextResponse.json({
      status: 'ok',
      question: {
        id: next.question.id,
        dimension: next.question.dimension,
        round: next.question.round,
        text: next.question.text,
        phrasing: next.question.phrasing,
      },
    });
  }

  // ── action === 'answer': enforce the hard limits before persisting ────────
  const sameDimensionCount = existingAnswers.filter((entry) => entry.dimension === parsedBody.dimension).length;
  if (
    existingAnswers.length >= MAX_QUESTIONS_PER_ACTIVITY ||
    sameDimensionCount >= MAX_ATTEMPTS_PER_DIMENSION ||
    sameDimensionCount + 1 !== parsedBody.round
  ) {
    // Covers stale/duplicated submissions from an out-of-date client.
    return NextResponse.json({ error: 'STALE_QUESTION' }, { status: 409 });
  }

  const inserted = await supabase
    .from('student_activity_follow_up_answers')
    .insert({
      user_id: user.id,
      application_id: applicationId,
      activity_id: activityId,
      dimension: parsedBody.dimension,
      question: parsedBody.question,
      answer: parsedBody.answer,
      round: parsedBody.round,
    })
    .select('id')
    .single();

  if (inserted.error) {
    if (migrationMissing(inserted.error)) {
      return NextResponse.json(
        { error: 'Follow-up persistence is not available yet. Please try again shortly.' },
        { status: 503 },
      );
    }
    logger.error('roadmap_tasks_generate', inserted.error, {
      userId: user.id,
      applicationId,
      stage: 'failed',
      durationMs: getElapsed(),
    });
    return NextResponse.json({ error: 'Could not save your answer' }, { status: 500 });
  }

  // Supersede markers stay derivable (later round ⇒ earlier ones superseded);
  // the append-only table itself never updates prior rows.
  void recordFollowUpAnswer;

  logger.info('roadmap_tasks_generate', {
    userId: user.id,
    applicationId,
    stage: 'completed',
    outcome: 'success',
    durationMs: getElapsed(),
    metadata: { operation: 'activity_follow_up', dimension: parsedBody.dimension, round: parsedBody.round },
  });

  return NextResponse.json({ status: 'saved', dimension: parsedBody.dimension, round: parsedBody.round });
}
