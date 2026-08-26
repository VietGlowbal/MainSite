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
  personalSummaryReviewedAt?: string | null;
  achievementsReviewedAt?: string | null;
  personalReflectionReviewedAt?: string | null;
  candidateConfirmedAt?: string | null;
  /** Simulates `supabase-per-application-onboarding.sql` not having run yet. */
  perApplicationColumnsMissing?: boolean;
  /** Simulates only `supabase-application-experience-flow.sql` (the personal_reflection_reviewed_at column) not having run yet. */
  personalReflectionColumnMissing?: boolean;
  hasApplicantAnalysis?: boolean;
  hasPersonalReportV2?: boolean;
  hasCompleteMatchAnalysis?: boolean;
  introSeenAt?: string | null;
  hasStrategyRecommendation?: boolean;
}) {
  function resolve(table: string, selected: string) {
    switch (table) {
      case 'student_personal_report_versions':
        return { data: options.hasPersonalReportV2 ? { id: 'v2-1' } : null, error: null };
      case 'applicant_analyses':
        return { data: options.hasApplicantAnalysis ? { id: 'analysis-1' } : null, error: null };
      case 'application_match_analyses':
        return { data: options.hasCompleteMatchAnalysis ? { id: 'match-1' } : null, error: null };
      case 'course_applications':
        if (options.perApplicationColumnsMissing && selected.includes('personal_summary_reviewed_at')) {
          return {
            data: null,
            error: { code: '42703', message: 'column "personal_summary_reviewed_at" does not exist' },
          };
        }
        if (
          options.personalReflectionColumnMissing &&
          selected.includes('personal_reflection_reviewed_at')
        ) {
          return {
            data: null,
            error: { code: '42703', message: 'column "personal_reflection_reviewed_at" does not exist' },
          };
        }
        return {
          data: {
            strategy_intro_seen_at: options.introSeenAt ?? null,
            ...(selected.includes('personal_summary_reviewed_at')
              ? {
                  personal_summary_reviewed_at: options.personalSummaryReviewedAt ?? null,
                  achievements_reviewed_at: options.achievementsReviewedAt ?? null,
                  candidate_confirmed_at: options.candidateConfirmedAt ?? null,
                }
              : {}),
            ...(selected.includes('personal_reflection_reviewed_at')
              ? { personal_reflection_reviewed_at: options.personalReflectionReviewedAt ?? null }
              : {}),
          },
          error: null,
        };
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
    let selected = '';
    const builder: Record<string, unknown> = {
      select: (columns: string) => {
        selected = columns;
        return builder;
      },
      eq: () => builder,
      limit: () => builder,
      maybeSingle: async () => resolve(table, selected),
      then: (onFulfilled: (v: unknown) => unknown) =>
        Promise.resolve(resolve(table, selected)).then(onFulfilled),
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

  it('reads the other six flags independently of the analysis gate', async () => {
    const supabase = buildSupabase({
      personalSummaryReviewedAt: '2026-01-01T00:00:00Z',
      achievementsReviewedAt: '2026-01-01T00:00:00Z',
      personalReflectionReviewedAt: '2026-01-01T06:00:00Z',
      candidateConfirmedAt: '2026-01-01T12:00:00Z',
      hasApplicantAnalysis: true,
      hasCompleteMatchAnalysis: true,
      introSeenAt: '2026-01-02T00:00:00Z',
      hasStrategyRecommendation: true,
    });
    const state = await fetchOnboardingState(supabase as never, 'user-1', 'app-1');
    expect(state).toEqual({
      personalSummaryComplete: true,
      achievementsComplete: true,
      personalReflectionComplete: true,
      candidateConfirmed: true,
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
      personalReflectionComplete: false,
      candidateConfirmed: false,
      aiAnalysisComplete: false,
      introSeen: false,
      strategyComplete: false,
    });
  });

  it('falls back to the other per-application flags when only personal_reflection_reviewed_at is unmigrated', async () => {
    const supabase = buildSupabase({
      personalSummaryReviewedAt: '2026-01-01T00:00:00Z',
      achievementsReviewedAt: '2026-01-01T00:00:00Z',
      candidateConfirmedAt: '2026-01-01T12:00:00Z',
      personalReflectionColumnMissing: true,
    });
    const state = await fetchOnboardingState(supabase as never, 'user-1', 'app-1');
    expect(state.personalSummaryComplete).toBe(true);
    expect(state.achievementsComplete).toBe(true);
    expect(state.candidateConfirmed).toBe(true);
    expect(state.personalReflectionComplete).toBe(false);
  });

  /**
   * The regression this whole feature exists to prevent: a student who
   * already confirmed on an EARLIER application must not have a brand-new
   * application inherit that as "already reviewed." Two applications, same
   * student, only one of them touched — the untouched one must read as
   * fully unstarted.
   */
  it('does not leak one application\'s review state onto a different, brand-new application', async () => {
    // app-1 is fully reviewed and confirmed...
    const confirmedApp = buildSupabase({
      personalSummaryReviewedAt: '2026-01-01T00:00:00Z',
      achievementsReviewedAt: '2026-01-01T00:00:00Z',
      candidateConfirmedAt: '2026-01-01T12:00:00Z',
    });
    const stateForConfirmedApp = await fetchOnboardingState(confirmedApp as never, 'user-1', 'app-1');
    expect(stateForConfirmedApp.candidateConfirmed).toBe(true);

    // ...but app-2, a different (brand new) application for the same
    // student, has never itself been reviewed — a separate fake client
    // scoped to app-2's own (empty) row, standing in for what a real query
    // filtered `.eq('id', 'app-2')` would return.
    const newApp = buildSupabase({});
    const stateForNewApp = await fetchOnboardingState(newApp as never, 'user-1', 'app-2');
    expect(stateForNewApp.personalSummaryComplete).toBe(false);
    expect(stateForNewApp.achievementsComplete).toBe(false);
    expect(stateForNewApp.candidateConfirmed).toBe(false);
  });

  it('falls back to strategy_intro_seen_at alone when the per-application review columns are not migrated yet, rather than failing the whole read', async () => {
    const supabase = buildSupabase({
      introSeenAt: '2026-01-02T00:00:00Z',
      perApplicationColumnsMissing: true,
    });
    const state = await fetchOnboardingState(supabase as never, 'user-1', 'app-1');
    expect(state.personalSummaryComplete).toBe(false);
    expect(state.achievementsComplete).toBe(false);
    expect(state.candidateConfirmed).toBe(false);
    expect(state.introSeen).toBe(true);
  });
});
