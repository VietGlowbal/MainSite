'use client';

import { useEffect, useState } from 'react';
import { Button, ProgressBar } from '@/shared/ui';
import { PERSONAL_REPORT } from '../domain';
import { ConfidenceBadge } from './confidence-badge';
import { TaskWorkspaceShell } from './task-workspace-shell';

/** "Generate your Personal Report" — a simulated AI pass over what GlowBal already knows. */
export function ReportWorkspace({
  onClose,
  onComplete,
}: {
  onClose: () => void;
  onComplete: () => void;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 1100);
    return () => clearTimeout(timer);
  }, []);

  if (!ready) {
    return (
      <TaskWorkspaceShell title="Your personal report" onClose={onClose}>
        <div className="flex flex-1 flex-col items-center justify-center gap-gb-xl py-gb-7xl text-center">
          <p className="text-gb-md font-medium text-fg-brand">Reading your profile so far…</p>
          <ProgressBar label="Generating your personal report" className="max-w-[220px]" />
        </div>
      </TaskWorkspaceShell>
    );
  }

  return (
    <TaskWorkspaceShell title="Your personal report" onClose={onClose}>
      <div className="flex items-center justify-between gap-gb-lg">
        <p className="text-gb-md text-fg-tertiary">Based on what you&rsquo;ve told us so far.</p>
        <ConfidenceBadge level={PERSONAL_REPORT.overallConfidence} />
      </div>

      <section className="flex flex-col gap-gb-md">
        <h2 className="text-gb-sm font-semibold text-fg">Strengths</h2>
        <ul className="flex flex-col gap-gb-md">
          {PERSONAL_REPORT.strengths.map((item) => (
            <li
              key={item.text}
              className="flex items-start justify-between gap-gb-md rounded-gb-xl border border-line bg-surface p-gb-lg"
            >
              <span className="text-gb-sm text-fg">{item.text}</span>
              <ConfidenceBadge level={item.confidence} />
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-gb-md">
        <h2 className="text-gb-sm font-semibold text-fg">Still missing</h2>
        <ul className="flex flex-col gap-gb-md">
          {PERSONAL_REPORT.gaps.map((item) => (
            <li
              key={item.text}
              className="flex items-start justify-between gap-gb-md rounded-gb-xl border border-line bg-surface-muted p-gb-lg"
            >
              <span className="text-gb-sm text-fg-tertiary">{item.text}</span>
              <ConfidenceBadge level={item.confidence} />
            </li>
          ))}
        </ul>
      </section>

      <Button
        size="lg"
        onClick={() => {
          onComplete();
          onClose();
        }}
        className="mb-gb-2xl"
      >
        Back to my plan
      </Button>
    </TaskWorkspaceShell>
  );
}
