'use client';

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  alertsForState,
  baseProgressForState,
  buildApplicationShapes,
  daysLeftForState,
  deriveStatuses,
  findCurrentTaskId,
  type Application,
  type DemoState,
  type ReflectionAnswers,
} from '../domain';

const STORAGE_KEY = 'glowbal-planner-demo/cambridge-engineering';

type PersistedState = {
  demoState: DemoState;
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
 * pattern and same reasoning as `onboarding-wizard.tsx`'s `NO_UPDATES`: a
 * `useState` initialiser reading localStorage would make the hydration render
 * disagree with the server's HTML, and a `useEffect` calling `setState` is
 * exactly what that lint rule flags. React renders the server snapshot first
 * (matching the SSR HTML), then re-renders with the client snapshot once
 * hydration completes, and the store itself never emits — "we are on the
 * client" cannot stop being true once it is.
 */
const NO_UPDATES = () => () => {};
const onClient = () => true;
const onServer = () => false;

/**
 * Client-side planner state: which demo scenario is active, which tasks the
 * visitor has completed on top of that scenario's baseline, and which task
 * (if any) is open full-screen. Persisted to localStorage per spec §16 — no
 * backend, no database write.
 */
export function usePlannerDemo(initialState: DemoState) {
  const hydrated = useSyncExternalStore(NO_UPDATES, onClient, onServer);
  const [demoState, setDemoStateRaw] = useState<DemoState>(initialState);
  const [completedTaskIds, setCompletedTaskIds] = useState<readonly string[]>([]);
  const [reflectionAnswers, setReflectionAnswers] = useState<ReflectionAnswers | undefined>(
    undefined,
  );
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [storageRead, setStorageRead] = useState(false);

  /*
   * Merge the saved snapshot in once hydration is over, adjusting state
   * DURING render rather than in an effect — React re-runs this component
   * with the merged values before committing, so nothing paints twice.
   */
  if (hydrated && !storageRead) {
    setStorageRead(true);
    const saved = readStorage();
    if (saved) {
      setDemoStateRaw(saved.demoState);
      setCompletedTaskIds(saved.completedTaskIds);
      if (saved.reflectionAnswers) setReflectionAnswers(saved.reflectionAnswers);
    }
  }

  useEffect(() => {
    // Skipped until the saved snapshot has been read, so this does not
    // overwrite it with the pre-hydration defaults first.
    if (!storageRead) return;
    writeStorage({
      demoState,
      completedTaskIds: [...completedTaskIds],
      ...(reflectionAnswers ? { reflectionAnswers } : {}),
    });
  }, [demoState, completedTaskIds, reflectionAnswers, storageRead]);

  const shapes = useMemo(() => buildApplicationShapes(demoState), [demoState]);
  const completedSet = useMemo(() => new Set(completedTaskIds), [completedTaskIds]);
  const phases = useMemo(() => deriveStatuses(shapes, completedSet), [shapes, completedSet]);

  /** Completions the visitor made on top of the scenario's own baseline. */
  const extraCompletedCount = useMemo(() => {
    let count = 0;
    for (const shape of shapes) {
      for (const t of shape.tasks) {
        if (!t.baseComplete && completedSet.has(t.id)) count += 1;
      }
    }
    return count;
  }, [shapes, completedSet]);

  const application: Application = useMemo(
    () => ({
      id: 'cambridge-engineering-2027',
      university: 'University of Cambridge',
      course: 'Engineering',
      entryYear: 2027,
      daysLeft: daysLeftForState(demoState),
      currentTaskId: findCurrentTaskId(phases),
      phases,
    }),
    [demoState, phases],
  );

  const progress = Math.min(100, baseProgressForState(demoState) + extraCompletedCount * 6);
  const alerts = Math.max(0, alertsForState(demoState) - extraCompletedCount);

  const activeTask = useMemo(() => {
    if (!activeTaskId) return null;
    for (const phase of phases) {
      const found = phase.tasks.find((t) => t.id === activeTaskId);
      if (found) return found;
    }
    return null;
  }, [phases, activeTaskId]);

  const openTask = useCallback((taskId: string) => setActiveTaskId(taskId), []);
  const closeTask = useCallback(() => setActiveTaskId(null), []);

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
    setActiveTaskId(null);
  }, []);

  const resetDemo = useCallback(() => {
    if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY);
    setDemoStateRaw('new');
    setCompletedTaskIds([]);
    setReflectionAnswers(undefined);
    setActiveTaskId(null);
  }, []);

  return {
    application,
    demoState,
    progress,
    alerts,
    reflectionAnswers,
    activeTask,
    openTask,
    closeTask,
    markTaskComplete,
    completeReflection,
    setDemoState,
    resetDemo,
  };
}
