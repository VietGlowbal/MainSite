'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  flattenGuide,
  STRATEGY_GUIDE,
  stepIndexForPath,
} from '../domain/strategy-guide';
import { GuidePanel } from './strategy-guide';
import { ICONS, KitIcon, Modal } from '@/shared/ui';

/**
 * The floating "?" — the whole GlowBal walkthrough, from wherever the student
 * currently is, without losing the page they were on.
 *
 * ─── IT OPENS WHERE THEY ARE, NOT AT THE BEGINNING ───────────────────────────
 *
 * `stepIndexForPath` (../domain/strategy-guide.ts) maps the current pathname
 * to the most relevant step, so pressing "?" on the subject picker opens at
 * "Choose your subject" rather than at 1.1. That is the entire point of this
 * being a popup rather than a link to /ai-strategy: a student stuck on one
 * screen wants the paragraph about THAT screen, and a link would both lose
 * their place and start them at the top of a fourteen-step page.
 *
 * The step is re-derived whenever the popup opens rather than tracked
 * continuously, so navigating around with it closed does not cost anything,
 * and re-opening after moving pages lands on the new page's step.
 *
 * ─── IT REUSES THE PAGE'S PANEL, IT DOES NOT COPY IT ─────────────────────────
 *
 * `GuidePanel` is shared with /ai-strategy — same header, same clip, same step
 * list, same content file behind it. Only the driver differs: the page picks
 * the step from scroll position, this picks it from clicks. Copying the markup
 * here would have guaranteed the popup and the page eventually disagreed about
 * what the product does, which is the exact failure this content already had
 * once (see the header of ../domain/strategy-guide.ts).
 *
 * No `progressRef` is passed: within-step scroll progress is a property of the
 * scrolling page, and a bar measuring nothing is worse than no bar.
 *
 * ─── WHERE IT DOES NOT APPEAR ────────────────────────────────────────────────
 *
 * Suppressed on `/ai-strategy` itself (a help button that opens the page you
 * are already reading), and on auth, admin, coordinator and the dev/demo
 * canvases — none of which are the student journey this explains. Everything
 * else gets it, which is what "on whatever page you're on" asks for.
 */

/** Route prefixes that get no help button. See the header. */
const SUPPRESSED_PREFIXES = [
  '/ai-strategy',
  '/auth',
  '/admin',
  '/coordinator',
  '/dev',
  '/demo-throwaway',
  '/onboarding',
];

function isSuppressed(pathname: string): boolean {
  return SUPPRESSED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function StrategyHelpButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const flat = useMemo(() => flattenGuide(STRATEGY_GUIDE), []);

  /* The entry step is derived when it OPENS, not in an effect watching `open`.
     Same result — it follows the student around instead of remembering where
     they were three pages ago — without the render-then-correct pass that
     setting state from an effect costs. */
  function openAtCurrentPage() {
    setActiveIndex(stepIndexForPath(pathname));
    setOpen(true);
  }

  if (isSuppressed(pathname)) return null;

  const active = flat[activeIndex] ?? flat[0];

  return (
    <>
      <button
        type="button"
        onClick={openAtCurrentPage}
        aria-label="How GlowBal works"
        title="How GlowBal works"
        className="fixed bottom-gb-3xl right-gb-3xl z-40 flex size-gb-7xl items-center justify-center rounded-gb-full bg-brand text-white shadow-gb-lg transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none motion-reduce:hover:scale-100"
      >
        <span aria-hidden="true" className="font-display text-gb-xl font-semibold">
          ?
        </span>
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        label="How GlowBal works"
        className="max-w-[72rem] p-0"
      >
        <div className="flex h-[min(80vh,44rem)] flex-col">
          <div className="flex shrink-0 items-center justify-between gap-gb-lg border-b border-line px-gb-3xl py-gb-xl">
            <div className="flex flex-col">
              <p className="text-gb-sm font-semibold text-fg">How GlowBal works</p>
              <p className="text-gb-xs text-fg-muted">
                Step {activeIndex + 1} of {flat.length}
              </p>
            </div>

            {/* Area jump. Lands on each area's first step, so a student can get
                to a different stage without stepping through the one they are
                in. */}
            <div className="hidden items-center gap-gb-xs sm:flex">
              {STRATEGY_GUIDE.map((area) => {
                const firstIndex = flat.findIndex((entry) => entry.area.id === area.id);
                const isCurrent = active?.area.id === area.id;
                return (
                  <button
                    key={area.id}
                    type="button"
                    onClick={() => setActiveIndex(firstIndex)}
                    aria-current={isCurrent ? 'true' : undefined}
                    className={`rounded-gb-md px-gb-lg py-gb-sm text-gb-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                      isCurrent
                        ? 'bg-brand-subtle text-fg-brand'
                        : 'text-fg-muted hover:bg-surface-muted hover:text-fg-secondary'
                    }`}
                  >
                    {area.number}. {area.title}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="inline-flex size-gb-5xl shrink-0 items-center justify-center rounded-gb-full text-fg-secondary transition-colors hover:bg-surface-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <KitIcon art={ICONS.close} frame={20} />
            </button>
          </div>

          <div className="min-h-0 flex-1 p-gb-3xl">
            <GuidePanel flat={flat} activeIndex={activeIndex} onSelect={setActiveIndex} />
          </div>

          <div className="flex shrink-0 items-center justify-between gap-gb-lg border-t border-line px-gb-3xl py-gb-xl">
            <button
              type="button"
              onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
              disabled={activeIndex === 0}
              className="inline-flex items-center gap-gb-md rounded-gb-md px-gb-lg py-gb-sm text-gb-sm font-semibold text-fg-secondary transition-colors hover:bg-surface-muted disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <KitIcon art={ICONS.arrowLeft} frame={20} />
              Previous
            </button>
            <Link
              href="/ai-strategy"
              className="text-gb-sm font-medium text-fg-muted underline-offset-4 hover:text-fg-secondary hover:underline"
            >
              Open the full guide
            </Link>
            <button
              type="button"
              onClick={() => setActiveIndex((i) => Math.min(flat.length - 1, i + 1))}
              disabled={activeIndex === flat.length - 1}
              className="inline-flex items-center gap-gb-md rounded-gb-md px-gb-lg py-gb-sm text-gb-sm font-semibold text-fg-secondary transition-colors hover:bg-surface-muted disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              Next
              <KitIcon art={ICONS.arrowRight} frame={20} />
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
