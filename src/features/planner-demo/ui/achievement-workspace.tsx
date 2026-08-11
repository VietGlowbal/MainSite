'use client';

import { useState } from 'react';
import { Button, Input } from '@/shared/ui';
import { DEMO_ACHIEVEMENTS } from '../domain';
import { TaskWorkspaceShell } from './task-workspace-shell';

/** Add achievements — a short add-and-list form, deliberately lighter than the reflection task. */
export function AchievementWorkspace({
  onBack,
  onComplete,
}: {
  onBack: () => void;
  onComplete: () => void;
}) {
  const [entries, setEntries] = useState(DEMO_ACHIEVEMENTS);
  const [draft, setDraft] = useState('');

  function addDraft() {
    const title = draft.trim();
    if (!title) return;
    setEntries((prev) => [...prev, { id: `ach-custom-${prev.length}`, title, category: 'Other', year: '2026' }]);
    setDraft('');
  }

  return (
    <TaskWorkspaceShell title="Add achievements" onBack={onBack}>
      <p className="text-gb-md text-fg-tertiary">
        Academic, extracurricular or personal achievements — anything you&rsquo;re proud of counts.
      </p>

      <ul className="flex flex-col gap-gb-md">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="flex items-center justify-between gap-gb-md rounded-gb-xl border border-line bg-surface p-gb-lg"
          >
            <span className="text-gb-sm text-fg">{entry.title}</span>
            <span className="shrink-0 text-gb-xs text-fg-muted">
              {entry.category} · {entry.year}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex gap-gb-md">
        <Input
          name="new-achievement"
          placeholder="Add another achievement…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          fieldClassName="flex-1"
        />
        <Button variant="secondary" onClick={addDraft}>
          Add
        </Button>
      </div>

      <Button
        size="lg"
        onClick={() => {
          onComplete();
          onBack();
        }}
        className="mb-gb-2xl"
      >
        Save achievements
      </Button>
    </TaskWorkspaceShell>
  );
}
