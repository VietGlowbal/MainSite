/**
 * GlowBal Planner demo — domain types.
 *
 * Deliberately tiny, per the demo spec (§15): a local TypeScript object
 * stands in for the eventual planner backend. Nothing here is persisted to
 * Supabase; see `hooks/use-planner-demo.ts` for the localStorage overlay.
 */

export type TaskStatus = 'locked' | 'todo' | 'current' | 'complete';

/**
 * The GenUI dispatch key (spec §14). Only `reflection` and `cv` render a real
 * workspace; everything else falls back to a placeholder panel. That gap is
 * the point — it demonstrates the task-renderer architecture without
 * requiring every task type to be built for one demo.
 */
export type TaskType =
  | 'reflection'
  | 'university_requirements'
  | 'report'
  | 'match'
  | 'cv'
  | 'strategy'
  | 'placeholder';

/** The "Up next" card's copy for a task, distinct from its row label in the phase list. */
export type UpNextCopy = {
  eyebrow: string;
  headline: string;
  cta: string;
};

export type Task = {
  id: string;
  title: string;
  type: TaskType;
  status: TaskStatus;
  estimatedMinutes?: number | undefined;
  /** Shown next to a completed row, e.g. "Nice start!" — omit for a plain checkmark. */
  completionNote?: string | undefined;
  upNext: UpNextCopy;
};

export type PhaseStatus = 'active' | 'locked' | 'complete';

export type Phase = {
  id: string;
  number: number;
  title: string;
  status: PhaseStatus;
  /**
   * The teaser shown when a locked phase is tapped (spec §11). Absent on
   * unlocked phases, which expand to their task list instead.
   */
  teaser?:
    | {
        body: string;
        unlockedBody?: string | undefined;
        cta?: string | undefined;
      }
    | undefined;
  tasks: Task[];
};

export type Application = {
  id: string;
  university: string;
  course: string;
  entryYear: number;
  daysLeft: number;
  currentTaskId: string | null;
  phases: Phase[];
};

/** The four `?state=` values from spec §12, plus what each proves. */
export type DemoState = 'new' | 'progress' | 'paywall' | 'paid';

export const DEMO_STATES: readonly DemoState[] = ['new', 'progress', 'paywall', 'paid'];

export function isDemoState(value: string | undefined | null): value is DemoState {
  return value === 'new' || value === 'progress' || value === 'paywall' || value === 'paid';
}

/** The reflection task's three answers (spec §8). */
export type ReflectionAnswers = {
  built: string;
  owned: string;
  difficult: string;
};
