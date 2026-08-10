'use client';

import { useState } from 'react';
import { Button, Panel, Textarea } from '@/shared/ui';
import { CV_ENTRY, CV_INTRO, CV_SUGGESTED_LABEL } from '../domain';
import { TaskWorkspaceShell } from './task-workspace-shell';

/**
 * The paid-state adaptive task UI (spec §13–14) — GlowBal already has the
 * reflection evidence, so it drafts the CV entry rather than handing the
 * student a blank form. This is the second (and last) fully-built task type;
 * everything else falls back to the placeholder in task-workspace.tsx.
 */
export function CvWorkspace({
  onClose,
  onComplete,
}: {
  onClose: () => void;
  onComplete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [entry, setEntry] = useState(CV_ENTRY);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <TaskWorkspaceShell title="Your CV" onClose={onClose}>
        <div className="flex flex-1 flex-col items-center justify-center gap-gb-lg py-gb-7xl text-center">
          <p className="font-display text-gb-display-xs font-semibold text-fg">
            Added to your CV ✨
          </p>
          <p className="max-w-[320px] text-gb-md text-fg-tertiary">
            Your air-quality project is now on your Cambridge Engineering CV.
          </p>
          <Button size="lg" onClick={onClose} className="mt-gb-lg">
            Back to my plan
          </Button>
        </div>
      </TaskWorkspaceShell>
    );
  }

  return (
    <TaskWorkspaceShell title="Your CV" onClose={onClose}>
      <p className="text-gb-md text-fg-tertiary">{CV_INTRO}</p>

      <Panel padding="sm" elevation="flat" className="bg-brand-subtle">
        <p className="mb-gb-md text-gb-xs font-semibold text-fg-brand">{CV_SUGGESTED_LABEL}</p>
        {editing ? (
          <Textarea
            name="cv-entry"
            rows={5}
            value={entry}
            onChange={(e) => setEntry(e.target.value)}
          />
        ) : (
          <p className="text-gb-sm text-fg">{entry}</p>
        )}
      </Panel>

      <div className="flex gap-gb-lg">
        {editing ? (
          <Button
            size="lg"
            onClick={() => {
              onComplete();
              setDone(true);
            }}
          >
            Save entry
          </Button>
        ) : (
          <>
            <Button
              size="lg"
              onClick={() => {
                onComplete();
                setDone(true);
              }}
            >
              Use this
            </Button>
            <Button variant="secondary" size="lg" onClick={() => setEditing(true)}>
              Edit
            </Button>
          </>
        )}
      </div>
    </TaskWorkspaceShell>
  );
}
