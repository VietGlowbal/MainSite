'use client';

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  alertsForApplication,
  buildApplication,
  findTaskById,
  progressForApplication,
  type Application,
  type DemoState,
  type PlannerView,
  type ReflectionAnswers,
  type Task,
} from '../domain';

const STORAGE_KEY = 'glowbal-planner-demo/cambridge-engineering-v2';

type PersistedState = {
  demoState: DemoState;
  view: PlannerView;
  selectedTaskId: string | null;
  completedTaskIds: string[];
  reflectionAnswers?: ReflectionAnswers;
};

function readStorage(): PersistedState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    if (!parsed.demoState || !Array.isArray(parsed.completedTaskIds)) return null;
    return {
      demoState: parsed.demoState,
      view: parsed.view ?? 'tasks',
      selectedTaskId: parsed.selectedTaskId ?? null,
      completedTaskIds: parsed.completedTaskIds,
      ...(parsed.reflectionAnswers ? { reflectionAnswers: parsed.reflectionAnswers } : {}),
    };
  } catch {
    return null;
  }
}

function writeStorage(state: PersistedState) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/**
 * `useSyncExternalStore` is what tells this hook hydration is over, without
 * tripping `react-hooks/set-state-in-effect` or a hydration mismatch — same
 * pattern as `onboarding-wizard.tsx`'s `NO_UPDATES`. React renders the
 * server snapshot first (matching the SSR HTML), then re-renders with the
 * client snapshot once hydration completes, and the store itself never
 * emits — "we are on the client" cannot stop being true once it is.
 */
const NO_UPDATES = () => () => {};
const onClient = () => true;
const onServer = () => false;

/**
 * Client-side planner state: which demo checkpoint is active, which view is
 * selected, which task is selected (persistent — not an open/close overlay,
 * see spec §12), and which tasks the visitor completed on top of the
 * checkpoint's own baseline. Persisted to localStorage (spec §25) — no
 * backend, no database write.
 *
 * `forceState`: true when the URL carried an explicit `?demo=` (see
 * `page.tsx`). A presenter jumping between checkpoint links expects each
 * link to show exactly that checkpoint — if a saved session were allowed to
 * win, `?demo=paywall` would silently render whatever was left over from an
 * earlier `?demo=new` visit in the same browser, one shared localStorage key
 * clobbering the other. Only a bare reload (no `?demo=`) resumes the saved
 * session; a link with the param always starts that checkpoint fresh.
 */
