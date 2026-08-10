'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Badge, Button, ICONS, KitIcon } from '@/shared/ui';
import type { Phase } from '../domain';
import { PAYWALL_CTA, PAYWALL_UNLOCK_LABEL, PHASE1_ENCOURAGEMENT } from '../domain';
import { TaskRow } from './task-row';

const VISIBLE_TASKS = 3;
const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Keyed on `phase.status` so switching demo states — the only way a phase's
 * lock state changes — remounts this and plays the pop-in. Spec §18: "lock
 * opens when phase unlocks".
 */
function PhaseNumberBadge({ phase }: { phase: Phase }) {
  const content =
    phase.status === 'complete' ? (
      <span className="flex size-[28px] shrink-0 items-center justify-center rounded-gb-full bg-tier-safe text-on-tier-safe">
        <KitIcon art={ICONS.checkCircle} frame={20} />
      </span>
    ) : phase.status === 'locked' ? (
      <span className="flex size-[28px] shrink-0 items-center justify-center rounded-gb-full bg-surface-muted text-gb-xs text-fg-muted">
        🔒
      </span>
    ) : (
      <span className="flex size-[28px] shrink-0 items-center justify-center rounded-gb-full bg-brand text-gb-xs font-semibold text-on-brand">
        {phase.number}
      </span>
    );

  return (
    <motion.span
      key={phase.status}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      className="inline-flex"
    >
      {content}
    </motion.span>
  );
}

export function PhaseAccordion({
  phase,
  expanded,
  onToggle,
  paywallReady = false,
  onOpenTask,
  onUnlock,
}: {
  phase: Phase;
  expanded: boolean;
  onToggle: () => void;
  /** True when Phase 1 is complete and this locked phase has a "ready" teaser (spec §11). */
  paywallReady?: boolean;
  onOpenTask: (taskId: string) => void;
  onUnlock: () => void;
}) {
  const [showAllTasks, setShowAllTasks] = useState(false);

  const visibleTasks = showAllTasks ? phase.tasks : phase.tasks.slice(0, VISIBLE_TASKS);
  const hiddenCount = phase.tasks.length - visibleTasks.length;

  const ready = paywallReady && phase.teaser?.unlockedBody !== undefined;
  const teaserBody = ready ? phase.teaser?.unlockedBody : phase.teaser?.body;

  return (
    <div
      id={phase.id}
      className="scroll-mt-gb-7xl overflow-hidden rounded-gb-2xl border border-line bg-surface"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-gb-lg px-gb-xl py-gb-lg text-left transition-colors hover:bg-surface-hover"
      >
        <PhaseNumberBadge phase={phase} />
        <span className="min-w-0 flex-1 text-gb-md">
          <span className={phase.status === 'locked' ? 'text-fg-muted' : 'text-fg-tertiary'}>
            Phase {phase.number}
          </span>{' '}
          <span
            className={`font-semibold ${phase.status === 'locked' ? 'text-fg-muted' : 'text-fg-brand'}`}
          >
            {phase.title}
          </span>
        </span>
        <span
          className={`shrink-0 text-fg-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
        >
          <KitIcon art={ICONS.chevronDown} frame={16} />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="overflow-hidden"
          >
            {phase.status === 'locked' ? (
              <div className="flex flex-col gap-gb-lg border-t border-line px-gb-xl py-gb-lg">
                <p className="text-gb-sm text-fg-tertiary">{teaserBody}</p>
                {ready ? (
                  <div className="flex flex-col items-start gap-gb-lg">
                    <Badge variant="reach">{PAYWALL_UNLOCK_LABEL}</Badge>
                    <Button onClick={onUnlock}>{PAYWALL_CTA}</Button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-col gap-gb-xs border-t border-line px-gb-lg py-gb-lg">
                {visibleTasks.map((task) => (
                  <TaskRow key={task.id} task={task} onOpen={onOpenTask} />
                ))}
                {hiddenCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => setShowAllTasks(true)}
                    className="px-gb-md py-gb-sm text-left text-gb-sm font-medium text-fg-brand hover:underline"
                  >
                    Show {hiddenCount} more
                  </button>
                ) : null}
                {phase.id === 'phase-1' && phase.status === 'active' ? (
                  <p className="mt-gb-md rounded-gb-lg bg-surface-muted px-gb-lg py-gb-md text-center text-gb-sm text-fg-tertiary">
                    💛 {PHASE1_ENCOURAGEMENT}
                  </p>
                ) : null}
              </div>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
