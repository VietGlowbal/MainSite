'use client';

import { Button } from '@/shared/ui';
import { ENTRY_REQUIREMENTS } from '../domain';
import { TaskWorkspaceShell } from './task-workspace-shell';

/** Static reference content, not AI-extracted — no confidence badge needed. */
export function RequirementsWorkspace({
  onClose,
  onComplete,
}: {
  onClose: () => void;
  onComplete: () => void;
}) {
  return (
    <TaskWorkspaceShell title="Engineering requirements" onClose={onClose}>
      <p className="text-gb-md text-fg-tertiary">
        Here&rsquo;s what Cambridge Engineering asks for, so nothing catches you off guard later.
      </p>

      <ul className="flex flex-col gap-gb-lg">
        {ENTRY_REQUIREMENTS.map((req) => (
          <li
            key={req.label}
            className="flex flex-col gap-gb-xxs rounded-gb-xl border border-line bg-surface p-gb-lg"
          >
            <span className="text-gb-xs font-semibold text-fg-brand">{req.label}</span>
            <span className="text-gb-sm text-fg">{req.detail}</span>
          </li>
        ))}
      </ul>

      <p className="text-gb-xs text-fg-muted">
        Always confirm the exact figures on Cambridge&rsquo;s own admissions site — requirements can
        change year to year.
      </p>

      <Button
        size="lg"
        onClick={() => {
          onComplete();
          onClose();
        }}
        className="mb-gb-2xl"
      >
        Got it — mark as reviewed
      </Button>
    </TaskWorkspaceShell>
  );
}
