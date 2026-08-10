'use client';

import { useState } from 'react';
import { Badge, Button, ICONS, KitIcon } from '@/shared/ui';
import type { Phase } from '../domain';
import { PAYWALL_CTA, PAYWALL_UNLOCK_LABEL, PHASE1_ENCOURAGEMENT } from '../domain';
import { TaskRow } from './task-row';

const VISIBLE_TASKS = 3;

function PhaseNumberBadge({ phase }: { phase: Phase }) {
  if (phase.status === 'complete') {
    return (
      <span className="flex size-[28px] shrink-0 items-center justify-center rounded-gb-full bg-tier-safe text-on-tier-safe">
        <KitIcon art={ICONS.checkCircle} frame={20} />
      </span>
    );
  }
  if (phase.status === 'locked') {
    return (
      <span className="flex size-[28px] shrink-0 items-center justify-center rounded-gb-full bg-surface-muted text-gb-xs text-fg-muted">
        🔒
      </span>
    );
  }
  return (
    <span className="flex size-[28px] shrink-0 items-center justify-center rounded-gb-full bg-brand text-gb-xs font-semibold text-on-brand">
      {phase.number}
    </span>
  );
}

export function PhaseAccordion({
  phase,
  defaultExpanded = false,
  paywallReady = false,
  onOpenTask,
  onUnlock,
}: {
  phase: Phase;
  defaultExpanded?: boolean;
  /** True when Phase 1 is complete and this locked phase has a "ready" teaser (spec §11). */
  paywallReady?: boolean;
  onOpenTask: (taskId: string) => void;
  onUnlock: () => void;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showAllTasks, setShowAllTasks] = useState(false);

  const visibleTasks = showAllTasks ? phase.tasks : phase.tasks.slice(0, VISIBLE_TASKS);
  const hiddenCount = phase.tasks.length - visibleTasks.length;

  const ready = paywallReady && phase.teaser?.unlockedBody !== undefined;
  const teaserBody = ready ? phase.teaser?.unlockedBody : phase.teaser?.body;

  return (
    <div className="overflow-hidden rounded-gb-2xl border border-line bg-surface">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
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

      {expanded && phase.status === 'locked' ? (
        <div className="flex flex-col gap-gb-lg border-t border-line px-gb-xl py-gb-lg">
          <p className="text-gb-sm text-fg-tertiary">{teaserBody}</p>
          {ready ? (
            <div className="flex flex-col items-start gap-gb-lg">
              <Badge variant="reach">{PAYWALL_UNLOCK_LABEL}</Badge>
              <Button onClick={onUnlock}>{PAYWALL_CTA}</Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {expanded && phase.status !== 'locked' ? (
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
      ) : null}
    </div>
  );
}
