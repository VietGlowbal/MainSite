'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button, Textarea } from '@/shared/ui';
import { DEMO_REFLECTION_ANSWERS, type ReflectionAnswers } from '../domain';
import { REFLECTION_SUCCESS_BODY, REFLECTION_SUCCESS_TITLE } from '../domain';
import { TaskWorkspaceShell } from './task-workspace-shell';

const EMPTY: ReflectionAnswers = { built: '', owned: '', difficult: '' };

/** The reflection task workspace (spec §8) — the one fully-built task type. */
export function ReflectionWorkspace({
  onClose,
  onComplete,
}: {
  onClose: () => void;
  onComplete: (answers: ReflectionAnswers) => void;
}) {
  const [answers, setAnswers] = useState<ReflectionAnswers>(EMPTY);
  const [submitted, setSubmitted] = useState(false);

  const canSave = answers.built.trim() && answers.owned.trim() && answers.difficult.trim();

  if (submitted) {
    return (
      <TaskWorkspaceShell title="Your strongest project" onClose={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          className="flex flex-1 flex-col items-center justify-center gap-gb-lg py-gb-7xl text-center"
        >
          <p className="font-display text-gb-display-xs font-semibold text-fg">
            {REFLECTION_SUCCESS_TITLE}
          </p>
          <p className="max-w-[320px] text-gb-md text-fg-tertiary">{REFLECTION_SUCCESS_BODY}</p>
          <Button size="lg" onClick={onClose} className="mt-gb-lg">
            Back to my plan
          </Button>
        </motion.div>
      </TaskWorkspaceShell>
    );
  }

  return (
    <TaskWorkspaceShell title="Your strongest project" onClose={onClose}>
      <div className="flex flex-col gap-gb-xs">
        <p className="text-gb-md text-fg-tertiary">
          Tell me about something you built that you&rsquo;re genuinely proud of.
        </p>
        <button
          type="button"
          onClick={() => setAnswers(DEMO_REFLECTION_ANSWERS)}
          className="w-fit text-gb-sm font-medium text-fg-brand hover:underline"
        >
          Use demo answers →
        </button>
      </div>

      <Textarea
        name="built"
        label="What did you build?"
        rows={3}
        value={answers.built}
        onChange={(e) => setAnswers((a) => ({ ...a, built: e.target.value }))}
      />
      <Textarea
        name="owned"
        label="What part did you personally own?"
        rows={3}
        value={answers.owned}
        onChange={(e) => setAnswers((a) => ({ ...a, owned: e.target.value }))}
      />
      <Textarea
        name="difficult"
        label="What was difficult about it?"
        rows={3}
        value={answers.difficult}
        onChange={(e) => setAnswers((a) => ({ ...a, difficult: e.target.value }))}
      />

      <Button
        size="lg"
        disabled={!canSave}
        onClick={() => {
          onComplete(answers);
          setSubmitted(true);
        }}
        className="mb-gb-2xl"
      >
        Save reflection
      </Button>
    </TaskWorkspaceShell>
  );
}
