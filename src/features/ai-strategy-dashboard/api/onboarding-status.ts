import type { SupabaseClient } from '@supabase/supabase-js';
import type { OnboardingState } from '../domain';

/**
 * Reads the five real onboarding-completion flags for one Strategy
 * (requirements.md Requirement 1.2-1.3, 15.4) — see `domain/onboarding.ts`
 * for what each one means and why this replaced the original
 * "has at least one achievement or activity" proxy.
 */
/**
 * `course_applications.personal_summary_reviewed_at` /
 * `achievements_reviewed_at` / `candidate_confirmed_at` /
 * `strategy_intro_seen_at`, all in one row, with a fallback to the one
 * pre-existing column alone.
 *
 * These are PER-APPLICATION, not per-student: `student_profiles` holds one
 * shared candidate-information profile across every application, but
 * whether THIS application has been reviewed/confirmed is its own fact —
 * without this, a student who already confirmed on an earlier application
 * had every later application silently skip reflections, achievements, and
 * Review & Confirm, straight into report generation. See
 * `supabase-per-application-onboarding.sql` and
 * `docs/known-issues.md` for the incident this fixed.
 *
 * PostgREST fails the WHOLE select on one unknown column, so — same as every
 * other tolerant read this project has needed for a column shipped ahead of
 * its migration — selecting the three new columns unconditionally would
 * silently break `strategy_intro_seen_at` too until
 * `supabase-per-application-onboarding.sql` has run, not just the new steps.
 */
async function selectApplicationFlags(
  supabase: SupabaseClient,
  userId: string,
  applicationId: string,
): Promise<{
  strategy_intro_seen_at?: string | null;
  personal_summary_reviewed_at?: string | null;
  achievements_reviewed_at?: string | null;
  personal_reflection_reviewed_at?: string | null;
  candidate_confirmed_at?: string | null;
} | null> {
  const full = await supabase
    .from('course_applications')
    .select(
      'strategy_intro_seen_at, personal_summary_reviewed_at, achievements_reviewed_at, personal_reflection_reviewed_at, candidate_confirmed_at',
    )
    .eq('id', applicationId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!full.error) return full.data;

  console.warn(
    '[onboarding-status] could not read per-application review columns — run supabase-application-experience-flow.sql (personal_reflection_reviewed_at) or supabase-per-application-onboarding.sql. Reading the rest.',
    full.error.message,
  );
  const withoutPersonalReflection = await supabase
    .from('course_applications')
    .select(
      'strategy_intro_seen_at, personal_summary_reviewed_at, achievements_reviewed_at, candidate_confirmed_at',
    )
    .eq('id', applicationId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!withoutPersonalReflection.error) return withoutPersonalReflection.data;

  const base = await supabase
    .from('course_applications')
    .select('strategy_intro_seen_at')
    .eq('id', applicationId)
    .eq('user_id', userId)
    .maybeSingle();
  return base.data;
}

export async function fetchOnboardingState(
  supabase: SupabaseClient,
  userId: string,
  applicationId: string,
): Promise<OnboardingState> {
  const [application, personalV2, legacyAnalysis, matchAnalysis, strategyRecommendation] =
    await Promise.all([
      selectApplicationFlags(supabase, userId, applicationId),
      supabase
        .from('student_personal_report_versions')
        .select('id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle(),
      supabase
        .from('applicant_analyses')
        .select('id')
        .eq('application_id', applicationId)
        .limit(1)
        .maybeSingle(),
      // `analysis_status = 'complete'` is only ever set in the same insert that
      // writes `fit_dimensions`/`fit_classification` (match-insights/route.ts),
      // so a row this query finds is a real Matching Report, not a placeholder
      // — see the note on `aiAnalysisComplete` below.
      supabase
        .from('application_match_analyses')
        .select('id')
        .eq('application_id', applicationId)
        .eq('user_id', userId)
        .eq('analysis_status', 'complete')
        .limit(1)
        .maybeSingle(),
      supabase
        .from('application_strategy_recommendations')
        .select('id')
        .eq('application_id', applicationId)
        .limit(1)
        .maybeSingle(),
    ]);

  const hasPersonalReport = Boolean(personalV2.data) || Boolean(legacyAnalysis.data);

  return {
    personalSummaryComplete: Boolean(application?.personal_summary_reviewed_at),
    achievementsComplete: Boolean(application?.achievements_reviewed_at),
    personalReflectionComplete: Boolean(application?.personal_reflection_reviewed_at),
    candidateConfirmed: Boolean(application?.candidate_confirmed_at),
    aiAnalysisComplete: hasPersonalReport && Boolean(matchAnalysis.data),
    introSeen: Boolean(application?.strategy_intro_seen_at),
    strategyComplete: Boolean(strategyRecommendation.data),
  };
}

/** Marks the Strategy Introduction as seen for this application, idempotently. */
export async function markStrategyIntroSeen(
  supabase: SupabaseClient,
  userId: string,
  applicationId: string,
): Promise<void> {
  await supabase
    .from('course_applications')
    .update({ strategy_intro_seen_at: new Date().toISOString() })
    .eq('id', applicationId)
    .eq('user_id', userId)
    .is('strategy_intro_seen_at', null);
}
