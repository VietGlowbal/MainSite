'use client';

import { useState } from 'react';
import { AnimatePresence, MotionConfig } from 'framer-motion';
import { Badge, Button } from '@/shared/ui';
import { usePlannerDemo } from '../hooks';
import type { DemoState } from '../domain';
import { PAYWALL_CTA, PAYWALL_TEASER_READY, PAYWALL_UNLOCK_LABEL } from '../domain';
import { ApplicationHero } from './application-hero';
import { DemoStateSwitcher } from './demo-state-switcher';
import { DesktopTopBar } from './desktop-top-bar';
import { PhaseList } from './phase-list';
import { PhaseNavRail } from './phase-nav-rail';
import { PlannerHeader } from './planner-header';
import { StatusStrip } from './status-strip';
import { TaskWorkspace } from './task-workspace';
import { UpNextCard } from './up-next-card';

/**
 * Cambridge Engineering planner workspace (spec §3–9) — the whole demo lives
 * here. Mobile stays the single stacked column the spec calls for; `lg:` and
 * up adds a sticky top bar and a phase-navigation rail around that same
 * column ("elevated single column", not a permanent split pane — see
 * `task-workspace-shell.tsx`'s note on why an opened task is still an
 * overlay, not a second pane).
 */
export function PlannerDemoApp({ initialState }: { initialState: DemoState }) {
  const {
    application,
    demoState,
    progress,
    alerts,
    activeTask,
    openTask,
    closeTask,
    completeReflection,
    markTaskComplete,
    setDemoState,
    resetDemo,
  } = usePlannerDemo(initialState);

  const [expandedPhaseId, setExpandedPhaseId] = useState<string | null>('phase-1');

  const currentTask = application.currentTaskId
    ? application.phases.flatMap((p) => p.tasks).find((t) => t.id === application.currentTaskId)
    : undefined;

  const shortUniversity = application.university.replace(/^University of /, '');

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-surface">
        <DesktopTopBar course={`${shortUniversity} ${application.course}`} />

        <div className="flex flex-col lg:mx-auto lg:w-full lg:max-w-gb-desktop lg:flex-row lg:items-start lg:gap-gb-4xl lg:px-gb-4xl lg:py-gb-4xl">
          <div className="hidden lg:block lg:w-[220px] lg:shrink-0">
            <PhaseNavRail
              phases={application.phases}
              expandedPhaseId={expandedPhaseId}
              onSelect={setExpandedPhaseId}
            />
          </div>

          <div className="mx-auto flex w-full max-w-[420px] flex-col gap-gb-2xl pb-gb-6xl lg:mx-0 lg:max-w-3xl lg:pb-gb-4xl">
            <div className="lg:hidden">
              <PlannerHeader />
            </div>

            <ApplicationHero />
            <StatusStrip progress={progress} daysLeft={application.daysLeft} alerts={alerts} />

            {currentTask ? (
              <UpNextCard
                taskId={currentTask.id}
                copy={currentTask.upNext}
                estimatedMinutes={currentTask.estimatedMinutes}
                onOpen={() => openTask(currentTask.id)}
              />
            ) : (
              <div className="mx-gb-xl flex flex-col items-start gap-gb-lg rounded-gb-2xl border border-line bg-brand-subtle p-gb-2xl lg:mx-0 lg:p-gb-3xl">
                <Badge variant="reach">{PAYWALL_UNLOCK_LABEL}</Badge>
                <p className="font-display text-gb-display-xs font-semibold text-fg">
                  {PAYWALL_TEASER_READY}
                </p>
                <Button size="lg" onClick={() => setDemoState('paid')}>
                  {PAYWALL_CTA}
                </Button>
              </div>
            )}

            <PhaseList
              phases={application.phases}
              expandedPhaseId={expandedPhaseId}
              onExpandedChange={setExpandedPhaseId}
              onOpenTask={openTask}
              onUnlock={() => setDemoState('paid')}
            />
          </div>
        </div>

        <AnimatePresence>
          {activeTask ? (
            <TaskWorkspace
              key={activeTask.id}
              task={activeTask}
              onClose={closeTask}
              onCompleteReflection={completeReflection}
              onCompleteTask={markTaskComplete}
            />
          ) : null}
        </AnimatePresence>

        <DemoStateSwitcher demoState={demoState} onSetState={setDemoState} onReset={resetDemo} />
      </div>
    </MotionConfig>
  );
}
