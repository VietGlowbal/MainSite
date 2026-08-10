'use client';

import { Badge, Button } from '@/shared/ui';
import { usePlannerDemo } from '../hooks';
import type { DemoState } from '../domain';
import { PAYWALL_CTA, PAYWALL_TEASER_READY, PAYWALL_UNLOCK_LABEL } from '../domain';
import { ApplicationHero } from './application-hero';
import { DemoStateSwitcher } from './demo-state-switcher';
import { PhaseList } from './phase-list';
import { PlannerHeader } from './planner-header';
import { StatusStrip } from './status-strip';
import { TaskWorkspace } from './task-workspace';
import { UpNextCard } from './up-next-card';

/** Cambridge Engineering planner workspace (spec §3–9) — the whole demo lives here. */
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

  const currentTask = application.currentTaskId
    ? application.phases.flatMap((p) => p.tasks).find((t) => t.id === application.currentTaskId)
    : undefined;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col gap-gb-2xl bg-surface pb-gb-6xl">
      <PlannerHeader />
      <ApplicationHero />
      <StatusStrip progress={progress} daysLeft={application.daysLeft} alerts={alerts} />

      {currentTask ? (
        <UpNextCard
          copy={currentTask.upNext}
          estimatedMinutes={currentTask.estimatedMinutes}
          onOpen={() => openTask(currentTask.id)}
        />
      ) : (
        <div className="mx-gb-xl flex flex-col items-start gap-gb-lg rounded-gb-2xl border border-line bg-brand-subtle p-gb-2xl">
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
        onOpenTask={openTask}
        onUnlock={() => setDemoState('paid')}
      />

      {activeTask ? (
        <TaskWorkspace
          task={activeTask}
          onClose={closeTask}
          onCompleteReflection={completeReflection}
          onCompleteTask={markTaskComplete}
        />
      ) : null}

      <DemoStateSwitcher demoState={demoState} onSetState={setDemoState} onReset={resetDemo} />
    </div>
  );
}
