'use client';

import { useState } from 'react';
import { Button } from '@/shared/ui';
import { EVIDENCE_FOCUS } from '../domain';
import { TaskWorkspaceShell } from './task-workspace-shell';

/**
 * Evidence Builder (spec §13): pulls prior reflections/achievements in
 * automatically ("contextNote"), then offers AI-suggested evidence points
 * the student can accept as-is. One component, four focuses — Phase 3's
 * four evidence tasks all render this, parameterized by `focus`.
 */
export function ActionListWorkspace({
  focus,
  onBack,
  onComplete,
}: {
  focus: keyof typeof EVIDENCE_FOCUS;
  onBack: () => void;
  onComplete: () => void;
}) {
  const content = EVIDENCE_FOCUS[focus];
  const [accepted, setAccepted] = useState<ReadonlySet<number>>(new Set());

  function toggle(i: number) {
    setAccepted((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  return (
    <TaskWorkspaceShell title={content.title} onBack={onBack}>
      <p className="text-gb-md text-fg-tertiary">{content.intro}</p>
      <p className="text-gb-xs text-fg-muted">💡 {content.contextNote}</p>

      <ul className="flex flex-col gap-gb-md">
        {content.prompts.map((prompt, i) => {
          const isAccepted = accepted.has(i);
          return (
            <li key={prompt.question} className="rounded-gb-xl border border-line bg-surface p-gb-lg">
              <p className="mb-gb-sm text-gb-sm font-semibold text-fg">{prompt.question}</p>
              <p className="mb-gb-md text-gb-sm text-fg-tertiary">{prompt.aiSuggestion}</p>
              <button
                type="button"
                onClick={() => toggle(i)}
                className={`rounded-gb-md px-gb-lg py-gb-xs text-gb-xs font-semibold transition-colors ${
                  isAccepted ? 'bg-tier-safe text-on-tier-safe' : 'bg-brand-subtle text-fg-brand hover:bg-brand-surface'
                }`}
              >
                {isAccepted ? '✓ Accepted' : 'Accept suggestion'}
              </button>
            </li>
          );
        })}
      </ul>

      <Button
        size="lg"
        onClick={() => {
          onComplete();
          onBack();
        }}
        className="mb-gb-2xl"
      >
        Continue
      </Button>
    </TaskWorkspaceShell>
  );
}
