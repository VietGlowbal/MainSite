'use client';

import { Button } from '@/shared/ui';
import type { ReflectionAnswers, Task } from '../domain';
import { ActionListWorkspace } from './action-list-workspace';
import { CvWorkspace } from './cv-workspace';
import { MatchWorkspace } from './match-workspace';
import { ReadinessWorkspace } from './readiness-workspace';
import { ReflectionWorkspace } from './reflection-workspace';
import { ReportWorkspace } from './report-workspace';
import { RequirementsWorkspace } from './requirements-workspace';
import { StatementWorkspace } from './statement-workspace';
import { StrategyWorkspace } from './strategy-workspace';
import { TaskWorkspaceShell } from './task-workspace-shell';

/**
 * Fallback for any task type without a real renderer. Nothing in the current
 * task list reaches this — every type has a real (still-mocked) workspace —
 * but the router keeps a default branch so a future task type degrades
 * gracefully instead of crashing.
 */
function PlaceholderWorkspace({
  task,
  onClose,
  onComplete,
}: {
  task: Task;
  onClose: () => void;
  onComplete: () => void;
}) {
  return (
    <TaskWorkspaceShell title={task.title} onClose={onClose}>
      <div className="flex flex-1 flex-col items-center justify-center gap-gb-lg py-gb-7xl text-center">
        <p className="font-display text-gb-display-xs font-semibold text-fg">{task.title}</p>
        <p className="max-w-[320px] text-gb-md text-fg-tertiary">
          This part of the planner isn&rsquo;t built out for the demo — in the real product this
          is where GlowBal would render the tool for this specific task.
        </p>
        <Button
          size="lg"
          onClick={() => {
            onComplete();
            onClose();
          }}
          className="mt-gb-lg"
        >
          Mark as done (demo)
        </Button>
      </div>
    </TaskWorkspaceShell>
  );
}

/** The GenUI-style task renderer: dispatches on `task.type` (spec §14). */
export function TaskWorkspace({
  task,
  onClose,
  onCompleteReflection,
  onCompleteTask,
}: {
  task: Task;
  onClose: () => void;
  onCompleteReflection: (answers: ReflectionAnswers) => void;
  onCompleteTask: (taskId: string) => void;
}) {
  const onComplete = () => onCompleteTask(task.id);

  switch (task.type) {
    case 'reflection':
      return <ReflectionWorkspace onClose={onClose} onComplete={onCompleteReflection} />;
    case 'cv':
      return <CvWorkspace onClose={onClose} onComplete={onComplete} />;
    case 'university_requirements':
      return <RequirementsWorkspace onClose={onClose} onComplete={onComplete} />;
    case 'report':
      return <ReportWorkspace onClose={onClose} onComplete={onComplete} />;
    case 'match':
      return <MatchWorkspace onClose={onClose} onComplete={onComplete} />;
    case 'strategy':
      return <StrategyWorkspace onClose={onClose} onComplete={onComplete} />;
    case 'action-list':
      return <ActionListWorkspace onClose={onClose} onComplete={onComplete} />;
    case 'statement':
      return <StatementWorkspace onClose={onClose} onComplete={onComplete} />;
    case 'readiness-check':
      return <ReadinessWorkspace onClose={onClose} onComplete={onComplete} />;
    default:
      return <PlaceholderWorkspace task={task} onClose={onClose} onComplete={onComplete} />;
  }
}
