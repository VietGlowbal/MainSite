import { NextResponse } from 'next/server';
import { analyzeApplicant } from '@/lib/ai/strategy-dashboard/applicant-analysis';
import { createClient } from '@/lib/supabase/server';

/**
 * GET  /api/applications/[id]/strategy/applicant-analysis — latest stored analysis, or null.
 * POST /api/applications/[id]/strategy/applicant-analysis — generate a fresh one.
 *
 * requirements.md Requirement 6. Free tier (AI_JOURNEY's `report` step is
 * `paid: false`) — no Plus gating, unlike the Dashboard itself.
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
  const { id: applicationId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const application = await loadApplication(supabase, applicationId, user.id);
  if (!application) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
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
    console.error('[strategy/applicant-analysis] analysis failed', err);
    return NextResponse.json({ error: 'Analysis failed. Please try again.' }, { status: 502 });
  }

  const { data: inserted, error: insErr } = await supabase
    .from('applicant_analyses')
    .insert({
      application_id: applicationId,
      user_id: user.id,
      profile_version: profile.profile_version ?? 1,
      personality_summary: result.personalitySummary,
      learning_style: result.learningStyle,
      academic_strengths: result.academicStrengths,
      growth_areas: result.growthAreas,
      motivation_analysis: result.motivationAnalysis,
      competitive_advantages: result.competitiveAdvantages,
      suggested_positioning: result.suggestedPositioning,
      overall_rating: result.overallRating,
      inputs_present: result.inputsPresent,
      model_name: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      prompt_version: 'applicant-analysis-v1',
    })
    .select()
    .single();

  if (insErr) {
    console.error('[strategy/applicant-analysis] store failed', insErr);
    return NextResponse.json(
      { error: 'Could not save your analysis. If this persists, the database migration may be missing.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ analysis: inserted });
}
