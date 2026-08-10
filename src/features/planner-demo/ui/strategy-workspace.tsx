'use client';

import { Button } from '@/shared/ui';
import { STRATEGY_PRIORITIES } from '../domain';
import { TaskWorkspaceShell } from './task-workspace-shell';

export function StrategyWorkspace({
  onClose,
  onComplete,
}: {
  onClose: () => void;
  onComplete: () => void;
}) {
  return (
    <TaskWorkspaceShell title="Your Cambridge strategy" onClose={onClose}>
      <p className="text-gb-md text-fg-tertiary">
        We turned what we know about you and Cambridge into four priorities.
      </p>

      <ol className="flex flex-col gap-gb-lg">
        {STRATEGY_PRIORITIES.map((priority, i) => (
          <li
            key={priority.title}
            className="flex gap-gb-lg rounded-gb-2xl border border-line bg-surface p-gb-lg"
          >
            <span className="flex size-[28px] shrink-0 items-center justify-center rounded-gb-full bg-brand text-gb-xs font-semibold text-on-brand">
              {i + 1}
            </span>
            <div className="flex flex-col gap-gb-xxs">
              <span className="text-gb-sm font-semibold text-fg">{priority.title}</span>
              <span className="text-gb-sm text-fg-tertiary">{priority.detail}</span>
            </div>
          </li>
        ))}
      </ol>

      <Button
        size="lg"
        onClick={() => {
          onComplete();
          onClose();
        }}
        className="mb-gb-2xl"
      >
        Start Phase 2
      </Button>
    </TaskWorkspaceShell>
  );
}