export function usePlannerDemo(initialState: DemoState, forceState: boolean) {
  const hydrated = useSyncExternalStore(NO_UPDATES, onClient, onServer);
  const [demoState, setDemoStateRaw] = useState<DemoState>(initialState);
  const [view, setView] = useState<PlannerView>('tasks');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [completedTaskIds, setCompletedTaskIds] = useState<readonly string[]>([]);
  const [reflectionAnswers, setReflectionAnswers] = useState<ReflectionAnswers | undefined>(
    undefined,
  );
  const [storageRead, setStorageRead] = useState(false);
  /** Gates the one-time auto-select below — see the comment on it for why this can't just be "selectedTaskId is null". */
  const [autoSelected, setAutoSelected] = useState(false);

  /*
   * Merge the saved snapshot in once hydration is over, adjusting state
   * DURING render rather than in an effect — React re-runs this component
   * with the merged values before committing, so nothing paints twice.
   */
  if (hydrated && !storageRead) {
    setStorageRead(true);
    const saved = forceState ? null : readStorage();
    if (saved) {
      setDemoStateRaw(saved.demoState);
      setView(saved.view);
      setSelectedTaskId(saved.selectedTaskId);
      setCompletedTaskIds(saved.completedTaskIds);
      if (saved.reflectionAnswers) setReflectionAnswers(saved.reflectionAnswers);
      if (saved.selectedTaskId !== null) setAutoSelected(true);
    }
  }

  useEffect(() => {
    if (!storageRead) return;
    writeStorage({
      demoState,
      view,
      selectedTaskId,
      completedTaskIds: [...completedTaskIds],
      ...(reflectionAnswers ? { reflectionAnswers } : {}),
    });
  }, [demoState, view, selectedTaskId, completedTaskIds, reflectionAnswers, storageRead]);

  const completedSet = useMemo(() => new Set(completedTaskIds), [completedTaskIds]);

  /** Built with no selection — the source for "what's genuinely next", independent of whatever's being reviewed. */
  const unselectedApplication = useMemo(
    () => buildApplication(demoState, null, completedSet),
    [demoState, completedSet],
  );

  /**
   * Auto-open the current task ONCE nothing has been selected yet this
   * checkpoint — GlowBal always has a next action (spec §1), so landing on
   * an empty panel would contradict the product itself. This can't just be
   * "selectedTaskId is null → fall back every render": completing the open
   * task changes `currentTaskId` on the very next render, and a continuous
   * fallback would silently swap the panel to the NEW task before the
   * success screen the just-completed task is showing ever renders. Gating
   * on `autoSelected` makes it fire once per checkpoint, so an explicit
   * "Back to tasks" (which sets this back to null on purpose) stays empty
   * instead of being immediately re-filled.
   */
  if (storageRead && !autoSelected) {
    setAutoSelected(true);
    if (selectedTaskId === null && unselectedApplication.currentTaskId) {
      setSelectedTaskId(unselectedApplication.currentTaskId);
    }
  }

  const application: Application = useMemo(
    () => buildApplication(demoState, selectedTaskId, completedSet),
    [demoState, selectedTaskId, completedSet],
  );

  const progress = progressForApplication(application);
  const alerts = alertsForApplication(application);

  /** The genuine next action, independent of whatever is selected — the Next Task card always shows this, never a task being reviewed. */
  const nextTask: Task | null = unselectedApplication.currentTaskId
    ? (findTaskById(unselectedApplication, unselectedApplication.currentTaskId) ?? null)
    : null;

  /** What the workspace panel renders — null when nothing is selected, e.g. right after "Back to tasks". */
  const selectedTask: Task | null = selectedTaskId ? (findTaskById(application, selectedTaskId) ?? null) : null;

  /** Selecting a task always switches to the Tasks view — the task lives there. */
  const selectTask = useCallback((taskId: string | null) => {
    setSelectedTaskId(taskId);
    if (taskId) setView('tasks');
  }, []);

  const markTaskComplete = useCallback((taskId: string) => {
    setCompletedTaskIds((prev) => (prev.includes(taskId) ? prev : [...prev, taskId]));
  }, []);

  const completeReflection = useCallback(
    (answers: ReflectionAnswers) => {
      setReflectionAnswers(answers);
      markTaskComplete('p1-reflection');
    },
    [markTaskComplete],
  );

  const setDemoState = useCallback((next: DemoState) => {
    setDemoStateRaw(next);
    setCompletedTaskIds([]);
    setReflectionAnswers(undefined);
    setSelectedTaskId(null);
    setView('tasks');
    setAutoSelected(false);
  }, []);

  const resetDemo = useCallback(() => {
    if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY);
    setDemoStateRaw('new');
    setView('tasks');
    setSelectedTaskId(null);
    setCompletedTaskIds([]);
    setReflectionAnswers(undefined);
    setAutoSelected(false);
  }, []);

  return {
    application,
    demoState,
    view,
    setView,
    progress,
    alerts,
    reflectionAnswers,
    /** Raw selection — null until the visitor explicitly picks a task. Mobile uses this to decide accordion vs. workspace. */
    selectedTaskId,
    /** The genuine next action, unaffected by review selections — what the Next Task card shows. */
    nextTask,
    /** What the workspace panel renders — selection with a next-action fallback, so desktop's panel is never empty. */
    selectedTask,
    selectTask,
    markTaskComplete,
    completeReflection,
    setDemoState,
    resetDemo,
  };
}
