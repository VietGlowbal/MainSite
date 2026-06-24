import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { analyzeCourseMatchInsights } from '@/lib/ai/match-insights';
import {
  weightedScore,
  matchLabel,
  maxMatchLabel,
  MATCH_PILLARS,
  MATCH_PROMPT_VERSION,
  type PillarKey,
} from '@/lib/match-insights';

/**
 * POST /api/applications/[id]/match-insights
 *
 * Runs (or returns a cached) five-pillar match analysis for a course
 * application. Free users are rate-limited to one fresh analysis per 24h per
 * application; Plus users can re-run on demand. Stores the result on
 * application_match_analyses (pillars + aggregates) and returns it.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: applicationId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'AI service not configured' }, { status: 500 });
  }

  // Application (must belong to the user) + its course row.
  const { data: application, error: appErr } = await supabase
    .from('course_applications')
    .select('*, courses (*)')
    .eq('id', applicationId)
    .eq('user_id', user.id)
    .single();
  if (appErr || !application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  }

  // Profile (for Plus gating + the candidate's details).
  const { data: profile } = await supabase
    .from('student_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  const isPlus = Boolean(profile?.plus_status);

  // Free-tier rate limit: reuse a recent analysis instead of paying for another.
  const { data: latest } = await supabase
    .from('application_match_analyses')
    .select('*')
    .eq('application_id', applicationId)
    .eq('analysis_status', 'complete')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!isPlus && latest) {
    const ageMs = Date.now() - new Date(latest.created_at).getTime();
    if (ageMs < 24 * 60 * 60 * 1000) {
      return NextResponse.json({ ok: true, cached: true, analysis: latest });
    }
  }

  // Candidate documents (CV + statement/essay).
  const { data: documents } = await supabase
    .from('uploaded_documents')
    .select('document_type, parsed_text')
    .eq('user_id', user.id)
    .eq('is_active', true);
  const cvText = documents?.find((d) => d.document_type === 'cv')?.parsed_text ?? undefined;
  const essayText =
    documents?.find((d) => d.document_type === 'sop' || d.document_type === 'statement')?.parsed_text ??
    undefined;

  const achievements: string[] = Array.isArray(profile?.achievements) ? profile.achievements : [];

  let insights;
  try {
    insights = await analyzeCourseMatchInsights({
      course: {
        universityName: application.university_name,
        courseName: application.course_name,
        subject: application.subject ?? application.courses?.subject,
        degreeLevel: application.degree_level ?? application.courses?.degree_level,
        entryRequirements: application.courses?.entry_requirements_summary,
        englishRequirements: application.courses?.english_requirements_summary,
        summary: application.ai_summary,
      },
      profile: {
        academicBackground: profile?.academic_background,
        grades: profile?.grades_summary,
        testScores: profile?.grades_summary,
        activities: achievements.join(', '),
        achievements: achievements.join(', '),
        personalContext: profile?.bio,
      },
      cvText,
      essayText,
      apiKey,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    });
  } catch (err) {
    console.error('[match-insights] analysis failed', err);
    return NextResponse.json({ error: 'Match analysis failed. Please try again.' }, { status: 502 });
  }

  // Aggregates for the legacy scalar columns + list views.
  const currentScore = weightedScore(insights.pillars, 'current');
  const maxScore = weightedScore(insights.pillars, 'max');

  const strengths = MATCH_PILLARS.flatMap((p) => insights.pillars[p.key]?.strengths ?? []).slice(0, 6);
  const weaknesses = MATCH_PILLARS.flatMap((p) => insights.pillars[p.key]?.gaps ?? []).slice(0, 6);
  const improvementActions = MATCH_PILLARS.flatMap((p) => insights.pillars[p.key]?.improvements ?? []);
  const explanation = MATCH_PILLARS.map((p) => {
    const b = insights.pillars[p.key];
    return b?.summary ? `${p.label}: ${b.summary}` : null;
  })
    .filter(Boolean)
    .join(' ');

  const { data: inserted, error: insErr } = await supabase
    .from('application_match_analyses')
    .insert({
      application_id: applicationId,
      user_id: user.id,
      profile_version: profile?.profile_version ?? 1,
      current_match_score: currentScore,
      max_possible_match_score: maxScore,
      score_label: matchLabel(currentScore),
      max_score_label: maxMatchLabel(maxScore),
      pillars: insights.pillars,
      confidence: insights.confidence,
      inputs_present: insights.inputsPresent,
      strengths,
      weaknesses,
      improvement_actions: improvementActions,
      explanation,
      model_name: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      prompt_version: MATCH_PROMPT_VERSION,
      analysis_status: 'complete',
    })
    .select()
    .single();

  if (insErr) {
    console.error('[match-insights] store failed', insErr);
    // The pillars/confidence/inputs_present columns come from
    // supabase-match-insights.sql. If they're missing, Postgres raises an
    // undefined_column (42703) error — surface a clear, actionable message
    // instead of a generic 500 so it's obvious the migration must be applied.
    const needsMigration =
      insErr.code === '42703' || /pillars|confidence|inputs_present/i.test(insErr.message ?? '');
    if (needsMigration) {
      return NextResponse.json(
        {
          error:
            'Match Insights needs a one-time database update. Run supabase-match-insights.sql in the Supabase SQL editor, then try again.',
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: 'Could not save the analysis.' }, { status: 500 });
  }

  // Tell the client which pillars are unlockable (for the "unlock X%" nudges).
  const unassessed = MATCH_PILLARS.filter((p) => !insights.pillars[p.key]?.assessed).map(
    (p) => p.key as PillarKey,
  );

  return NextResponse.json({ ok: true, cached: false, analysis: inserted, unassessed });
}
