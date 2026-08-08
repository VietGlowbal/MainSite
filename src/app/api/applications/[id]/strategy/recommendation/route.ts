import { NextResponse } from 'next/server';
import {
  narrativeFromRow,
  strategyRecommendationFromRow,
} from '@/features/ai-strategy-dashboard/domain';
import { enforceFitClassification, programmeFitSchema, type ProgrammeFit } from '@/features/apply/domain';
import { generateStrategyRecommendation } from '@/lib/ai/strategy-recommendation';
import { defaultOpenAIModel } from '@/lib/ai/openai-client';
import { createClient } from '@/lib/supabase/server';

/**
 * GET  /api/applications/[id]/strategy/recommendation — latest F7 report, or null.
 * POST /api/applications/[id]/strategy/recommendation — generate a fresh one.
 *
 * Modeled directly on strategy/applicant-analysis/route.ts's GET/POST pair.
 * F7 needs two existing reports as input (the Personal Report and the
 * Matching Report), so POST 422s with `needsInputs` if either is missing —
 * the onboarding flow should never let a student reach this page without
 * both already generated, but a direct/bookmarked visit could race it.
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
    .select('id, university_name, course_name, subject, degree_level, university_id, courses(subject, degree_level)')
    .eq('id', applicationId)
    .eq('user_id', userId)
    .maybeSingle();
  return data;
}

function fitFromRow(row: Record<string, unknown> | null): { fit: ProgrammeFit; id: string } | null {
  if (!row?.fit_dimensions || !row.fit_eligibility || !row.fit_classification) return null;
  const parsed = programmeFitSchema.safeParse({
    classification: row.fit_classification,
    confidence: row.fit_confidence ?? 0,
    limitations: row.fit_limitations ?? [],
    eligibility: row.fit_eligibility,
    dimensions: row.fit_dimensions,
  });
  if (!parsed.success) return null;
  return { fit: enforceFitClassification(parsed.data), id: String(row.id) };
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
    .from('application_strategy_recommendations')
    .select('*')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const recommendation = latest ? strategyRecommendationFromRow(latest) : null;
  return NextResponse.json({ recommendation });
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

  const [
    { data: analysisRow },
    { data: matchRow },
    { data: achievements },
    { data: activities },
    universityResult,
  ] = await Promise.all([
    supabase
      .from('applicant_analyses')
      .select('*')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('application_match_analyses')
      .select('*')
      .eq('application_id', applicationId)
      .eq('analysis_status', 'complete')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('student_achievements').select('category, title, detail').eq('user_id', user.id),
    supabase.from('student_activities').select('category, title, description').eq('user_id', user.id),
    application.university_id == null
      ? Promise.resolve({ data: null })
      : supabase
          .from('universities')
          .select('employability, industry_connections, internship_coop')
          .eq('id', application.university_id)
          .maybeSingle(),
  ]);

  const fitResult = matchRow ? fitFromRow(matchRow) : null;

  if (!analysisRow || !fitResult) {
    return NextResponse.json(
      {
        error: 'Generate your Personal Report and Matching Report first — the Personalized Strategy builds on both.',
        needsInputs: true,
      },
      { status: 422 },
    );
  }

  const university = universityResult.data as Record<string, unknown> | null;
  const courses = application.courses as { subject?: string | null; degree_level?: string | null } | null;

  let result;
  try {
    result = await generateStrategyRecommendation({
      narrative: narrativeFromRow(analysisRow),
      fit: fitResult.fit,
      programme: {
        universityName: application.university_name ?? 'Not specified',
        courseName: application.course_name ?? 'Not specified',
        subject: application.subject ?? courses?.subject ?? null,
        degreeLevel: application.degree_level ?? courses?.degree_level ?? null,
        careerOutcomes: university
          ? [university.employability, university.industry_connections, university.internship_coop]
              .filter(Boolean)
              .join(' ') || null
          : null,
      },
      achievements: achievements ?? [],
      activities: activities ?? [],
      apiKey,
      model: process.env.OPENAI_MODEL || defaultOpenAIModel(),
    });
  } catch (err) {
    console.error('[strategy/recommendation] generation failed', err);
    return NextResponse.json({ error: 'Strategy generation failed. Please try again.' }, { status: 502 });
  }

  const { data: inserted, error: insErr } = await supabase
    .from('application_strategy_recommendations')
    .insert({
      application_id: applicationId,
      user_id: user.id,
      source_analysis_id: analysisRow.id,
      source_match_analysis_id: fitResult.id,
      direction_options: result.directionOptions,
      chosen_direction: result.chosenDirection,
      chosen_direction_why: result.chosenDirectionWhy,
      narrative: result.narrative,
      positioning_before: result.positioningBefore,
      positioning_after: result.positioningAfter,
      positioning_rationale: result.positioningRationale,
      portfolio_evaluations: result.portfolioEvaluations,
      differentiation_insight: result.differentiationInsight,
      differentiation_proposal: result.differentiationProposal,
      roadmap: result.roadmap,
      model_name: process.env.OPENAI_MODEL || defaultOpenAIModel(),
      prompt_version: 'strategy-recommendation-f7-v1',
    })
    .select()
    .single();

  if (insErr) {
    console.error('[strategy/recommendation] store failed', insErr);
    if (insErr.code === '42P01' || insErr.code === 'PGRST205') {
      console.error(
        '[strategy/recommendation] application_strategy_recommendations does not exist. ' +
          'Run supabase-strategy-recommendation-report.sql.',
      );
    }
    return NextResponse.json(
      { error: 'Could not save your strategy. If this persists, the database migration may be missing.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ recommendation: strategyRecommendationFromRow(inserted) });
}
