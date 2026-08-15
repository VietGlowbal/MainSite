'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button, Panel, Textarea } from '@/shared/ui';
import { STATEMENT_SUGGESTION } from '../domain';
import { TaskWorkspaceShell } from './task-workspace-shell';

/** Same adaptive-suggestion pattern as CvWorkspace, applied to the personal statement opening. */
export function StatementWorkspace({
  onBack,
  onComplete,
}: {
  onBack: () => void;
  onComplete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(STATEMENT_SUGGESTION);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <TaskWorkspaceShell title="Your personal statement" onBack={onBack}>
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          className="flex flex-1 flex-col items-center justify-center gap-gb-lg py-gb-7xl text-center"
        >
          <p className="font-display text-gb-display-xs font-semibold text-fg">
            Opening paragraph saved ✨
          </p>
          <p className="max-w-[320px] text-gb-md text-fg-tertiary">
            Let&rsquo;s make that experience impossible to miss — we&rsquo;ll build the rest around it.
          </p>
          <Button size="lg" onClick={onBack} className="mt-gb-lg">
            Back to my plan
          </Button>
        </motion.div>
      </TaskWorkspaceShell>
    );
  }

  return (
    <TaskWorkspaceShell title="Your personal statement" onBack={onBack}>
      <p className="text-gb-md text-fg-tertiary">
        Your air-quality project is the strongest opening we&rsquo;ve got. Here&rsquo;s a first draft.
      </p>

      <Panel padding="sm" elevation="flat" className="bg-brand-subtle">
        <p className="mb-gb-md text-gb-xs font-semibold text-fg-brand">Suggested opening</p>
        {editing ? (
          <Textarea name="statement-opening" rows={6} value={text} onChange={(e) => setText(e.target.value)} />
        ) : (
          <p className="text-gb-sm text-fg">{text}</p>
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
            Save opening
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
