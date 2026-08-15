'use client';

import { useState } from 'react';
import { Button, ICONS, KitIcon } from '@/shared/ui';
import { READINESS_CHECKLISTS } from '../domain';
import { TaskWorkspaceShell } from './task-workspace-shell';

const TITLE: Record<keyof typeof READINESS_CHECKLISTS, string> = {
  requirements: 'Requirement check',
  completeness: 'Document completeness',
  consistency: 'Consistency review',
  final: 'Final Readiness Review',
};

/** Phase 5's four readiness tasks all render this, parameterized by which checklist. */
export function ReadinessWorkspace({
  checklist,
  onBack,
  onComplete,
}: {
  checklist: keyof typeof READINESS_CHECKLISTS;
  onBack: () => void;
  onComplete: () => void;
}) {
  const items = READINESS_CHECKLISTS[checklist];
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set());
  const allReady = checked.size === items.length;

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <TaskWorkspaceShell title={TITLE[checklist]} onBack={onBack}>
      <p className="text-gb-md text-fg-tertiary">
        {checklist === 'final'
          ? 'Cambridge application: ready for one last look.'
          : 'Tick each one off as you confirm it.'}
      </p>

      <ul className="flex flex-col gap-gb-md">
        {items.map((item) => {
          const done = checked.has(item.id);
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => toggle(item.id)}
                aria-pressed={done}
                className="flex w-full items-center gap-gb-lg rounded-gb-xl border border-line bg-surface p-gb-lg text-left transition-colors hover:bg-surface-hover"
              >
                <span
                  className={`flex size-[24px] shrink-0 items-center justify-center rounded-gb-full border ${
                    done ? 'border-tier-safe bg-tier-safe text-on-tier-safe' : 'border-line-strong text-transparent'
                  }`}
                >
                  <KitIcon art={ICONS.checkCircle} frame={20} />
                </span>
                <span className={`text-gb-sm font-medium ${done ? 'text-fg-tertiary line-through' : 'text-fg'}`}>
                  {item.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <Button
        size="lg"
        disabled={!allReady}
        onClick={() => {
          onComplete();
          onBack();
        }}
        className="mb-gb-2xl"
      >
        {allReady ? 'Ready to submit ✨' : `${checked.size}/${items.length} confirmed`}
      </Button>
    </TaskWorkspaceShell>
  );
}
