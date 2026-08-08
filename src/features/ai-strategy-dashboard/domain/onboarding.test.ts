import { describe, expect, it } from 'vitest';
import { isOnboardingComplete, nextOnboardingStep, onboardingStepHref, type OnboardingState } from './onboarding';

function state(overrides: Partial<OnboardingState> = {}): OnboardingState {
  return {
    personalSummaryComplete: false,
    achievementsComplete: false,
    aiAnalysisComplete: false,
    introSeen: false,
    strategyComplete: false,
    ...overrides,
  };
}

describe('nextOnboardingStep', () => {
  it('sends a brand-new student to Personal Summary first', () => {
    expect(nextOnboardingStep(state())).toBe('personal-summary');
  });

  it('does not skip Achievements just because Personal Summary is done', () => {
    expect(nextOnboardingStep(state({ personalSummaryComplete: true }))).toBe('achievements');
  });

  it('a student with zero achievements can still be marked complete and move on', () => {
    // The whole point of the fix: achievementsComplete is an explicit flag,
    // not "do any rows exist" — this state is reachable with zero
    // student_achievements/student_activities rows.
    expect(
      nextOnboardingStep(
        state({ personalSummaryComplete: true, achievementsComplete: true }),
      ),
    ).toBe('analysis');
  });

  it('routes to the intro once analysis is done but the intro has not been seen', () => {
    expect(
      nextOnboardingStep(
        state({ personalSummaryComplete: true, achievementsComplete: true, aiAnalysisComplete: true }),
      ),
    ).toBe('intro');
  });

  it('routes to the Personalized Strategy report once the intro has been seen but the report has not generated', () => {
    expect(
      nextOnboardingStep(
        state({
          personalSummaryComplete: true,
          achievementsComplete: true,
          aiAnalysisComplete: true,
          introSeen: true,
        }),
      ),
    ).toBe('strategy');
  });

  it('routes to the dashboard only once every step, including the strategy report, is done', () => {
    expect(
      nextOnboardingStep(
        state({
          personalSummaryComplete: true,
          achievementsComplete: true,
          aiAnalysisComplete: true,
          introSeen: true,
          strategyComplete: true,
        }),
      ),
    ).toBe('dashboard');
  });

  it('resumes at the first unfinished step regardless of what order things were done in', () => {
    // Analysis done (e.g. re-run) but achievements somehow not marked --
    // resume there, not skip ahead because a later step has data.
    expect(
      nextOnboardingStep(
        state({ personalSummaryComplete: true, aiAnalysisComplete: true }),
      ),
    ).toBe('achievements');
  });
});

describe('isOnboardingComplete', () => {
  it('is false until every step is true', () => {
    expect(isOnboardingComplete(state())).toBe(false);
    expect(
      isOnboardingComplete(
        state({ personalSummaryComplete: true, achievementsComplete: true, aiAnalysisComplete: true }),
      ),
    ).toBe(false);
    // Everything but the strategy report — still not complete.
    expect(
      isOnboardingComplete(
        state({
          personalSummaryComplete: true,
          achievementsComplete: true,
          aiAnalysisComplete: true,
          introSeen: true,
        }),
      ),
    ).toBe(false);
  });

  it('is true only when all five steps are done', () => {
    expect(
      isOnboardingComplete(
        state({
          personalSummaryComplete: true,
          achievementsComplete: true,
          aiAnalysisComplete: true,
          introSeen: true,
          strategyComplete: true,
        }),
      ),
    ).toBe(true);
  });
});

describe('onboardingStepHref', () => {
  it('carries a return param through the shared reflection flow to this Strategy', () => {
    const href = onboardingStepHref('personal-summary', 'app-1');
    expect(href).toBe(
      `/ai-strategy/reflection?return=${encodeURIComponent('/ai-strategy/app-1/strategy/analysis')}`,
    );
  });

  it('routes achievements the same way', () => {
    const href = onboardingStepHref('achievements', 'app-1');
    expect(href).toContain('/ai-strategy/reflection/achievements?return=');
  });

  it('routes the remaining steps to their own per-Strategy pages', () => {
    expect(onboardingStepHref('analysis', 'app-1')).toBe('/ai-strategy/app-1/strategy/analysis');
    expect(onboardingStepHref('intro', 'app-1')).toBe('/ai-strategy/app-1/strategy/intro');
    expect(onboardingStepHref('strategy', 'app-1')).toBe(
      '/ai-strategy/app-1/strategy/analysis/recommendation',
    );
    expect(onboardingStepHref('dashboard', 'app-1')).toBe('/ai-strategy/app-1/strategy/dashboard');
  });
});
