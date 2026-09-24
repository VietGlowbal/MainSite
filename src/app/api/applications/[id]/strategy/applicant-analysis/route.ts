import { NextResponse } from 'next/server';
import { analyzeApplicant } from '@/lib/ai/strategy-dashboard/applicant-analysis';
import { applyRateLimit, strategyAiLimiter } from '@/lib/rate-limiter';
import { createClient } from '@/lib/supabase/server';
import { logger, startTimer } from '@/server/observability';

/**
 * @deprecated Legacy application-scoped applicant analysis route.
 *
 * CANONICAL REPLACEMENT: User-level Personal Report V2 (`/api/ai-strategy/personal-report`)
 * and Matching Report (`/api/applications/[id]/match-insights`).
 *
 * Maintained only as a compatibility fallback for external/historical callers.
 *
 * GET  /api/applications/[id]/strategy/applicant-analysis — latest stored analysis, or null.
 * POST /api/applications/[id]/strategy/applicant-analysis — generate a fresh one.
 */
export const runtime = 'nodejs';
export const maxDuration = 60;

async function loadApplication(
  supabase: Awaited<ReturnType<typeof createClient>>,
  applicationId: string,
  userId: string,
) {
  const { data } = await supabase
    .from('course_applications')
    .select('id')
    .eq('id', applicationId)
    .eq('user_id', userId)
    .maybeSingle();
  return data;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: applicationId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const application = await loadApplication(supabase, applicationId, user.id);
  if (!application) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

  const { data: latest } = await supabase
    .from('applicant_analyses')
    .select('*')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ analysis: latest ?? null });
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const getElapsed = startTimer();
  const { id: applicationId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  logger.info('applicant_analysis_generate', {
    userId: user.id,
    applicationId,
    stage: 'started',
    outcome: 'started',
  });

  const application = await loadApplication(supabase, applicationId, user.id);
  if (!application) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

  const limited = applyRateLimit(strategyAiLimiter, user.id, 'applicant analysis');
  if (limited) return limited;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logger.warn('applicant_analysis_generate', {
      userId: user.id,
      applicationId,
      stage: 'validated',
      outcome: 'not_configured',
      durationMs: getElapsed(),
    });
    return NextResponse.json({ error: 'AI service not configured' }, { status: 500 });
  }

  const [{ data: profile }, { data: achievements }, { data: activities }] = await Promise.all([
    supabase
      .from('student_profiles')
      .select(
        'nationality, current_qualification, school_name, current_year, current_subjects, predicted_grades, target_subjects, goals, learning_style, interest_areas, personal_statement_answers, profile_version',
      )
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('student_achievements')
      .select('category, title, detail')
      .eq('user_id', user.id),
    supabase
      .from('student_activities')
      .select('category, title, description')
      .eq('user_id', user.id),
  ]);

  if (!profile) {
    logger.warn('applicant_analysis_generate', {
      userId: user.id,
      applicationId,
      stage: 'validated',
      outcome: 'missing_inputs',
      durationMs: getElapsed(),
    });
    return NextResponse.json(
      {
        error: 'Add your Personal Summary first so we can build your candidate portrait.',
        needsInputs: true,
      },
      { status: 422 },
    );
  }

  let result;
  try {
    result = await analyzeApplicant({
      profile: {
        nationality: profile.nationality,
        currentQualification: profile.current_qualification,
        schoolName: profile.school_name,
        currentYear: profile.current_year,
        currentSubjects: profile.current_subjects,
        predictedGrades: profile.predicted_grades,
        targetSubjects: profile.target_subjects,
        careerGoals: profile.goals,
        learningStyle: profile.learning_style,
        interestAreas: profile.interest_areas,
        personalStatementAnswers: profile.personal_statement_answers as Record<string, unknown> | null,
      },
      achievements: achievements ?? [],
      activities: activities ?? [],
      apiKey,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    });
  } catch (err) {
    logger.error('applicant_analysis_generate', err, {
      userId: user.id,
      applicationId,
      stage: 'generated',
      durationMs: getElapsed(),
    });
    return NextResponse.json({ error: 'Analysis failed. Please try again.' }, { status: 502 });
  }

  const { data: inserted, error: insErr } = await supabase
    .from('applicant_analyses')
    .insert({
      application_id: applicationId,
      user_id: user.id,
      profile_version: profile.profile_version ?? 1,
      personality_summary: result.coreIdentity,
      learning_style: result.learningStyle,
      academic_strengths: result.academicStrengths,
      growth_areas: result.growthAreas,
      motivation_analysis: result.drivingForce,
      competitive_advantages: result.signaturePattern,
      emerging_themes: result.emergingThemes,
      suggested_positioning: result.personalPositioning,
      overall_rating: result.overallRating,
      inputs_present: result.inputsPresent,
      model_name: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      prompt_version: 'evaluation-engine-f1-f4-v1',
    })
    .select()
    .single();

  if (insErr) {
    logger.error('applicant_analysis_generate', insErr, {
      userId: user.id,
      applicationId,
      stage: 'persisted',
      durationMs: getElapsed(),
    });
    return NextResponse.json(
      { error: 'Could not save your analysis. If this persists, the database migration may be missing.' },
      { status: 500 },
    );
  }

  logger.info('applicant_analysis_generate', {
    userId: user.id,
    applicationId,
    stage: 'completed',
    outcome: 'success',
    durationMs: getElapsed(),
    modelName: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    promptVersion: 'evaluation-engine-f1-f4-v1',
  });

  return NextResponse.json({ analysis: inserted });
}
