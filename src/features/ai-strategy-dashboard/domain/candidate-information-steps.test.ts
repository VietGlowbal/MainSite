import { describe, expect, it } from 'vitest';
import { candidateInformationStepperSteps } from './candidate-information-steps';
import type { OnboardingState } from './onboarding';

const baseState: OnboardingState = {
  personalSummaryComplete: false,
  achievementsComplete: false,
  personalReflectionComplete: false,
  candidateConfirmed: false,
  aiAnalysisComplete: false,
  introSeen: false,
  strategyComplete: false,
};

describe('candidateInformationStepperSteps', () => {
  it('renders the four-step "Application setup" stepper in order', () => {
    const { steps } = candidateInformationStepperSteps(baseState, 'personal-summary', 'app-1', undefined);
    expect(steps.map((s) => s.key)).toEqual(['personal-summary', 'achievements', 'personal-reflection', 'confirm']);
    expect(steps.map((s) => s.label)).toEqual(['Profile', 'Experiences', 'Personal reflection', 'Review']);
  });

  it('marks a step complete only once its matching onboarding flag is set — spec example: "✓ Profile / ● Experiences / ○ Personal reflection / ○ Review"', () => {
    const { steps, currentIndex } = candidateInformationStepperSteps(
      { ...baseState, personalSummaryComplete: true },
      'achievements',
      'app-1',
      undefined,
    );
    expect(steps.map((s) => s.complete)).toEqual([true, false, false, false]);
    expect(currentIndex).toBe(1);
  });

  it('reports the current step by index even when revisiting an already-complete step', () => {
    const { currentIndex } = candidateInformationStepperSteps(
      { ...baseState, personalSummaryComplete: true, achievementsComplete: true },
      'personal-summary',
      'app-1',
      undefined,
    );
    expect(currentIndex).toBe(0);
  });

  it('carries the given returnTo through every step href, so leaving mid-flow never loses the destination', () => {
    const { steps } = candidateInformationStepperSteps(baseState, 'achievements', 'app-42', '/ai-strategy/report');
    for (const step of steps) {
      expect(step.href).toContain(encodeURIComponent('/ai-strategy/report'));
    }
  });

  it('falls back to this application’s analysis page when no returnTo is given', () => {
    const { steps } = candidateInformationStepperSteps(baseState, 'achievements', 'app-42', undefined);
    for (const step of steps) {
      expect(step.href).toContain(encodeURIComponent('/ai-strategy/app-42/strategy/analysis'));
    }
  });
});
