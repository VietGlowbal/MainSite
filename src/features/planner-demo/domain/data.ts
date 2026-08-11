import type {
  Application,
  DemoState,
  Output,
  Phase,
  Task,
  TaskPriority,
  TaskType,
  UpNextCopy,
} from './types';
import { DEMO_STATES } from './types';
import { GENERIC_LOCKED_TEASER, PAYWALL_TEASER_LOCKED, PAYWALL_TEASER_READY } from './copy';

/**
 * The master task order (spec §10) — one flat list across all five phases,
 * in narrative sequence. `deriveApplication` below turns "how far into this
 * list has the demo state reached" into real per-task statuses, so the
 * fixture and the live interactive overlay share one rule and can never
 * disagree (same principle as the original data.ts's `deriveStatuses`).
 */
type TaskShape = {
  id: string;
  phaseId: string;
  phaseNumber: number;
  title: string;
  type: TaskType;
  estimatedMinutes?: number;
  dueDate?: string;
  priority?: TaskPriority;
  outputId?: string;
  upNext: UpNextCopy;
};

const PHASE_META: readonly { id: string; number: number; title: string }[] = [
  { id: 'phase-1', number: 1, title: 'Understand your application' },
  { id: 'phase-2', number: 2, title: 'Build your strategy' },
  { id: 'phase-3', number: 3, title: 'Strengthen your profile' },
  { id: 'phase-4', number: 4, title: 'Build your application' },
  { id: 'phase-5', number: 5, title: 'Ready to submit' },
];

/**
 * Index in this array doubles as "how complete" a demo state is — see
 * `STATE_CURRENT_INDEX` below. Order matters as much as content.
 */
