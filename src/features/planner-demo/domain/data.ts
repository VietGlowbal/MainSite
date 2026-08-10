import type { Application, DemoState, Phase, ReflectionAnswers, Task, UpNextCopy } from './types';
import { GENERIC_LOCKED_TEASER, PAYWALL_TEASER_LOCKED, PAYWALL_TEASER_READY } from './copy';

/**
 * Fixed demo persona (spec §2): Alex Nguyen, grade 12, Cambridge Engineering,
 * entry 2027. Not a real student record — see CLAUDE.md's rule on AI-generated
 * content that could pass for a real one.
 */
export const DEMO_STUDENT_NAME = 'Alex Nguyen';

/**
 * Pre-filled demo answers for the reflection task's "Use demo answer" button
 * (spec §8). The "built" line is the spec's own example verbatim; the other
 * two are written to match its voice since the spec did not supply them.
 */
export const DEMO_REFLECTION_ANSWERS: ReflectionAnswers = {
  built:
    'I built a low-cost air-quality monitoring system using Arduino sensors for classrooms in my school.',
  owned:
    'I owned the whole sensor-to-dashboard pipeline — picking the Arduino sensors, writing the code that read them, and building the simple dashboard that showed air quality live in the classroom.',
  difficult:
    'Getting reliable readings was hard. The sensors drifted with temperature, so I had to calibrate them against a reference device and write code to correct for it before the numbers were trustworthy.',
};

/**
 * A task before status is derived. `baseComplete` says whether the demo
 * narrative for this state already treats it as done (e.g. every task in
 * Phase 1 once `state === 'paid'`); `deriveStatuses` below turns that plus a
 * live "extra completed" overlay into the `current` / `todo` / `complete`
 * chain a phase actually renders.
 */
type TaskShape = {
  id: string;
  title: string;
  type: Task['type'];
  baseComplete: boolean;
  completionNote?: string | undefined;
  estimatedMinutes?: number | undefined;
  upNext: UpNextCopy;
};

type PhaseShape = {
  id: string;
  number: number;
  title: string;
  locked: boolean;
  teaser?: { body: string; unlockedBody?: string | undefined } | undefined;
  tasks: TaskShape[];
};

function phase1Tasks(state: DemoState): TaskShape[] {
  const reflectionDone = state !== 'new';
  const restDone = state === 'paywall' || state === 'paid';

  return [
    {
      id: 'p1-academic-profile',
      title: 'Confirm your academic profile',
      type: 'placeholder',
      baseComplete: true,
      completionNote: 'Nice start!',
      upNext: {
        eyebrow: 'Next stop: the basics',
        headline: 'Confirm your academic profile',
        cta: 'Confirm →',
      },
    },
    {
      id: 'p1-reflection',
      title: 'Reflect on your strongest experiences',
      type: 'reflection',
      baseComplete: reflectionDone,
      // Always shown once complete — including when the visitor completes it
      // live in the 'new' scenario, not only when the fixture starts done.
      completionNote: 'Nice work!',
      estimatedMinutes: 8,
      upNext: {
        eyebrow: 'Next stop: your strongest project',
        headline: 'Tell us about your proudest engineering project',
        cta: "Let's go →",
      },
    },
    {
      id: 'p1-requirements',
      title: 'Review Cambridge Engineering requirements',
      type: 'university_requirements',
      baseComplete: restDone,
      completionNote: 'Nice one!',
      estimatedMinutes: 5,
      upNext: {
        eyebrow: 'Next stop: know what Cambridge wants',
        headline: "Let's look at the Engineering requirements",
        cta: 'Explore →',
      },
    },
    {
      id: 'p1-report',
      title: 'Generate your Personal Report',
      type: 'report',
      baseComplete: restDone,
      completionNote: 'Done!',
      estimatedMinutes: 3,
      upNext: {
        eyebrow: 'Next stop: your personal report',
        headline: 'See how your profile stacks up',
        cta: 'Generate →',
      },
    },
    {
      id: 'p1-match',
      title: 'See your Cambridge Match',
      type: 'match',
      baseComplete: restDone,
      completionNote: 'Done!',
      estimatedMinutes: 3,
      upNext: {
        eyebrow: 'Next stop: your match score',
        headline: 'See your Cambridge Engineering match',
        cta: 'See match →',
      },
    },
  ];
}

