import { describe, expect, it } from 'vitest';
import { fetchOnboardingState } from './onboarding-status';

/**
 * A minimal fake Supabase client, same shape as
 * `generate-recommendations.test.ts`'s `buildSupabase` — every method on the
 * query builder returns itself, and the builder is thenable so
 * `await supabase.from(...).select(...).eq(...).maybeSingle()` resolves
 * whatever `resolve()` computes for that table.
 */
function buildSupabase(options: {
  personalSummaryCompletedAt?: string | null;
  achievementsCompletedAt?: string | null;
  hasApplicantAnalysis?: boolean;
  hasCompleteMatchAnalysis?: boolean;
  introSeenAt?: string | null;
  hasStrategyRecommendation?: boolean;
}) {
  function resolve(table: string) {
    switch (table) {
      case 'student_profiles':
        return {
          data: {
            personal_summary_completed_at: options.personalSummaryCompletedAt ?? null,
            achievements_completed_at: options.achievementsCompletedAt ?? null,
          },
          error: null,
        };
      case 'applicant_analyses':
        return { data: options.hasApplicantAnalysis ? { id: 'analysis-1' } : null, error: null };
      case 'application_match_analyses':
        return { data: options.hasCompleteMatchAnalysis ? { id: 'match-1' } : null, error: null };
      case 'course_applications':
        return { data: { strategy_intro_seen_at: options.introSeenAt ?? null }, error: null };
      case 'application_strategy_recommendations':
        return {
          data: options.hasStrategyRecommendation ? { id: 'strategy-1' } : null,
          error: null,
        };
      default:
        return { data: null, error: null };
    }
  }

  function makeBuilder(table: string) {
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: () => builder,
      limit: () => builder,
      maybeSingle: async () => resolve(table),
      then: (onFulfilled: (v: unknown) => unknown) => Promise.resolve(resolve(table)).then(onFulfilled),
    };
    return builder;
  }

  return { from: (table: string) => makeBuilder(table) };
}

describe('fetchOnboardingState', () => {
  it('is aiAnalysisComplete only when BOTH the Personal Report and a complete Matching Report exist', async () => {
    const supabase = buildSupabase({ hasApplicantAnalysis: true, hasCompleteMatchAnalysis: false });
    const state = await fetchOnboardingState(supabase as never, 'user-1', 'app-1');
    expect(state.aiAnalysisComplete).toBe(false);
  });

  it('is aiAnalysisComplete false when only the Matching Report exists (Personal Report missing)', async () => {
    const supabase = buildSupabase({ hasApplicantAnalysis: false, hasCompleteMatchAnalysis: true });
    const state = await fetchOnboardingState(supabase as never, 'user-1', 'app-1');
    expect(state.aiAnalysisComplete).toBe(false);
  });

  it('is aiAnalysisComplete true once both reports exist', async () => {
    const supabase = buildSupabase({ hasApplicantAnalysis: true, hasCompleteMatchAnalysis: true });
    const state = await fetchOnboardingState(supabase as never, 'user-1', 'app-1');
    expect(state.aiAnalysisComplete).toBe(true);
  });

  it('reads the other four flags independently of the analysis gate', async () => {
    const supabase = buildSupabase({
      personalSummaryCompletedAt: '2026-01-01T00:00:00Z',
      achievementsCompletedAt: '2026-01-01T00:00:00Z',
      hasApplicantAnalysis: true,
      hasCompleteMatchAnalysis: true,
      introSeenAt: '2026-01-02T00:00:00Z',
      hasStrategyRecommendation: true,
    });
    const state = await fetchOnboardingState(supabase as never, 'user-1', 'app-1');
    expect(state).toEqual({
      personalSummaryComplete: true,
      achievementsComplete: true,
      aiAnalysisComplete: true,
      introSeen: true,
      strategyComplete: true,
    });
  });

  it('defaults every flag to false on a brand new application with no rows anywhere', async () => {
    const supabase = buildSupabase({});
    const state = await fetchOnboardingState(supabase as never, 'user-1', 'app-1');
    expect(state).toEqual({
      personalSummaryComplete: false,
      achievementsComplete: false,
      aiAnalysisComplete: false,
      introSeen: false,
      strategyComplete: false,
    });
  });
});
