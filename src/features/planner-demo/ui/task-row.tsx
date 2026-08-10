'use client';

import { motion } from 'framer-motion';
import { Badge, ICONS, KitIcon } from '@/shared/ui';
import type { Task } from '../domain';

/** Keyed on `status` so the moment a row completes, the icon remounts and pops in — spec §18. */
function StatusMark({ status }: { status: Task['status'] }) {
  const content =
    status === 'complete' ? (
      <span className="flex size-[20px] shrink-0 items-center justify-center text-on-tier-safe">
        <KitIcon art={ICONS.checkCircle} frame={20} />
      </span>
    ) : status === 'current' ? (
      <span className="flex size-[20px] shrink-0 items-center justify-center">
        <span className="size-[10px] rounded-gb-full bg-brand" />
      </span>
    ) : (
      <span className="flex size-[20px] shrink-0 items-center justify-center">
        <span className="size-[10px] rounded-gb-full border border-line-strong" />
      </span>
    );

  return (
    <motion.span
      key={status}
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 22 }}
      className="inline-flex"
    >
      {content}
    </motion.span>
  );
}

/**
 * Every row is clickable, including completed ones — reopening a finished
 * task shows its real workspace in review, the way a real product would let
 * you revisit a step rather than only ever seeing it once. `TaskRow` is only
 * ever rendered inside an unlocked phase, so `task.status` here is never
 * `'locked'`.
 */
export function TaskRow({ task, onOpen }: { task: Task; onOpen: (taskId: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(task.id)}
      className="flex w-full items-center gap-gb-lg rounded-gb-lg px-gb-md py-gb-sm text-left transition-colors hover:bg-surface-hover"
    >
      <StatusMark status={task.status} />
      <span
        className={`min-w-0 flex-1 text-gb-md ${
          task.status === 'complete' ? 'text-fg-tertiary line-through decoration-line-strong' : 'text-fg'
        }`}
      >
        {task.title}
      </span>
      {task.status === 'complete' && task.completionNote ? (
        <span className="shrink-0 text-gb-xs font-medium text-on-tier-safe">
          ✨ {task.completionNote}
        </span>
      ) : task.status === 'current' ? (
        <Badge variant="brand-subtle" className="shrink-0">
          Current
        </Badge>
      ) : null}
    </button>
  );
}
