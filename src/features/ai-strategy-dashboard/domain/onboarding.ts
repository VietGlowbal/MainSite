/**
 * Strategy onboarding-completion state (requirements.md Requirement 1.2-1.3,
 * 15.4) — REPLACES the "has at least one achievement or activity" proxy the
 * first pass used, which could never be satisfied by a student with
 * genuinely zero achievements (Requirement 4.3 explicitly allows that) and
 * was satisfied by any activity row regardless of which flow wrote it.
 *
 * Four real, independently-recorded steps:
 *  - personalSummaryComplete / achievementsComplete — shared across every
 *    Strategy (student_profiles.personal_summary_completed_at /
 *    achievements_completed_at), set by an explicit "Continue" submit, not
 *    inferred from whether any rows exist.
 *  - aiAnalysisComplete — per Strategy: an `applicant_analyses` row exists
 *    for this application.
 *  - introSeen — per Strategy: `course_applications.strategy_intro_seen_at`
 *    is set, marked when the Strategy Introduction page is opened.
 */
export type OnboardingState = {
  personalSummaryComplete: boolean;
  achievementsComplete: boolean;
  aiAnalysisComplete: boolean;
  introSeen: boolean;
};

export type OnboardingStep =
  | 'personal-summary'
  | 'achievements'
  | 'analysis'
  | 'intro'
  | 'dashboard';

/** True once every step is done — requirements.md 1.3's "completed onboarding". */
export function isOnboardingComplete(state: OnboardingState): boolean {
  return (
    state.personalSummaryComplete &&
    state.achievementsComplete &&
    state.aiAnalysisComplete &&
    state.introSeen
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
    case 'dashboard':
      return `/ai-strategy/${applicationId}/strategy/dashboard`;
  }
}
