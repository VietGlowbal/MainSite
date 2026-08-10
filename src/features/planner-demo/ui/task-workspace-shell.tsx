'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { ICONS, KitIcon } from '@/shared/ui';

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Shared shell for a full-screen task step (spec §7: "I prefer full-screen
 * mobile step"). Mounted/unmounted by the caller inside an `AnimatePresence`
 * (see `planner-demo-app.tsx`), so this only owns its own enter/exit motion —
 * not whether it exists.
 *
 * Mobile: a full-bleed sheet, matching the original mobile-first spec.
 * Desktop (`lg:`): a centred elevated panel over a scrim, closer to how a
 * real desktop product opens a focused task — chosen over a permanent
 * split-pane so the "elevated single column" plan/task relationship stays
 * the same shape at both sizes.
 *
 * Positioning is plain flexbox centring on the `lg:` wrapper rather than
 * `top/left-1/2 + -translate-1/2`, because Framer Motion's own `animate`
 * writes an inline `transform` that would silently clobber a Tailwind
 * translate utility on the same element.
 */
export function TaskWorkspaceShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <>
      <motion.div
        aria-hidden="true"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-40 bg-scrim"
      />
      <div className="fixed inset-0 z-50 overflow-y-auto lg:flex lg:items-center lg:justify-center lg:overflow-hidden lg:p-gb-4xl">
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          transition={{ duration: 0.3, ease: EASE }}
          className="flex min-h-full w-full flex-col bg-surface lg:h-[85vh] lg:max-h-[46rem] lg:min-h-0 lg:max-w-2xl lg:overflow-y-auto lg:rounded-gb-2xl lg:border lg:border-line lg:shadow-gb-lg"
        >
          <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col pb-gb-9xl lg:max-w-none lg:px-gb-4xl">
            <header className="flex items-center gap-gb-sm px-gb-xl pb-gb-lg pt-gb-xl lg:px-0">
              <button
                type="button"
                onClick={onClose}
                aria-label="Back to your plan"
                className="flex size-[28px] shrink-0 items-center justify-center rounded-gb-full text-fg-brand transition-colors hover:bg-brand-subtle"
              >
                <KitIcon art={ICONS.arrowLeft} frame={20} />
              </button>
              <span className="truncate text-gb-sm font-semibold text-fg-brand">{title}</span>
            </header>
            <div className="flex flex-1 flex-col gap-gb-2xl px-gb-xl lg:px-0">{children}</div>
          </div>
        </motion.div>
      </div>
    </>
  );
}
