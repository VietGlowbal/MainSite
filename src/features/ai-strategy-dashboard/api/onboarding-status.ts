import type { SupabaseClient } from '@supabase/supabase-js';
import type { OnboardingState } from '../domain';

/**
 * Reads the four real onboarding-completion flags for one Strategy
 * (requirements.md Requirement 1.2-1.3, 15.4) — see `domain/onboarding.ts`
 * for what each one means and why this replaced the original
 * "has at least one achievement or activity" proxy.
 */
export async function fetchOnboardingState(
  supabase: SupabaseClient,
  userId: string,
  applicationId: string,
): Promise<OnboardingState> {
  const [profile, analysis, application] = await Promise.all([
    supabase
      .from('student_profiles')
      .select('personal_summary_completed_at, achievements_completed_at')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('applicant_analyses')
      .select('id')
      .eq('application_id', applicationId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('course_applications')
      .select('strategy_intro_seen_at')
      .eq('id', applicationId)
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  return {
    personalSummaryComplete: Boolean(profile.data?.personal_summary_completed_at),
    achievementsComplete: Boolean(profile.data?.achievements_completed_at),
    aiAnalysisComplete: Boolean(analysis.data),
    introSeen: Boolean(application.data?.strategy_intro_seen_at),
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