const MASTER_TASKS: readonly TaskShape[] = [
  // ── Phase 1 — Understand your application ────────────────────────────
  {
    id: 'p1-academic-profile',
    phaseId: 'phase-1',
    phaseNumber: 1,
    title: 'Confirm your academic profile',
    type: 'profile-confirm',
    upNext: { eyebrow: 'Next stop: the basics', headline: 'Confirm your academic profile', cta: 'Confirm →' },
  },
  {
    id: 'p1-reflection',
    phaseId: 'phase-1',
    phaseNumber: 1,
    title: 'Add your reflections',
    type: 'reflection',
    estimatedMinutes: 8,
    priority: 'high',
    dueDate: '2026-08-14',
    upNext: {
      eyebrow: 'Next stop: your strongest project',
      headline: 'Tell us about the experiences that shaped you',
      cta: "Let's go →",
    },
  },
  {
    id: 'p1-achievements',
    phaseId: 'phase-1',
    phaseNumber: 1,
    title: 'Add achievements',
    type: 'achievement',
    estimatedMinutes: 5,
    priority: 'medium',
    dueDate: '2026-08-18',
    upNext: {
      eyebrow: 'Next stop: what you’ve done',
      headline: 'Add your academic and extracurricular achievements',
      cta: 'Add achievements →',
    },
  },
  {
    id: 'p1-personal-report',
    phaseId: 'phase-1',
    phaseNumber: 1,
    title: 'Generate Personal Report',
    type: 'personal-report',
    estimatedMinutes: 2,
    priority: 'medium',
    outputId: 'output-personal-report',
    upNext: { eyebrow: 'Next stop: your personal report', headline: 'See how your profile stacks up', cta: 'Generate →' },
  },
  {
    id: 'p1-matching-report',
    phaseId: 'phase-1',
    phaseNumber: 1,
    title: 'Generate Matching Report',
    type: 'matching-report',
    estimatedMinutes: 2,
    priority: 'medium',
    dueDate: '2026-08-24',
    outputId: 'output-matching-report',
    upNext: { eyebrow: 'Next stop: your match score', headline: 'See how well you match Cambridge Engineering', cta: 'See match →' },
  },

  // ── Phase 2 — Build your strategy ─────────────────────────────────────
  {
    id: 'p2-review-personal-report',
    phaseId: 'phase-2',
    phaseNumber: 2,
    title: 'Review Personal Report',
    type: 'personal-report',
    priority: 'low',
    outputId: 'output-personal-report',
    upNext: { eyebrow: 'Next stop: a second look', headline: 'Review your Personal Report', cta: 'Review →' },
  },
  {
    id: 'p2-review-matching-report',
    phaseId: 'phase-2',
    phaseNumber: 2,
    title: 'Review Matching Report',
    type: 'matching-report',
    priority: 'low',
    outputId: 'output-matching-report',
    upNext: { eyebrow: 'Next stop: a second look', headline: 'Review how you match Cambridge Engineering', cta: 'Review →' },
  },
  {
    id: 'p2-choose-priorities',
    phaseId: 'phase-2',
    phaseNumber: 2,
    title: 'Choose your priorities',
    type: 'strategy',
    priority: 'high',
    upNext: { eyebrow: 'Next stop: what matters most', headline: 'Choose what matters most to you', cta: 'Choose →' },
  },
  {
    id: 'p2-strategy',
    phaseId: 'phase-2',
    phaseNumber: 2,
    title: 'Generate Cambridge Strategy',
    type: 'strategy',
    estimatedMinutes: 3,
    priority: 'high',
    dueDate: '2026-08-29',
    outputId: 'output-strategy',
    upNext: { eyebrow: 'Next stop: your strategy', headline: 'Turn your insights into your strategy', cta: 'Generate →' },
  },
  {
    id: 'p2-scholarship',
    phaseId: 'phase-2',
    phaseNumber: 2,
    title: 'Review scholarship recommendations',
    type: 'scholarship',
    priority: 'medium',
    outputId: 'output-scholarship',
    upNext: { eyebrow: 'Next stop: funding', headline: 'See scholarships you may be eligible for', cta: 'Review →' },
  },

  // ── Phase 3 — Strengthen your profile ─────────────────────────────────
  {
    id: 'p3-evidence-engineering',
    phaseId: 'phase-3',
    phaseNumber: 3,
    title: 'Strengthen engineering evidence',
    type: 'evidence-builder',
    estimatedMinutes: 6,
    priority: 'high',
    dueDate: '2026-09-05',
    upNext: { eyebrow: 'Next stop: your strongest evidence', headline: 'Strengthen your engineering evidence', cta: 'Strengthen →' },
  },
  {
    id: 'p3-evidence-leadership',
    phaseId: 'phase-3',
    phaseNumber: 3,
    title: 'Add leadership evidence',
    type: 'evidence-builder',
    estimatedMinutes: 5,
    priority: 'medium',
    upNext: { eyebrow: 'Next stop: leadership', headline: 'Add leadership evidence', cta: 'Add evidence →' },
  },
  {
    id: 'p3-evidence-wording',
    phaseId: 'phase-3',
    phaseNumber: 3,
    title: 'Improve activity impact wording',
    type: 'evidence-builder',
    estimatedMinutes: 4,
    priority: 'low',
    upNext: { eyebrow: 'Next stop: sharper wording', headline: 'Improve your activity impact wording', cta: 'Improve →' },
  },
  {
    id: 'p3-gaps',
    phaseId: 'phase-3',
    phaseNumber: 3,
    title: 'Address academic / profile gaps',
    type: 'evidence-builder',
    estimatedMinutes: 5,
    priority: 'high',
    dueDate: '2026-09-12',
    upNext: { eyebrow: 'Next stop: closing gaps', headline: 'Address your academic and profile gaps', cta: 'Address gaps →' },
  },
  {
    id: 'p3-scholarship-review',
    phaseId: 'phase-3',
    phaseNumber: 3,
    title: 'Review scholarship opportunity',
    type: 'scholarship',
    priority: 'low',
    outputId: 'output-scholarship',
    upNext: { eyebrow: 'Next stop: funding', headline: 'Take another look at your scholarship match', cta: 'Review →' },
  },

  // ── Phase 4 — Build your application ──────────────────────────────────
  {
    id: 'p4-cv',
    phaseId: 'phase-4',
    phaseNumber: 4,
    title: 'Build CV',
    type: 'cv',
    estimatedMinutes: 4,
    priority: 'high',
    dueDate: '2026-09-19',
    outputId: 'output-cv',
    upNext: { eyebrow: 'Next stop: your CV', headline: 'Your CV needs some engineering evidence', cta: 'Work on my CV →' },
  },
  {
    id: 'p4-statement',
    phaseId: 'phase-4',
    phaseNumber: 4,
    title: 'Draft personal statement',
    type: 'personal-statement',
    estimatedMinutes: 10,
    priority: 'high',
    dueDate: '2026-09-26',
    outputId: 'output-statement',
    upNext: { eyebrow: 'Next stop: your statement', headline: 'Let’s make that experience impossible to miss', cta: 'Draft →' },
  },
  {
    id: 'p4-recommendation',
    phaseId: 'phase-4',
    phaseNumber: 4,
    title: 'Prepare recommendation pack',
    type: 'recommendation',
    priority: 'medium',
    dueDate: '2026-10-01',
    outputId: 'output-recommendation',
    upNext: { eyebrow: 'Next stop: your recommender', headline: 'Prepare your recommendation pack', cta: 'Prepare →' },
  },
  {
    id: 'p4-documents',
    phaseId: 'phase-4',
    phaseNumber: 4,
    title: 'Review supporting documents',
    type: 'document-review',
    priority: 'medium',
    upNext: { eyebrow: 'Next stop: your documents', headline: 'Review your supporting documents', cta: 'Review →' },
  },

  // ── Phase 5 — Ready to submit ──────────────────────────────────────────
  {
    id: 'p5-requirements',
    phaseId: 'phase-5',
    phaseNumber: 5,
    title: 'Requirement check',
    type: 'readiness-review',
    priority: 'high',
    upNext: { eyebrow: 'Almost there', headline: 'One last requirement check', cta: 'Check →' },
  },
  {
    id: 'p5-completeness',
    phaseId: 'phase-5',
    phaseNumber: 5,
    title: 'Document completeness',
    type: 'readiness-review',
    priority: 'high',
    dueDate: '2026-10-10',
    upNext: { eyebrow: 'Almost there', headline: 'Make sure every document is in', cta: 'Check →' },
  },
  {
    id: 'p5-consistency',
    phaseId: 'phase-5',
    phaseNumber: 5,
    title: 'Consistency review',
    type: 'readiness-review',
    priority: 'medium',
    upNext: { eyebrow: 'Almost there', headline: 'Check everything lines up', cta: 'Check →' },
  },
  {
    id: 'p5-readiness',
    phaseId: 'phase-5',
    phaseNumber: 5,
    title: 'Final readiness review',
    type: 'readiness-review',
    priority: 'high',
    dueDate: '2026-10-14',
    outputId: 'output-readiness',
    upNext: { eyebrow: 'Almost there', headline: 'Cambridge application: ready for one last look', cta: 'Review →' },
  },
] as const;

