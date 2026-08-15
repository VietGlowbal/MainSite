'use client';

import { motion } from 'framer-motion';
import { Badge, ICONS, KitIcon } from '@/shared/ui';
import type { Task } from '../domain';

const STATUS_LABEL: Partial<Record<Task['status'], string>> = {
  in_progress: 'In progress',
  recommended: 'Recommended',
  needs_attention: 'Needs attention',
};

/** Keyed on `status` so the moment a row completes, the icon remounts and pops in — spec §16. */
function StatusMark({ status }: { status: Task['status'] }) {
  const content =
    status === 'complete' ? (
      <span className="flex size-[20px] shrink-0 items-center justify-center text-on-tier-safe">
        <KitIcon art={ICONS.checkCircle} frame={20} />
      </span>
    ) : status === 'needs_attention' ? (
      <span className="flex size-[20px] shrink-0 items-center justify-center text-gb-sm font-bold text-fg-error">
        !
      </span>
    ) : status === 'in_progress' || status === 'recommended' ? (
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
 * Every row (in an unlocked phase) is clickable, including completed ones —
 * reopening a finished task shows its real workspace in review. `selected`
 * highlights the row currently shown in the workspace panel.
 */
export function TaskRow({
  task,
  selected,
  onSelect,
}: {
  task: Task;
  selected: boolean;
  onSelect: (taskId: string) => void;
}) {
  const badgeLabel = STATUS_LABEL[task.status];

  return (
    <button
      type="button"
      onClick={() => onSelect(task.id)}
      aria-current={selected ? 'true' : undefined}
      className={`flex w-full items-center gap-gb-lg rounded-gb-lg px-gb-md py-gb-sm text-left transition-colors ${
        selected ? 'bg-brand-subtle' : 'hover:bg-surface-hover'
      }`}
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
      ) : badgeLabel ? (
        <Badge variant={task.status === 'needs_attention' ? 'neutral' : 'brand-subtle'} className="shrink-0">
          {badgeLabel}
        </Badge>
      ) : null}
    </button>
  );
}
