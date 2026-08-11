'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/shared/ui';
import type { UpNextCopy } from '../domain';

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * "Next task" — compact and sticky in the left column (spec §8), not the
 * screen-spanning hero it used to be. GlowBal always knows what you should
 * do next; this card is where that shows up, nothing more.
 */
export function UpNextCard({
  taskId,
  copy,
  onOpen,
}: {
  taskId: string;
  copy: UpNextCopy;
  onOpen: () => void;
}) {
  return (
    <div className="rounded-gb-2xl border border-line bg-surface p-gb-xl lg:sticky lg:top-gb-7xl">
      <p className="mb-gb-md text-gb-xs font-semibold text-fg-brand">Next task</p>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={taskId}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.28, ease: EASE }}
          className="flex items-center gap-gb-lg"
        >
          <span className="flex size-[44px] shrink-0 items-center justify-center rounded-gb-full bg-brand-subtle text-gb-lg">
            ✨
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-gb-xxs">
            <p className="truncate text-gb-sm font-semibold text-fg">{copy.headline}</p>
            <p className="truncate text-gb-xs text-fg-tertiary">{copy.eyebrow}</p>
          </div>
        </motion.div>
      </AnimatePresence>
      <Button onClick={onOpen} size="sm" className="mt-gb-lg w-full">
        {copy.cta}
      </Button>
    </div>
  );
}
