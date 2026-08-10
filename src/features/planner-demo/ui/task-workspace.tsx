'use client';

import { Button } from '@/shared/ui';
import type { ReflectionAnswers, Task } from '../domain';
import { CvWorkspace } from './cv-workspace';
import { ReflectionWorkspace } from './reflection-workspace';
import { TaskWorkspaceShell } from './task-workspace-shell';

/**
 * Placeholder mini-interface for every task type the demo does not build out
 * (spec §14: only `reflection` and `cv` get a real renderer). Still lets a
 * presenter click through the rest of Phase 1 so the planner keeps feeling
 * alive rather than stalling on the one task GlowBal actually built.
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
  if (task.type === 'reflection') {
    return <ReflectionWorkspace onClose={onClose} onComplete={onCompleteReflection} />;
  }
  if (task.type === 'cv') {
    return <CvWorkspace onClose={onClose} onComplete={() => onCompleteTask(task.id)} />;
  }
  return (
    <PlaceholderWorkspace task={task} onClose={onClose} onComplete={() => onCompleteTask(task.id)} />
  );
}
