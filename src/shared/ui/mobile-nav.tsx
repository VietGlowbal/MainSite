'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TID, testId } from '@/shared/lib';

/**
 * MobileNav — the mobile header from the redesign, built from Figma node
 * 179:12806 / 179:12826 ("Full-width header navigation", 375x64).
 *
 * It replaces two components: a bottom tab bar and a separate top bar with its
 * own drawer, which rendered stacked on top of each other on every mobile page.
 * The designer confirmed the redesign collapses navigation into this single
 * hamburger, so every destination the two of them carried lands here.
 *
 * Every measurement below is a bound Figma variable, so there are no rounded
 * values to revisit:
 *   header   12 + 40px button + 12          = 64  (--gb-header-mobile)
 *   rows     12 + 20px text-sm line + 12    = 44, 2px apart, 20px list inset
 *   footer   24 top/bottom, two 40px buttons 12px apart
 *   text     Inter 14/20 semibold ("Text sm/Semibold")
 *
 * Deviation, deliberate: the mockup's footer has no language switch. Mobile has
 * no other language control (the switcher lives in the desktop sidebar), so
 * dropping it would strand Vietnamese users; it renders in `utility` above the
 * buttons.
 */

export type MobileNavItem = {
  href: string;
  /** Already-translated label. */
  label: string;
};

export type MobileNavAction = MobileNavItem;

type Props = {
  /** Wordmark, 28px tall in the design. */
  logo: React.ReactNode;
  items: readonly MobileNavItem[];
  /** Filled brand button at the bottom of the panel. */
  primaryAction: MobileNavAction;
  /** Outlined button beneath it — sign in, or the profile link once signed in. */
  secondaryAction: MobileNavAction;
  /** Rendered between the item list and the buttons. Holds the language switch. */
  utility?: React.ReactNode;
  /** Accessible name for the hamburger, translated by the caller. */
  openLabel: string;
  /** Accessible name for the same button once open, translated by the caller. */
  closeLabel: string;
};

function IconMenu() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/**
 * Everything below the header is offset by the header's height plus the notch
 * inset. `--gb-header-mobile` is the single source of that number; the
 * `.glowbal-main-content` rule in globals.css reads the same variable, and
 * tests/e2e/mobile-nav.spec.ts asserts the two agree.
 */
const BELOW_HEADER = 'top-[calc(env(safe-area-inset-top)+var(--gb-header-mobile))]';

const BUTTON =
  'flex h-gb-5xl items-center justify-center rounded-gb-md text-gb-sm font-semibold ' +
  'transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

export function MobileNav({
  logo,
  items,
  primaryAction,
  secondaryAction,
  utility,
  openLabel,
  closeLabel,
}: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Close on navigation. An onClick per link would miss browser back/forward
  // and any programmatic push, so key off the path itself. Adjusting state
  // during render (rather than in an effect) is React's documented way to reset
  // state when an input changes, and avoids the extra committed render.
  const [renderedPath, setRenderedPath] = useState(pathname);
  if (renderedPath !== pathname) {
    setRenderedPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        // The hamburger is also the close button, so focus never left it —
        // but Escape can be pressed while focus sits on a link inside.
        toggleRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <>
      {/* 12px + 40px button + 12px = the 64px in --gb-header-mobile. */}
      <header
        className={`fixed inset-x-0 top-0 z-50 flex items-center justify-between border-b border-line bg-surface px-gb-xl py-gb-lg pt-[calc(env(safe-area-inset-top)+var(--spacing-gb-lg))] md:hidden`}
      >
        {logo}
        <button
          ref={toggleRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-gb-5xl w-gb-5xl items-center justify-center rounded-gb-md text-fg transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          aria-label={open ? closeLabel : openLabel}
          aria-expanded={open}
          aria-haspopup="dialog"
          {...testId(TID.navMobileToggle)}
        >
          {open ? <IconClose /> : <IconMenu />}
        </button>
      </header>

      {open && (
        <>
          {/* Tapping the page behind the panel dismisses it. Invisible, and not
              a tab stop — Escape and the header button are the real controls. */}
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            onClick={() => setOpen(false)}
            className={`fixed inset-x-0 bottom-0 z-40 cursor-default md:hidden ${BELOW_HEADER}`}
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label={openLabel}
            className={`fixed inset-x-0 z-50 max-h-[calc(100dvh-var(--gb-header-mobile))] overflow-y-auto border-b border-line bg-surface shadow-gb-lg md:hidden ${BELOW_HEADER}`}
            {...testId(TID.navMobileSheet)}
          >
            <nav aria-label={openLabel} className="flex flex-col gap-gb-xxs py-gb-2xl">
              {items.map((item) => {
                const active =
                  pathname === item.href || (item.href !== '/' && pathname.startsWith(`${item.href}/`));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`px-gb-xl py-gb-lg text-gb-sm font-semibold transition-colors ${
                      active ? 'text-brand' : 'text-fg hover:bg-surface-hover'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-line px-gb-xl py-gb-3xl pb-[calc(env(safe-area-inset-bottom)+var(--spacing-gb-3xl))]">
              {utility}
              <div className="flex flex-col gap-gb-lg">
                <Link href={primaryAction.href} className={`${BUTTON} bg-brand text-on-brand hover:bg-brand-hover`}>
                  {primaryAction.label}
                </Link>
                <Link
                  href={secondaryAction.href}
                  className={`${BUTTON} border border-line-strong bg-surface text-fg-secondary shadow-gb-xs hover:bg-surface-hover`}
                >
                  {secondaryAction.label}
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
