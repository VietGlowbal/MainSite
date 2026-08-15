'use client';

import { Badge, Button } from '@/shared/ui';
import { SCHOLARSHIP_MATCHES } from '../domain';
import { TaskWorkspaceShell } from './task-workspace-shell';

export function ScholarshipWorkspace({
  onBack,
  onComplete,
}: {
  onBack: () => void;
  onComplete: () => void;
}) {
  return (
    <TaskWorkspaceShell title="Scholarship recommendations" onBack={onBack}>
      <p className="text-gb-md text-fg-tertiary">
        Based on your profile and interests, you may be eligible for the following.
      </p>

      <ul className="flex flex-col gap-gb-lg">
        {SCHOLARSHIP_MATCHES.map((s, i) => (
          <li key={s.id} className="rounded-gb-2xl border border-line bg-surface p-gb-lg">
            <div className="mb-gb-sm flex items-center justify-between gap-gb-md">
              <p className="text-gb-sm font-semibold text-fg">{s.name}</p>
              {i === 0 ? <Badge variant="brand-subtle">Top match</Badge> : null}
            </div>
            <p className="mb-gb-md text-gb-sm text-fg-tertiary">{s.note}</p>
            <div className="flex items-center justify-between gap-gb-md">
              <span className="text-gb-xs text-fg-muted">{s.award}</span>
              <span className="text-gb-sm font-semibold text-fg-brand">{s.matchScore}% match</span>
            </div>
          </li>
        ))}
      </ul>

      <Button
        size="lg"
        onClick={() => {
          onComplete();
          onBack();
        }}
        className="mb-gb-2xl"
      >
        Back to my plan
      </Button>
    </TaskWorkspaceShell>
  );
}
