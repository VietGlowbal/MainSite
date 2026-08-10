'use client';

import { useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { flattenGuide, STRATEGY_GUIDE, stepIndexForPath } from '../domain/strategy-guide';
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
 * Suppressed on auth, admin, coordinator, onboarding and the dev/demo canvases
 * — none of which is the student journey this explains — and on `/ai-strategy`
 * exactly, since that route IS the walkthrough and a help button there would
 * open the page already on screen.
 *
 * ⚠️ `/ai-strategy` IS AN EXACT MATCH, NOT A PREFIX (02/08, owner). It was a
 * prefix, which silently took the button off the most actionable screens in
 * the product: the reflection questions, the achievements form, the two AI
 * reports and the whole improvement dashboard all sit under `/ai-strategy/`.
 * Area 3 of the guide describes those screens step by step, and `PATH_TO_STEP`
 * has always had entries for them — the popup was simply never mounted there
 * to use them. Everything under the prefix now gets it; only the explainer
 * itself does not.
 */

/** Route prefixes that get no help button, matching the path or any child. */
const SUPPRESSED_PREFIXES = [
  '/auth',
  '/admin',
  '/coordinator',
  '/dev',
  '/demo-throwaway',
  '/demo',
  '/onboarding',
];

/**
 * Routes that get no help button, matched exactly — children still do.
 *
 * Both entries are the walkthrough itself, split in two on 03/08:
 * `/how-it-works` renders all three stages and `/ai-strategy` renders stage 3.
 * A help button on either would open a popup over the page it came from.
 */
const SUPPRESSED_EXACT = ['/ai-strategy', '/how-it-works'];

function isSuppressed(pathname: string): boolean {
  if (SUPPRESSED_EXACT.includes(pathname)) return true;
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
        {/* A DEFINITE height, not `max-h`: `GuidePanel` is `h-full` and its
            step column is `min-h-0 overflow-y-auto`, both of which need a
            parent height to resolve against. With an auto height the column
            would grow instead of scrolling and push Previous/Next out of the
            dialog on a short viewport. */}
        <div className="flex h-[min(88vh,46rem)] flex-col">
          <div className="flex shrink-0 items-start justify-between gap-gb-lg px-gb-3xl pt-gb-3xl">
            <div className="flex flex-col">
              <p className="text-gb-sm font-semibold text-fg">How GlowBal works</p>
              <p className="text-gb-xs text-fg-muted">
                Step {activeIndex + 1} of {flat.length}
              </p>
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
            {/* `-mx-gb-3xl` cancels this block's own padding for the one
                element that wants the dialog's full width: the rule under the
                area cards. See `bleedClassName` on GuidePanel. */}
            <GuidePanel
              flat={flat}
              activeIndex={activeIndex}
              onSelect={setActiveIndex}
              bleedClassName="-mx-gb-3xl"
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