function buildPhaseShapes(state: DemoState): PhaseShape[] {
  const paid = state === 'paid';

  return [
    {
      id: 'phase-1',
      number: 1,
      title: 'Understand your application',
      locked: false,
      tasks: phase1Tasks(state),
    },
    {
      id: 'phase-2',
      number: 2,
      title: 'Build your strategy',
      locked: !paid,
      teaser: paid
        ? undefined
        : { body: PAYWALL_TEASER_LOCKED, unlockedBody: PAYWALL_TEASER_READY },
      tasks: [
        {
          id: 'p2-strategy',
          title: 'Build your personalised application strategy',
          type: 'strategy',
          baseComplete: paid,
          upNext: {
            eyebrow: 'Next stop: your strategy',
            headline: "We've got a plan",
            cta: 'View strategy →',
          },
        },
      ],
    },
    {
      id: 'phase-3',
      number: 3,
      title: 'Strengthen your profile',
      locked: !paid,
      teaser: paid ? undefined : { body: GENERIC_LOCKED_TEASER },
      tasks: [
        {
          id: 'p3-profile',
          title: 'Close gaps and strengthen your evidence',
          type: 'action-list',
          baseComplete: paid,
          upNext: {
            eyebrow: 'Next stop: your profile',
            headline: 'Strengthen your Cambridge profile',
            cta: 'Continue →',
          },
        },
      ],
    },
    {
      id: 'phase-4',
      number: 4,
      title: 'Build your application',
      locked: !paid,
      teaser: paid ? undefined : { body: GENERIC_LOCKED_TEASER },
      tasks: [
        {
          id: 'p4-cv',
          title: 'Add your project to your CV',
          type: 'cv',
          baseComplete: false,
          estimatedMinutes: 4,
          upNext: {
            eyebrow: 'Next stop: your CV',
            headline: 'Your CV needs some engineering evidence',
            cta: 'Work on my CV →',
          },
        },
        {
          id: 'p4-statement',
          title: 'Draft your personal statement',
          type: 'statement',
          baseComplete: false,
          upNext: {
            eyebrow: 'Next stop: your statement',
            headline: 'Let’s make that experience impossible to miss',
            cta: 'Continue →',
          },
        },
      ],
    },
    {
      id: 'phase-5',
      number: 5,
      title: 'Ready to submit',
      locked: !paid,
      teaser: paid ? undefined : { body: GENERIC_LOCKED_TEASER },
      tasks: [
        {
          id: 'p5-final-review',
          title: 'Final review and readiness check',
          type: 'readiness-check',
          baseComplete: false,
          upNext: {
            eyebrow: 'Almost there',
            headline: 'Cambridge application: ready for one last look',
            cta: 'Review →',
          },
        },
      ],
    },
  ];
}

/**
 * Turns a phase's structural shape plus a live "extra completed" overlay
 * into real statuses: the first non-complete task in an unlocked phase is
 * `current`, everything after it is `todo`, everything before (or
 * base-complete, or overlay-complete) is `complete`. Locked phases pass
 * through untouched — completing a task never unlocks a phase in this demo,
 * only the state switcher does (spec §12).
 */
export function deriveStatuses(shapes: PhaseShape[], completedOverlay: ReadonlySet<string>): Phase[] {
  return shapes.map((shape) => {
    if (shape.locked) {
      return {
        id: shape.id,
        number: shape.number,
        title: shape.title,
        status: 'locked',
        ...(shape.teaser ? { teaser: shape.teaser } : {}),
        tasks: shape.tasks.map((t) => ({
          id: t.id,
          title: t.title,
          type: t.type,
          status: 'locked',
          ...(t.estimatedMinutes !== undefined ? { estimatedMinutes: t.estimatedMinutes } : {}),
          ...(t.completionNote !== undefined ? { completionNote: t.completionNote } : {}),
          upNext: t.upNext,
        })),
      };
    }

    let currentAssigned = false;
    const tasks: Task[] = shape.tasks.map((t) => {
      const complete = t.baseComplete || completedOverlay.has(t.id);
      const status = complete ? 'complete' : currentAssigned ? 'todo' : 'current';
      if (!complete && !currentAssigned) currentAssigned = true;
      return {
        id: t.id,
        title: t.title,
        type: t.type,
        status,
        ...(t.estimatedMinutes !== undefined ? { estimatedMinutes: t.estimatedMinutes } : {}),
        ...(t.completionNote !== undefined ? { completionNote: t.completionNote } : {}),
        upNext: t.upNext,
      };
    });

    const allComplete = tasks.every((t) => t.status === 'complete');

    return {
      id: shape.id,
      number: shape.number,
      title: shape.title,
      status: allComplete ? 'complete' : 'active',
      ...(shape.teaser ? { teaser: shape.teaser } : {}),
      tasks,
    };
  });
}

/** First `current` task across all phases, in phase/task order. */
function findCurrentTaskId(phases: Phase[]): string | null {
  for (const phase of phases) {
    const current = phase.tasks.find((t) => t.status === 'current');
    if (current) return current.id;
  }
  return null;
}

const DAYS_LEFT: Record<DemoState, number> = {
  new: 143,
  progress: 143,
  paywall: 118,
  paid: 96,
};

/** Illustrative, not derived from task counts — spec §6 gives these as fixed examples. */
const BASE_PROGRESS: Record<DemoState, number> = {
  new: 12,
  progress: 18,
  paywall: 30,
  paid: 38,
};

const ALERTS: Record<DemoState, number> = {
  new: 2,
  progress: 2,
  paywall: 1,
  paid: 3,
};

export function buildApplicationShapes(state: DemoState): PhaseShape[] {
  return buildPhaseShapes(state);
}

/** Non-interactive snapshot for a state, with no live overlay applied. */
export function buildApplication(state: DemoState): Application {
  const phases = deriveStatuses(buildPhaseShapes(state), new Set());
  return {
    id: 'cambridge-engineering-2027',
    university: 'University of Cambridge',
    course: 'Engineering',
    entryYear: 2027,
    daysLeft: DAYS_LEFT[state],
    currentTaskId: findCurrentTaskId(phases),
    phases,
  };
}

export function baseProgressForState(state: DemoState): number {
  return BASE_PROGRESS[state];
}

export function daysLeftForState(state: DemoState): number {
  return DAYS_LEFT[state];
}

export function alertsForState(state: DemoState): number {
  return ALERTS[state];
}

export { findCurrentTaskId };
export type { PhaseShape, TaskShape };
