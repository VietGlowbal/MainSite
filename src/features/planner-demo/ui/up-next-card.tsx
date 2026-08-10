'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/shared/ui';
import type { UpNextCopy } from '../domain';

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * The visual and functional hero of the screen (spec §7). Noticeably more
 * colourful than the rest of the interface but still one tint, not a
 * gradient — spec §17 explicitly asks to avoid "gradients everywhere".
 *
 * The card shell stays put; only its content swaps when the current task
 * changes, keyed on `taskId` — spec §18: "next task softly slides into the
 * Up next card". `MotionConfig reducedMotion="user"` (set once in
 * `planner-demo-app.tsx`) turns this into a plain cross-fade for anyone with
 * reduced-motion on.
 */
export function UpNextCard({
  taskId,
  copy,
  estimatedMinutes,
  onOpen,
}: {
  taskId: string;
  copy: UpNextCopy;
  estimatedMinutes?: number | undefined;
  onOpen: () => void;
}) {
  return (
    <div className="mx-gb-xl overflow-hidden rounded-gb-2xl border border-line bg-brand-subtle p-gb-2xl lg:mx-0 lg:p-gb-3xl">
      <span className="mb-gb-lg inline-flex w-fit items-center gap-gb-xs rounded-gb-full bg-brand px-gb-lg py-gb-xs text-gb-xs font-semibold text-on-brand">
        Up next ✨
      </span>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={taskId}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.32, ease: EASE }}
          className="flex flex-col gap-gb-lg"
        >
          <div className="flex flex-col gap-gb-xs">
            <p className="text-gb-sm font-medium text-fg-brand">{copy.eyebrow}</p>
            <p className="font-display text-gb-display-xs font-semibold tracking-gb-display-tight text-fg lg:text-gb-display-sm">
              {copy.headline}
            </p>
          </div>

          <div className="flex items-center justify-between gap-gb-lg">
            {estimatedMinutes ? (
              <span className="text-gb-xs text-fg-muted">~{estimatedMinutes} min</span>
            ) : (
              <span />
            )}
            <Button onClick={onOpen} size="lg">
              {copy.cta}
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
