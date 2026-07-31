import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Whether a student has been through the shared Personal Summary / Achievements
 * flow at least once (requirements.md Requirement 1.2-1.3, 15.4).
 *
 * "Complete" is a proxy, not a stored flag: this table predates Strategies, so
 * there is no dedicated column to read. A student who has saved at least one
 * achievement or activity has been through step 2 of the flow (its only exit
 * is the final submit), which is a safe enough signal that re-running the
 * whole onboarding pass would be redundant rather than wrong.
 */
export async function fetchStrategyOnboardingStatus(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ reflectionComplete: boolean }> {
  const [achievements, activities] = await Promise.all([
    supabase.from('student_achievements').select('id').eq('user_id', userId).limit(1),
    supabase.from('student_activities').select('id').eq('user_id', userId).limit(1),
  ]);

  const reflectionComplete =
    (achievements.data?.length ?? 0) > 0 || (activities.data?.length ?? 0) > 0;

  return { reflectionComplete };
}