/**
 * First-incomplete-task index at each narrative checkpoint (spec §21). Tasks
 * before it are complete. Each checkpoint sits INSIDE the phase it's named
 * for (e.g. `application` mid-Phase-4, not just past it) — index 15 is where
 * Phase 4 starts, 19 is where it ends, so `application` has to land between them.
 */
const STATE_CURRENT_INDEX: Record<DemoState, number> = {
  new: 1,
  phase1: 3,
  matching: 5,
  paywall: 5,
  strategy: 10,
  profile: 15,
  application: 17,
  ready: 21,
};

/** Phase 2–5 stay locked until the strategy is generated and unlocks the rest (spec §13, §19). */
const UNLOCK_STATE_INDEX = DEMO_STATES.indexOf('strategy');

/** The one task flagged `needs_attention` once it's reachable but not yet resolved (spec §11). */
const NEEDS_ATTENTION: Partial<Record<DemoState, readonly string[]>> = {
  application: ['p4-recommendation'],
  ready: ['p4-recommendation'],
};

const DAYS_LEFT: Record<DemoState, number> = {
  new: 143,
  phase1: 138,
  matching: 130,
  paywall: 120,
  strategy: 110,
  profile: 90,
  application: 60,
  ready: 20,
};

const OUTPUTS_META: readonly { id: string; type: TaskType; title: string; description: string }[] = [
  { id: 'output-personal-report', type: 'personal-report', title: 'Personal Report', description: 'Overview of your background, strengths and aspirations.' },
  { id: 'output-matching-report', type: 'matching-report', title: 'Matching Report', description: 'How well your profile, interests and experience align with Cambridge Engineering.' },
  { id: 'output-strategy', type: 'strategy', title: 'Cambridge Strategy Summary', description: 'Your tailored strategy across choices, colleges and interview prep.' },
  { id: 'output-scholarship', type: 'scholarship', title: 'Scholarship Advice', description: 'Scholarship options and how to strengthen your application.' },
  { id: 'output-cv', type: 'cv', title: 'CV Draft', description: 'A skills- and impact-focused CV for your application.' },
  { id: 'output-statement', type: 'personal-statement', title: 'Personal Statement Draft', description: 'Your first draft, structured and feedback-ready.' },
  { id: 'output-recommendation', type: 'recommendation', title: 'Recommendation Pack', description: 'Everything your recommender needs to write a strong letter.' },
  { id: 'output-readiness', type: 'readiness-review', title: 'Final Readiness Review', description: 'End-to-end review before submission.' },
];

