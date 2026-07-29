import type { ApplicationStage, ApplicationTask } from '@/lib/apply-types';

/**
 * Checklist progress for an application.
 *
 * THIS EXISTS BECAUSE THE SIDEBAR WAS MAKING IT UP. The panel showed
 * "In progress" as the literal `1` and derived "Not started" as
 * `total - completed - 1`, so an application with no checklist rendered
 * "Completed 0/0, In progress 1, Not started -1" — a negative count of tasks,
 * next to a 100% bar. Every part of that was wrong, and none of it came from
 * the data.
 *
 * Counting is pure and testable, so it lives here rather than in the component.
 */

export type TaskCounts = {
  completed: number;
  inProgress: number;
  notStarted: number;
  /** Blocked, waiting on someone, or not applicable. */
  parked: number;
  total: number;
  /**
   * Completed as a share of everything countable, 0–100. Rounded.
   *
   * NOT read from `course_applications.progress_percentage`: that column is
   * written by the parse worker and by hand, and legacy rows carry 100 with no
   * tasks at all — which is what put "100%" above "0/0" on the live page. The
   * checklist is the truth about how far along an application is.
   */
  percent: number;
};

const EMPTY: TaskCounts = {
  completed: 0,
  inProgress: 0,
  notStarted: 0,
  parked: 0,
  total: 0,
  percent: 0,
};

/**
 * Count the tasks across every stage.
 *
 * `parked` covers blocked / waiting / not-applicable. They are counted but kept
 * out of the percentage: a task the student cannot act on should not hold their
 * progress bar down, and marking a requirement "not applicable" ought to move
 * them forward rather than leave them stuck at 80% forever.
 */
export function summariseTasks(stages: ApplicationStage[]): TaskCounts {
  const tasks: ApplicationTask[] = stages.flatMap((stage) => stage.tasks ?? []);
  if (tasks.length === 0) return EMPTY;

  let completed = 0;
  let inProgress = 0;
  let notStarted = 0;
  let parked = 0;

  for (const task of tasks) {
    if (task.status === 'completed') completed += 1;
    else if (task.status === 'in_progress') inProgress += 1;
    else if (task.status === 'not_started') notStarted += 1;
    else parked += 1;
  }

  const countable = completed + inProgress + notStarted;

  return {
    completed,
    inProgress,
    notStarted,
    parked,
    total: tasks.length,
    percent: countable === 0 ? 0 : Math.round((completed / countable) * 100),
  };
}

/**
 * Which stage the student should land on.
 *
 * The one in progress, else the first with unfinished work, else the first.
 * Returns -1 only when there are no stages at all, which the caller renders as
 * the "checklist not built yet" state rather than as an empty journey.
 */
export function activeStageIndex(stages: ApplicationStage[]): number {
  if (stages.length === 0) return -1;

  const inProgress = stages.findIndex((s) => s.status === 'in_progress');
  if (inProgress !== -1) return inProgress;

  const unfinished = stages.findIndex((stage) =>
    (stage.tasks ?? []).some((t) => t.status !== 'completed'),
  );
  if (unfinished !== -1) return unfinished;

  // Everything done: sit on the last stage rather than sending them back to
  // the top of a finished application.
  return stages.length - 1;
}

/**
 * Per-stage completion, for the stepper's supporting line.
 *
 * A stage with no tasks reports null rather than 0/0 — "no tasks" and "none of
 * the tasks are done" are different things, and only one of them is the
 * student's problem.
 */
export function stageProgressLabel(stage: ApplicationStage): string | null {
  const tasks = stage.tasks ?? [];
  if (tasks.length === 0) return null;
  const done = tasks.filter((t) => t.status === 'completed').length;
  return `${done}/${tasks.length} done`;
}
