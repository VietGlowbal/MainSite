import type { StepperStep } from '@/shared/ui';
import { onboardingStepHref, type OnboardingState, type OnboardingStep } from './onboarding';

/**
 * The high-level "Application setup" stepper — ✓ Profile / ● Experiences /
 * ○ Personal reflection / ○ Review — shown alongside (never instead of) the
 * more granular in-page breadcrumb. They answer different questions: this
 * says how far through the four-step candidate-information flow the student
 * is; the breadcrumb says exactly where inside the current step they are
 * (which activity, which reflection dimension). Deliberately covers only
 * the first four `OnboardingStep`s — analysis/intro/strategy/dashboard are
 * a different, later journey with its own `AI_JOURNEY` stepper.
 */

const CANDIDATE_INFO_STEPS: ReadonlyArray<{ key: OnboardingStep; label: string }> = [
  { key: 'personal-summary', label: 'Profile' },
  { key: 'achievements', label: 'Experiences' },
  { key: 'personal-reflection', label: 'Personal reflection' },
  { key: 'confirm', label: 'Review' },
];

function isStepComplete(key: OnboardingStep, state: OnboardingState): boolean {
  switch (key) {
    case 'personal-summary':
      return state.personalSummaryComplete;
    case 'achievements':
      return state.achievementsComplete;
    case 'personal-reflection':
      return state.personalReflectionComplete;
    case 'confirm':
      return state.candidateConfirmed;
    default:
      return false;
  }
}

/**
 * Builds the four `StepperStep`s for `<Stepper>`. `current` is the step the
 * student is looking at right now (not necessarily the first incomplete
 * one — e.g. going back to review a confirmed Profile step). Steps are
 * clickable links (via `onboardingStepHref`) so the stepper doubles as
 * navigation, not just a progress readout.
 */
export function candidateInformationStepperSteps(
  state: OnboardingState,
  current: OnboardingStep,
  applicationId: string,
  returnTo: string | undefined,
): { steps: StepperStep[]; currentIndex: number } {
  const steps: StepperStep[] = CANDIDATE_INFO_STEPS.map(({ key, label }) => ({
    key,
    label,
    complete: isStepComplete(key, state),
    href: onboardingStepHref(key, applicationId, returnTo ? { returnTo } : undefined),
  }));

  const currentIndex = CANDIDATE_INFO_STEPS.findIndex((step) => step.key === current);

  return { steps, currentIndex: currentIndex === -1 ? 0 : currentIndex };
}
