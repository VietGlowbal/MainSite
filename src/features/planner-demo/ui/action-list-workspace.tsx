'use client';

import { useState } from 'react';
import { Button, ICONS, KitIcon } from '@/shared/ui';
import { PROFILE_ACTIONS } from '../domain';
import { TaskWorkspaceShell } from './task-workspace-shell';

export function ActionListWorkspace({
  onClose,
  onComplete,
}: {
  onClose: () => void;
  onComplete: () => void;
}) {
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set());

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <TaskWorkspaceShell title="Strengthen your profile" onClose={onClose}>
      <p className="text-gb-md text-fg-tertiary">
        A few things would move your match score the most — tick off what you&rsquo;ve already
        started.
      </p>

      <ul className="flex flex-col gap-gb-md">
        {PROFILE_ACTIONS.map((action) => {
          const done = checked.has(action.id);
          return (
            <li key={action.id}>
              <button
                type="button"
                onClick={() => toggle(action.id)}
                aria-pressed={done}
                className="flex w-full items-start gap-gb-lg rounded-gb-xl border border-line bg-surface p-gb-lg text-left transition-colors hover:bg-surface-hover"
              >
                <span
                  className={`mt-gb-xxs flex size-[20px] shrink-0 items-center justify-center rounded-gb-full border ${
                    done ? 'border-brand bg-brand text-on-brand' : 'border-line-strong text-transparent'
                  }`}
                >
                  <KitIcon art={ICONS.checkCircle} frame={16} />
                </span>
                <div className="flex flex-col gap-gb-xxs">
                  <span className={`text-gb-sm font-semibold ${done ? 'text-fg-tertiary line-through' : 'text-fg'}`}>
                    {action.title}
                  </span>
                  <span className="text-gb-sm text-fg-tertiary">{action.detail}</span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <Button
        size="lg"
        onClick={() => {
          onComplete();
          onClose();
        }}
        className="mb-gb-2xl"
      >
        Continue
      </Button>
    </TaskWorkspaceShell>
  );
}