function completionNoteFor(type: TaskType): string {
  switch (type) {
    case 'reflection':
      return 'Nice work!';
    case 'achievement':
      return 'Nice one!';
    case 'personal-report':
    case 'matching-report':
    case 'strategy':
    case 'scholarship':
      return 'Done!';
    default:
      return 'Nice work!';
  }
}

function buildOutputs(state: DemoState): Output[] {
  const currentIndex = STATE_CURRENT_INDEX[state];
  return OUTPUTS_META.map((meta) => {
    const producingTasks = MASTER_TASKS.filter((t) => t.outputId === meta.id);
    const firstIndex = MASTER_TASKS.findIndex((t) => t.outputId === meta.id);
    const lastProducerIndex = Math.max(...producingTasks.map((t) => MASTER_TASKS.findIndex((t2) => t2.id === t.id)));
    const complete = firstIndex >= 0 && firstIndex < currentIndex;
    const inProgress = !complete && lastProducerIndex === currentIndex;
    return {
      id: meta.id,
      type: meta.type,
      title: meta.title,
      description: meta.description,
      status: complete ? 'complete' : inProgress ? 'in_progress' : 'not_started',
      generatedAt: complete || inProgress ? '2026-08-20' : null,
      updatedAt: complete ? '2026-08-27' : null,
      relatedTaskId: producingTasks[0]?.id ?? '',
      version: complete ? (producingTasks.length > 1 ? 2 : 1) : 1,
    };
  });
}

/**
 * Builds the full application for a demo state plus a live "selected task"
 * and "extra completed" overlay from the interactive session — the same
 * split as the original single-source-of-truth `deriveStatuses` had, just
 * driven by an index instead of a per-task boolean.
 *
 * The state's own `STATE_CURRENT_INDEX` is a FLOOR, not a fixed pointer:
 * completing the recommended task through the overlay has to visibly
 * promote the next one, or the "planner is alive" loop (spec §3) breaks the
 * moment a task is completed inside a state that hasn't caught up yet. So
 * the real "current" pointer is recomputed as the first not-yet-complete,
 * unlocked task — the floor plus the overlay together, not the floor alone.
 */
