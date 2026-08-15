'use client';

import { Button, ICONS, KitIcon } from '@/shared/ui';
import { DOCUMENT_CHECKLIST } from '../domain';
import { TaskWorkspaceShell } from './task-workspace-shell';

export function DocumentReviewWorkspace({
  onBack,
  onComplete,
}: {
  onBack: () => void;
  onComplete: () => void;
}) {
  const missing = DOCUMENT_CHECKLIST.filter((d) => !d.ready);

  return (
    <TaskWorkspaceShell title="Supporting documents" onBack={onBack}>
      <p className="text-gb-md text-fg-tertiary">
        {missing.length > 0
          ? `${missing.length} document${missing.length === 1 ? '' : 's'} still need attention.`
          : 'Everything is in place.'}
      </p>

      <ul className="flex flex-col gap-gb-md">
        {DOCUMENT_CHECKLIST.map((doc) => (
          <li
            key={doc.id}
            className="flex items-center gap-gb-lg rounded-gb-xl border border-line bg-surface p-gb-lg"
          >
            <span
              className={`flex size-[20px] shrink-0 items-center justify-center ${
                doc.ready ? 'text-on-tier-safe' : 'text-fg-muted'
              }`}
            >
              {doc.ready ? <KitIcon art={ICONS.checkCircle} frame={20} /> : '!'}
            </span>
            <span className="text-gb-sm text-fg">{doc.label}</span>
            <span className="ml-auto shrink-0 text-gb-xs text-fg-muted">
              {doc.ready ? 'Ready' : 'Missing'}
            </span>
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
