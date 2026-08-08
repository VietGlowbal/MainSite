/**
 * Strategy onboarding-completion state (requirements.md Requirement 1.2-1.3,
 * 15.4) — REPLACES the "has at least one achievement or activity" proxy the
 * first pass used, which could never be satisfied by a student with
 * genuinely zero achievements (Requirement 4.3 explicitly allows that) and
 * was satisfied by any activity row regardless of which flow wrote it.
 *
 * Five real, independently-recorded steps:
 *  - personalSummaryComplete / achievementsComplete — shared across every
 *    Strategy (student_profiles.personal_summary_completed_at /
 *    achievements_completed_at), set by an explicit "Continue" submit, not
 *    inferred from whether any rows exist.
 *  - aiAnalysisComplete — per Strategy: BOTH an `applicant_analyses` row
 *    (Personal Report) AND a complete `application_match_analyses` row
 *    (Matching Report) exist for this application. `AnalysisWorkspace`
 *    generates the two together on one visit to `/strategy/analysis`, but
 *    they are separate tables written by separate calls — checking only the
 *    Personal Report here let a student whose Matching Report failed (missing
 *    inputs, or a pending database migration, see `docs/known-issues.md §0e`)
 *    advance past `analysis` anyway, straight into `intro`/`strategy` with no
 *    Matching Report ever having been produced. F7 (`strategy` below)
 *    unconditionally requires the Matching Report as an input, so that gap
 *    surfaced as a hard-to-diagnose "Generate your Personal Report and
 *    Matching Report first" error on the strategy page instead of the
 *    correct, earlier "try the analysis again" state — fixed by requiring
 *    both here rather than only the Personal Report.
 *  - introSeen — per Strategy: `course_applications.strategy_intro_seen_at`
 *    is set, marked when the Strategy Introduction page is opened.
 *  - strategyComplete — per Strategy: an `application_strategy_recommendations`
 *    row exists (the F7 Personalized Strategy report has been generated).
 *    Sits after `introSeen` and before the Planner — it is a synthesis over
 *    the Personal Report and Matching Report, so it cannot run before
 *    `aiAnalysisComplete`, and it is deliberately its own step rather than
 *    folded into `analysis`: the Planner is the task-tracking surface ("am I
 *    doing it"), while this report is a one-time strategic read ("what
 *    should I become and why") — two different jobs, two different pages.
 */
export type OnboardingState = {
  personalSummaryComplete: boolean;
  achievementsComplete: boolean;
  aiAnalysisComplete: boolean;
  introSeen: boolean;
  strategyComplete: boolean;
};

export type OnboardingStep =
  | 'personal-summary'
  | 'achievements'
  | 'analysis'
  | 'intro'
  | 'strategy'
  | 'dashboard';

/** True once every step is done — requirements.md 1.3's "completed onboarding". */
export function isOnboardingComplete(state: OnboardingState): boolean {
  return (
    state.personalSummaryComplete &&
    state.achievementsComplete &&
    state.aiAnalysisComplete &&
    state.introSeen &&
    state.strategyComplete
  );
}

/**
 * The first step the student hasn't finished, in spec order. Used both to
 * route a first-time visitor forward and to resume a partially-completed
 * pass at the right place (requirements.md 1.2, and the explicit "handle
 * partially completed onboarding" gap the first pass left open) — the same
 * function answers both, because "resume" and "what's next" are the same
 * question asked at different times.
 */
export function nextOnboardingStep(state: OnboardingState): OnboardingStep {
  if (!state.personalSummaryComplete) return 'personal-summary';
  if (!state.achievementsComplete) return 'achievements';
  if (!state.aiAnalysisComplete) return 'analysis';
  if (!state.introSeen) return 'intro';
  if (!state.strategyComplete) return 'strategy';
  return 'dashboard';
}

/** Route paths for each step, given the Strategy's `applicationId`. */
export function onboardingStepHref(
  step: OnboardingStep,
  applicationId: string,
  options?: { returnTo?: string },
): string {
  const analysisHref = `/ai-strategy/${applicationId}/strategy/analysis`;
  switch (step) {
    case 'personal-summary':
      return `/ai-strategy/reflection?return=${encodeURIComponent(options?.returnTo ?? analysisHref)}`;
    case 'achievements':
      return `/ai-strategy/reflection/achievements?return=${encodeURIComponent(options?.returnTo ?? analysisHref)}`;
    case 'analysis':
      return analysisHref;
    case 'intro':
      return `/ai-strategy/${applicationId}/strategy/intro`;
    case 'strategy':
      return `/ai-strategy/${applicationId}/strategy/analysis/recommendation`;
    case 'dashboard':
      return `/ai-strategy/${applicationId}/strategy/dashboard`;
  }
}