export function buildApplication(
  state: DemoState,
  selectedTaskId: string | null = null,
  extraCompleted: ReadonlySet<string> = new Set(),
): Application {
  const baseCurrentIndex = STATE_CURRENT_INDEX[state];
  const unlocked = DEMO_STATES.indexOf(state) >= UNLOCK_STATE_INDEX;
  const attentionIds = NEEDS_ATTENTION[state] ?? [];

  const isLocked = (phaseNumber: number) => phaseNumber !== 1 && !unlocked;
  const isComplete = (shape: TaskShape, index: number) =>
    index < baseCurrentIndex || extraCompleted.has(shape.id);

  let effectiveCurrentIndex = MASTER_TASKS.length;
  for (let i = 0; i < MASTER_TASKS.length; i += 1) {
    const shape = MASTER_TASKS[i]!;
    if (isLocked(shape.phaseNumber)) continue;
    if (!isComplete(shape, i)) {
      effectiveCurrentIndex = i;
      break;
    }
  }

  const phases: Phase[] = PHASE_META.map((meta) => {
    const locked = isLocked(meta.number);
    const shapes = MASTER_TASKS.filter((t) => t.phaseId === meta.id);

    const tasks: Task[] = shapes.map((shape) => {
      const index = MASTER_TASKS.findIndex((t) => t.id === shape.id);
      let status: Task['status'];
      if (locked) status = 'locked';
      else if (isComplete(shape, index)) status = 'complete';
      else if (attentionIds.includes(shape.id)) status = 'needs_attention';
      else if (index === effectiveCurrentIndex) status = selectedTaskId === shape.id ? 'in_progress' : 'recommended';
      else status = 'not_started';

      return {
        id: shape.id,
        phaseId: shape.phaseId,
        phaseNumber: shape.phaseNumber,
        title: shape.title,
        type: shape.type,
        status,
        ...(shape.estimatedMinutes !== undefined ? { estimatedMinutes: shape.estimatedMinutes } : {}),
        ...(status === 'complete' ? { completionNote: completionNoteFor(shape.type) } : {}),
        upNext: shape.upNext,
        ...(shape.dueDate !== undefined ? { dueDate: shape.dueDate } : {}),
        ...(shape.priority !== undefined ? { priority: shape.priority } : {}),
        ...(shape.outputId !== undefined ? { outputId: shape.outputId } : {}),
      };
    });

    const allComplete = tasks.every((t) => t.status === 'complete');
    const phaseStatus: Phase['status'] = locked ? 'locked' : allComplete ? 'complete' : 'active';

    const teaser =
      meta.number === 2
        ? { body: PAYWALL_TEASER_LOCKED, unlockedBody: PAYWALL_TEASER_READY }
        : meta.number > 2
          ? { body: GENERIC_LOCKED_TEASER }
          : undefined;

    return {
      id: meta.id,
      number: meta.number,
      title: meta.title,
      status: phaseStatus,
      ...(teaser ? { teaser } : {}),
      tasks,
    };
  });

  const currentTaskId = MASTER_TASKS[effectiveCurrentIndex]?.id ?? null;

  return {
    id: 'cambridge-engineering-2027',
    university: 'University of Cambridge',
    course: 'Engineering',
    entryYear: 2027,
    daysLeft: DAYS_LEFT[state],
    deadlineLabel: '15 October 2026',
    currentTaskId,
    phases,
    outputs: buildOutputs(state),
  };
}

export function progressForApplication(application: Application): number {
  const all = application.phases.flatMap((p) => p.tasks);
  const complete = all.filter((t) => t.status === 'complete').length;
  return Math.round((complete / all.length) * 100);
}

export function alertsForApplication(application: Application): number {
  return application.phases.flatMap((p) => p.tasks).filter((t) => t.status === 'needs_attention').length;
}

export function findTaskById(application: Application, taskId: string): Task | undefined {
  return application.phases.flatMap((p) => p.tasks).find((t) => t.id === taskId);
}

export { MASTER_TASKS };
