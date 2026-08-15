import { describe, expect, it } from 'vitest';
import {
  confirmedReflectionContinueHref,
  isOnboardingComplete,
  nextOnboardingStep,
  onboardingStepHref,
  type OnboardingState,
} from './onboarding';

function state(overrides: Partial<OnboardingState> = {}): OnboardingState {
  return {
    personalSummaryComplete: false,
    achievementsComplete: false,
    personalReflectionComplete: false,
    candidateConfirmed: false,
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
    ).toBe('personal-reflection');
  });

  it('routes to confirm once personal reflection is done', () => {
    expect(
      nextOnboardingStep(
        state({
          personalSummaryComplete: true,
          achievementsComplete: true,
          personalReflectionComplete: true,
        }),
      ),
    ).toBe('confirm');
  });

  it('routes to analysis once the candidate information has been confirmed', () => {
    expect(
      nextOnboardingStep(
        state({
          personalSummaryComplete: true,
          achievementsComplete: true,
          personalReflectionComplete: true,
          candidateConfirmed: true,
        }),
      ),
    ).toBe('analysis');
  });

  it('routes to the intro once analysis is done but the intro has not been seen', () => {
    expect(
      nextOnboardingStep(
        state({
          personalSummaryComplete: true,
          achievementsComplete: true,
          personalReflectionComplete: true,
          candidateConfirmed: true,
          aiAnalysisComplete: true,
        }),
      ),
    ).toBe('intro');
  });

  it('routes to the Personalized Strategy report once the intro has been seen but the report has not generated', () => {
    expect(
      nextOnboardingStep(
        state({
          personalSummaryComplete: true,
          achievementsComplete: true,
          personalReflectionComplete: true,
          candidateConfirmed: true,
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
          personalReflectionComplete: true,
          candidateConfirmed: true,
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

  it('does not let analysis run ahead of confirmation even if it somehow already has data', () => {
    // Candidate information must be explicitly confirmed before analysis is
    // treated as the next step, even if an analysis row exists from a prior
    // run — resuming should not paper over a missing confirmation.
    expect(
      nextOnboardingStep(
        state({
          personalSummaryComplete: true,
          achievementsComplete: true,
          personalReflectionComplete: true,
          aiAnalysisComplete: true,
        }),
      ),
    ).toBe('confirm');
  });
});

describe('isOnboardingComplete', () => {
  it('is false until every step is true', () => {
    expect(isOnboardingComplete(state())).toBe(false);
    expect(
      isOnboardingComplete(
        state({
          personalSummaryComplete: true,
          achievementsComplete: true,
          personalReflectionComplete: true,
          candidateConfirmed: true,
          aiAnalysisComplete: true,
        }),
      ),
    ).toBe(false);
    // Everything but the strategy report — still not complete.
    expect(
      isOnboardingComplete(
        state({
          personalSummaryComplete: true,
          achievementsComplete: true,
          personalReflectionComplete: true,
          candidateConfirmed: true,
          aiAnalysisComplete: true,
          introSeen: true,
        }),
      ),
    ).toBe(false);
  });

  it('is true only when all seven steps are done', () => {
    expect(
      isOnboardingComplete(
        state({
          personalSummaryComplete: true,
          achievementsComplete: true,
          personalReflectionComplete: true,
          candidateConfirmed: true,
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

  it('routes personal reflection the same way', () => {
    const href = onboardingStepHref('personal-reflection', 'app-1');
    expect(href).toContain('/ai-strategy/reflection/personal?return=');
  });

  it('routes confirm the same way, into the shared reflection flow', () => {
    const href = onboardingStepHref('confirm', 'app-1');
    expect(href).toContain('/ai-strategy/reflection/confirm?return=');
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

describe('confirmedReflectionContinueHref', () => {
  it('sends the student to the analysis gate while reports are still pending', () => {
    expect(confirmedReflectionContinueHref('app-1', false)).toBe('/ai-strategy/app-1/strategy/analysis');
  });

  it('carries a return param to this Strategy once reports exist, so the Personal Report keeps its nav band', () => {
    const href = confirmedReflectionContinueHref('app-1', true);
    expect(href).toBe(
      `/ai-strategy/personal-report?return=${encodeURIComponent('/ai-strategy/app-1/strategy/analysis')}`,
    );
  });
});
