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
} from '@/lib/ai/adaptive-follow-up';

/**
 * POST /api/applications/[id]/activities/[activityId]/follow-up
 *
 * Adaptive Follow-up Q&A about ONE shared activity, asked inside ONE
 * application's context.
 *
 * Body `{ action: 'question' }` returns the NEXT question (deterministic
 * priority ladder; AI phrasing falls back to templates).
 * Body `{ action: 'answer', questionId, dimension, round, question, answer }` appends an
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
    questionId: z.string().uuid(),
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

  const [answersResult, questionsResult] = await Promise.all([
    supabase
      .from('student_activity_follow_up_answers')
      .select('id, question_id, dimension, question, answer, round')
      .eq('user_id', user.id)
      .eq('application_id', applicationId)
      .eq('activity_id', activityId)
      .order('created_at', { ascending: true }),
    supabase
      .from('student_activity_follow_up_questions')
      .select('id, dimension, question, round, answered_at, created_at')
      .eq('user_id', user.id)
      .eq('application_id', applicationId)
      .eq('activity_id', activityId)
      .order('created_at', { ascending: true }),
  ]);
  if (migrationMissing(answersResult.error) || migrationMissing(questionsResult.error)) {
    return NextResponse.json(
      { error: 'Follow-up persistence is not available yet. Please try again shortly.' },
      { status: 503 },
    );
  }
  if (answersResult.error || questionsResult.error) {
    logger.error('roadmap_tasks_generate', answersResult.error, {
      userId: user.id,
      applicationId,
      stage: 'failed',
      durationMs: getElapsed(),
    });
    return NextResponse.json({ error: 'Could not load follow-up state' }, { status: 500 });
  }

  const rows = ((answersResult.data ?? []) as Array<Record<string, unknown>>);
  const questionRows = ((questionsResult.data ?? []) as Array<Record<string, unknown>>);
  const existingAnswers: ExistingAnswer[] = rows.map((row, index) => ({
    questionId: typeof row.question_id === 'string' ? row.question_id : `stored:${index}`,
    dimension: String(row.dimension) as FollowUpDimension,
    round: Number(row.round ?? 1),
    answer: String(row.answer ?? ''),
  }));
  const askedQuestions = questionRows.map((row) => ({
    id: String(row.id),
    dimension: String(row.dimension) as FollowUpDimension,
    text: String(row.question),
    askedAt: String(row.created_at ?? new Date(0).toISOString()),
  }));

  if (parsedBody.action === 'question') {
    if (existingAnswers.length >= MAX_QUESTIONS_PER_ACTIVITY || askedQuestions.length >= MAX_QUESTIONS_PER_ACTIVITY) {
      return NextResponse.json({ status: 'complete', question: null });
    }
    const next = await nextFollowUpQuestion({
      activityFreeText:
        [activity.data.title, activity.data.description].filter(Boolean).join('. ') || 'Activity',
      existingAnswers,
      askedQuestions,
    });
    if (!next.ok) {
      return NextResponse.json({ status: 'complete', question: null });
    }
    const questionWrite = await supabase
      .from('student_activity_follow_up_questions')
      .insert({
        user_id: user.id,
        application_id: applicationId,
        activity_id: activityId,
        dimension: next.question.dimension,
        round: next.question.round,
        question: next.question.text,
      })
      .select('id, dimension, round, question')
      .single();
    let savedQuestion = questionWrite.data as Record<string, unknown> | null;
    if (questionWrite.error?.code === '23505') {
      const existingQuestion = await supabase
        .from('student_activity_follow_up_questions')
        .select('id, dimension, round, question')
        .eq('user_id', user.id)
        .eq('application_id', applicationId)
        .eq('activity_id', activityId)
        .eq('dimension', next.question.dimension)
        .eq('round', next.question.round)
        .maybeSingle();
      if (existingQuestion.error || !existingQuestion.data) {
        return NextResponse.json({ error: 'Could not save follow-up question' }, { status: 500 });
      }
      savedQuestion = existingQuestion.data as Record<string, unknown>;
    } else if (questionWrite.error || !savedQuestion) {
      return NextResponse.json(
        { error: migrationMissing(questionWrite.error) ? 'Follow-up persistence is not available yet. Please try again shortly.' : 'Could not save follow-up question' },
        { status: migrationMissing(questionWrite.error) ? 503 : 500 },
      );
    }
    return NextResponse.json({
      status: 'ok',
      question: {
        id: savedQuestion.id,
        dimension: savedQuestion.dimension,
        round: savedQuestion.round,
        text: savedQuestion.question,
        phrasing: next.question.phrasing,
      },
    });
  }

  // ── action === 'answer': enforce the hard limits before persisting ────────
  const sameDimensionCount = existingAnswers.filter((entry) => entry.dimension === parsedBody.dimension).length;
  const targetQuestion = questionRows.find((row) => String(row.id) === parsedBody.questionId);
  if (
    existingAnswers.length >= MAX_QUESTIONS_PER_ACTIVITY ||
    sameDimensionCount >= MAX_ATTEMPTS_PER_DIMENSION ||
    sameDimensionCount + 1 !== parsedBody.round ||
    !targetQuestion ||
    targetQuestion.answered_at != null ||
    String(targetQuestion.dimension) !== parsedBody.dimension ||
    Number(targetQuestion.round) !== parsedBody.round ||
    String(targetQuestion.question).trim() !== parsedBody.question.trim()
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
      question_id: parsedBody.questionId,
      dimension: parsedBody.dimension,
      question: parsedBody.question,
      answer: parsedBody.answer,
      round: parsedBody.round,
    })
    .select('id')
    .single();

  if (inserted.error) {
    if (inserted.error.code === 'P0001') {
      return NextResponse.json({ error: 'STALE_QUESTION' }, { status: 409 });
    }
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

  // A database trigger marks prior rounds superseded and consumes the issued
  // question in the same transaction as this insert.

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
