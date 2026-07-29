import type { StepperStep } from '@/shared/ui';

/**
 * The AI strategy journey — the paid one.
 *
 * TWO JOURNEYS, AND THIS IS THE SECOND. The other is the per-course checklist
 * on /apply/[applicationId] (Research → Check eligibility → Prepare documents →
 * Improve application → Submit), which is free and is written by the course
 * parser. This one is a single guided pass over the student's own profile, and
 * steps 4 and 5 sit behind the paywall — which is why `Stepper` renders locked
 * steps as a wall rather than as progress not yet made.
 *
 * The list lived only inside stepper.test.tsx until now, which meant the test
 * asserted against a journey definition no page shared. It is real here.
 */
export const AI_JOURNEY_STEPS = [
  'reflection',
  'report',
  'university',
  'strategy',
  'audit',
] as const;

export type AiJourneyStep = (typeof AI_JOURNEY_STEPS)[number];

type StepDef = {
  key: AiJourneyStep;
  label: string;
  /** One line on what the student does here. */
  blurb: string;
  /** Behind the paywall. */
  paid: boolean;
  /** The route, once it exists. `null` means it is not built yet. */
  href: string | null;
};

export const AI_JOURNEY: StepDef[] = [
  {
    key: 'reflection',
    label: 'Reflection',
    blurb: 'Your background, grades, achievements and what you are aiming for.',
    paid: false,
    href: null,
  },
  {
    key: 'report',
    label: 'Output report',
    blurb: 'What your profile says about you, read back as a candidate portrait.',
    paid: false,
    href: null,
  },
  {
    key: 'university',
    label: 'University Detail',
    blurb: 'How well you fit a course, with the requirements and costs beside it.',
    paid: false,
    href: null,
  },
  {
    key: 'strategy',
    label: 'Application Strategy',
    blurb: 'AI feedback on your essay and your CV, one draft at a time.',
    paid: true,
    href: null,
  },
  {
    key: 'audit',
    label: 'Submit Audit',
    blurb: 'A last check over everything you are about to send.',
    paid: true,
    href: null,
  },
];

/**
 * The journey as the shared `Stepper` wants it.
 *
 * A step with no route yet is not linkified — an anchor that does not navigate
 * is worse than plain text, and this journey is mostly unbuilt.
 */
export function aiJourneySteps(): StepperStep[] {
  return AI_JOURNEY.map((step) => ({
    key: step.key,
    label: step.label,
    ...(step.paid ? { locked: true } : {}),
    ...(step.href ? { href: step.href } : {}),
  }));
}
