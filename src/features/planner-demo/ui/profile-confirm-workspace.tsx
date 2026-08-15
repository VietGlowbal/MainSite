'use client';

import { Button } from '@/shared/ui';
import { TaskWorkspaceShell } from './task-workspace-shell';

/**
 * The one task with no GenUI moment (spec §10's "Confirm academic profile")
 * — it's always complete from the start of the demo, so this only renders
 * when a presenter reopens it to review.
 */
export function ProfileConfirmWorkspace({ onBack }: { onBack: () => void }) {
  return (
    <TaskWorkspaceShell title="Academic profile" onBack={onBack}>
      <p className="text-gb-md text-fg-tertiary">
        Grade 12 · Predicted A*A*A · IELTS Academic 7.5. Confirmed from your GlowBal profile.
      </p>
      <Button size="lg" onClick={onBack} className="mb-gb-2xl w-fit">
        Back to my plan
      </Button>
    </TaskWorkspaceShell>
  );
}
