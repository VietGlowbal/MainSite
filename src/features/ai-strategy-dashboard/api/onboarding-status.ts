import type { SupabaseClient } from '@supabase/supabase-js';
import type { OnboardingState } from '../domain';

/**
 * Reads the five real onboarding-completion flags for one Strategy
 * (requirements.md Requirement 1.2-1.3, 15.4) — see `domain/onboarding.ts`
 * for what each one means and why this replaced the original
 * "has at least one achievement or activity" proxy.
 */
/**
 * `student_profiles.confirmed_at` reads with a fallback to the two
 * pre-existing columns alone.
 *
 * PostgREST fails the WHOLE select on one unknown column, so — same as every
 * other tolerant read this project has needed for a column shipped ahead of
 * its migration (see `loadProfile` in `reflection/page.tsx`) — selecting it
 * unconditionally would silently break `personalSummaryComplete` and
 * `achievementsComplete` for every student until
 * `supabase-candidate-confirmation.sql` has run, not just the new step.
 */
async function selectProfileFlags(
  supabase: SupabaseClient,
  userId: string,
): Promise<{
  personal_summary_completed_at?: string | null;
  achievements_completed_at?: string | null;
  confirmed_at?: string | null;
} | null> {
  const full = await supabase
    .from('student_profiles')
    .select('personal_summary_completed_at, achievements_completed_at, confirmed_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (!full.error) return full.data;

  console.warn(
    '[onboarding-status] could not read confirmed_at — run supabase-candidate-confirmation.sql. Reading the rest.',
    full.error.message,
  );
  const base = await supabase
    .from('student_profiles')
    .select('personal_summary_completed_at, achievements_completed_at')
    .eq('user_id', userId)
    .maybeSingle();
  return base.data;
}

export async function fetchOnboardingState(
  supabase: SupabaseClient,
  userId: string,
  applicationId: string,
): Promise<OnboardingState> {
  const [profile, analysis, matchAnalysis, application, strategyRecommendation] = await Promise.all([
    selectProfileFlags(supabase, userId),
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
      .eq('analysis_status', 'complete')
      .limit(1)
      .maybeSingle(),
    supabase
      .from('course_applications')
      .select('strategy_intro_seen_at')
      .eq('id', applicationId)
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('application_strategy_recommendations')
      .select('id')
      .eq('application_id', applicationId)
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    personalSummaryComplete: Boolean(profile?.personal_summary_completed_at),
    achievementsComplete: Boolean(profile?.achievements_completed_at),
    candidateConfirmed: Boolean(profile?.confirmed_at),
    aiAnalysisComplete: Boolean(analysis.data) && Boolean(matchAnalysis.data),
    introSeen: Boolean(application.data?.strategy_intro_seen_at),
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
