'use client';

import { useState } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import { Badge, Button } from '@/shared/ui';
import { usePlannerDemo } from '../hooks';
import type { DemoState } from '../domain';
import { PAYWALL_CTA, PAYWALL_TEASER_READY, PAYWALL_UNLOCK_LABEL } from '../domain';
import { ApplicationHero } from './application-hero';
import { CalendarView } from './calendar-view';
import { DemoStateSwitcher } from './demo-state-switcher';
import { DesktopTopBar } from './desktop-top-bar';
import { KanbanView } from './kanban-view';
import { OutputsView } from './outputs-view';
import { PhaseList } from './phase-list';
import { PlannerHeader } from './planner-header';
import { PlannerViewSwitch } from './planner-view-switch';
import { StatusStrip } from './status-strip';
import { TaskWorkspace } from './task-workspace';
import { UpNextCard } from './up-next-card';

const EASE = [0.22, 1, 0.36, 1] as const;

/** Phase 1 done, Phase 2 locked behind the paywall (spec §19) — shown wherever the Next Task / workspace normally goes. */
function PaywallCard({ onUnlock, compact }: { onUnlock: () => void; compact?: boolean }) {
  return (
    <div className={`flex flex-col items-start gap-gb-lg rounded-gb-2xl border border-line bg-brand-subtle ${compact ? 'p-gb-xl' : 'p-gb-2xl'}`}>
      <Badge variant="reach">{PAYWALL_UNLOCK_LABEL}</Badge>
      <p className="font-display text-gb-display-xs font-semibold text-fg">{PAYWALL_TEASER_READY}</p>
      <Button size="lg" onClick={onUnlock}>
        {PAYWALL_CTA}
      </Button>
    </div>
  );
}

/** Shown on desktop after "Back to tasks" deliberately leaves nothing selected — distinct from the paywall, not a stand-in for it. */
function EmptyTaskPanel() {
  return (
    <div className="flex flex-col items-center gap-gb-sm py-gb-7xl text-center">
      <span className="text-gb-xl">✨</span>
      <p className="text-gb-sm text-fg-tertiary">Pick a task from your plan to get started.</p>
    </div>
  );
}

/**
 * Cambridge Engineering planner workspace — the whole demo lives here.
 * Rebuilt around one main workspace layout (spec §5): a persistent left
 * planner column (Next Task, the four-view switch, phase accordion) next to
 * a persistent right workspace that renders whichever view is active.
 * Mobile can't show two columns, so it swaps a single content area instead
 * (spec §22) — both are rendered here and toggled by breakpoint, sharing
 * the same state.
 */
export function PlannerDemoApp({
  initialState,
  forceState,
}: {
  initialState: DemoState;
  /** True when the URL carried an explicit `?demo=` — see `page.tsx` and the hook's own doc comment. */
  forceState: boolean;
}) {
  const {
    application,
    demoState,
    view,
    setView,
    progress,
    alerts,
    selectedTaskId,
    nextTask,
    selectedTask,
    selectTask,
    completeReflection,
    markTaskComplete,
    setDemoState,
    resetDemo,
  } = usePlannerDemo(initialState, forceState);

  const [expandedPhaseId, setExpandedPhaseId] = useState<string | null>('phase-1');

  const allTasks = application.phases.flatMap((p) => p.tasks);
  const shortUniversity = application.university.replace(/^University of /, '');
  const deadlineDate = '2026-10-15';
  const showPaywall = !nextTask;

  const leftColumn = (
    <>
      {showPaywall ? (
        <PaywallCard onUnlock={() => setDemoState('strategy')} compact />
      ) : (
        <UpNextCard taskId={nextTask.id} copy={nextTask.upNext} onOpen={() => selectTask(nextTask.id)} />
      )}
      <PlannerViewSwitch view={view} onChange={setView} />
    </>
  );

  const rightPanel = (() => {
    if (view === 'calendar') {
      return <CalendarView tasks={allTasks} deadlineDate={deadlineDate} deadlineLabel={application.deadlineLabel} onSelectTask={selectTask} />;
    }
    if (view === 'kanban') {
      return <KanbanView tasks={allTasks} onSelectTask={selectTask} />;
    }
    if (view === 'outputs') {
      return <OutputsView outputs={application.outputs} onOpenTask={selectTask} />;
    }
    if (selectedTask) {
      return (
        <TaskWorkspace
          task={selectedTask}
          onBack={() => selectTask(null)}
          onCompleteReflection={completeReflection}
          onCompleteTask={markTaskComplete}
          onSelectTask={selectTask}
        />
      );
    }
    if (showPaywall) return <PaywallCard onUnlock={() => setDemoState('strategy')} />;
    return <EmptyTaskPanel />;
  })();

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-surface">
        <DesktopTopBar course={`${shortUniversity} ${application.course}`} />
        <div className="lg:hidden">
          <PlannerHeader />
        </div>

        <div className="mx-auto w-full max-w-[420px] px-gb-xl pb-gb-6xl lg:max-w-gb-desktop lg:px-gb-4xl lg:pb-gb-5xl">
          <div className="flex flex-col gap-gb-lg py-gb-xl lg:flex-row lg:items-start lg:justify-between lg:gap-gb-2xl lg:py-gb-3xl">
            <ApplicationHero />
            <StatusStrip progress={progress} daysLeft={application.daysLeft} alerts={alerts} />
          </div>

          {/* ── Mobile: one column, swaps content instead of showing two ── */}
          <div className="flex flex-col gap-gb-lg lg:hidden">
            {leftColumn}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${view}-${view === 'tasks' ? (selectedTaskId ?? 'list') : ''}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: EASE }}
              >
                {view === 'tasks' ? (
                  selectedTaskId ? (
                    <div className="rounded-gb-2xl border border-line bg-surface p-gb-xl">{rightPanel}</div>
                  ) : (
                    <PhaseList
                      phases={application.phases}
                      expandedPhaseId={expandedPhaseId}
                      onExpandedChange={setExpandedPhaseId}
                      selectedTaskId={selectedTask?.id ?? null}
                      onSelectTask={selectTask}
                      onUnlock={() => setDemoState('strategy')}
                    />
                  )
                ) : (
                  rightPanel
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* ── Desktop: persistent two-column workspace ── */}
          <div className="hidden lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start lg:gap-gb-3xl">
            <div className="flex flex-col gap-gb-lg lg:sticky lg:top-gb-7xl">
              {leftColumn}
              <PhaseList
                phases={application.phases}
                expandedPhaseId={expandedPhaseId}
                onExpandedChange={setExpandedPhaseId}
                selectedTaskId={selectedTask?.id ?? null}
                onSelectTask={selectTask}
                onUnlock={() => setDemoState('strategy')}
              />
            </div>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${view}-${view === 'tasks' ? (selectedTask?.id ?? 'empty') : ''}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: EASE }}
                className={view === 'tasks' && selectedTask ? 'rounded-gb-2xl border border-line bg-surface p-gb-2xl' : ''}
              >
                {rightPanel}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <DemoStateSwitcher demoState={demoState} onSetState={setDemoState} onReset={resetDemo} />
      </div>
    </MotionConfig>
  );
}
