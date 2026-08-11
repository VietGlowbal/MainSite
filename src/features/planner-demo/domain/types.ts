/**
 * GlowBal Planner demo — domain types.
 *
 * Rebuilt around the "planner-first" architecture: the Planner is the
 * wrapper for the whole application, not one feature among several. A task's
 * `type` drives which GenUI workspace renders (spec §12–14); `status` drives
 * the accordion/kanban/calendar presentation (§11); `Output` is what a task
 * produces, kept distinct from the task that produced it (§17–18).
 *
 * Deliberately tiny per spec §24 — local TypeScript objects, no backend.
 * Nothing here is persisted to Supabase; see `hooks/use-planner-demo.ts` for
 * the localStorage overlay.
 */

export type TaskStatus =
  | 'locked'
  | 'not_started'
  | 'recommended'
  | 'in_progress'
  | 'complete'
  | 'needs_attention';

/**
 * The GenUI dispatch key (spec §12, §23). `task-workspace.tsx` renders a
 * genuinely different mini-interface per type — not one generic task-detail
 * component with different text.
 */
export type TaskType =
  | 'reflection'
  | 'achievement'
  | 'personal-report'
  | 'matching-report'
  | 'strategy'
  | 'evidence-builder'
  | 'scholarship'
  | 'cv'
  | 'personal-statement'
  | 'recommendation'
  | 'document-review'
  | 'readiness-review'
  /** The one bootstrap task with no GenUI moment — confirming the academic profile already on file. */
  | 'profile-confirm';

export type TaskPriority = 'low' | 'medium' | 'high';

/** How sure GlowBal's AI is of a piece of generated content (CLAUDE.md's rule on AI-generated facts). */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

/** The "Next task" card's copy for a task, distinct from its row label in the phase accordion. */
export type UpNextCopy = {
  eyebrow: string;
  headline: string;
  cta: string;
};

export type Task = {
  id: string;
  phaseId: string;
  phaseNumber: number;
  title: string;
  type: TaskType;
  status: TaskStatus;
  estimatedMinutes?: number | undefined;
  /** Shown next to a completed row, e.g. "Nice work!" — omit for a plain checkmark. */
  completionNote?: string | undefined;
  upNext: UpNextCopy;
  /** ISO date. Drives the Calendar view; absent for tasks with no natural deadline. */
  dueDate?: string | undefined;
  priority?: TaskPriority | undefined;
  /** The Output this task produces or updates, if any (spec §18). */
  outputId?: string | undefined;
};

export type PhaseStatus = 'active' | 'locked' | 'complete';

export type Phase = {
  id: string;
  number: number;
  title: string;
  status: PhaseStatus;
  /** The teaser shown when a locked phase is opened (spec §19's paywall demo). */
  teaser?:
    | {
        body: string;
        unlockedBody?: string | undefined;
        cta?: string | undefined;
      }
    | undefined;
  tasks: Task[];
};

export type OutputStatus = 'not_started' | 'in_progress' | 'complete';

/** Something a task produced — a report, a document, a strategy (spec §17). */
export type Output = {
  id: string;
  type: TaskType;
  title: string;
  description: string;
  status: OutputStatus;
  generatedAt: string | null;
  updatedAt: string | null;
  relatedTaskId: string;
  version: number;
};

export type Application = {
  id: string;
  university: string;
  course: string;
  entryYear: number;
  daysLeft: number;
  deadlineLabel: string;
  currentTaskId: string | null;
  phases: Phase[];
  outputs: Output[];
};

/** The four ways of working with the same plan (spec §9). */
export type PlannerView = 'tasks' | 'calendar' | 'kanban' | 'outputs';

export const PLANNER_VIEWS: readonly PlannerView[] = ['tasks', 'calendar', 'kanban', 'outputs'];

export function isPlannerView(value: string | undefined | null): value is PlannerView {
  return value === 'tasks' || value === 'calendar' || value === 'kanban' || value === 'outputs';
}

/**
 * The demo's narrative checkpoints (spec §20–21), in story order. The order
 * IS the progression: each state is "further along" than the one before it,
 * which `domain/data.ts` uses directly to derive task status.
 */
export const DEMO_STATES = [
  'new',
  'phase1',
  'matching',
  'paywall',
  'strategy',
  'profile',
  'application',
  'ready',
] as const;

export type DemoState = (typeof DEMO_STATES)[number];

export function isDemoState(value: string | undefined | null): value is DemoState {
  return (DEMO_STATES as readonly string[]).includes(value ?? '');
}

/** The reflection task's three answers (spec §13 reflection example). */
export type ReflectionAnswers = {
  built: string;
  owned: string;
  difficult: string;
};
