'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TID, testId } from '@/shared/lib';

/**
 * MobileNav — the mobile header from the redesign: a fixed bar carrying the
 * wordmark and a hamburger, which opens a full-screen sheet holding every
 * destination plus the two call-to-action buttons.
 *
 * It replaces two separate bars. The old build shipped a bottom tab bar AND a
 * top bar with its own drawer, stacked on top of each other on every mobile
 * page; the designer has confirmed the redesign collapses the whole navigation
 * into this one hamburger.
 *
 * Deviations from the mockup, both deliberate:
 *  - Rows and buttons are 48px, where the mock measures ~43px and ~44px. The
 *    spacing scale extracted from Figma has no 10px step, and 48px is also the
 *    minimum comfortable tap target. Revisit if the designer publishes the
 *    frame as a real Figma node with bound variables.
 *  - The mockup's footer has no language switch. Mobile has no other language
 *    control (the switcher lives in the desktop sidebar), so dropping it would
 *    strand Vietnamese users; it renders in `utility` above the buttons.
 */

export type MobileNavItem = {
  href: string;
  /** Already-translated label. */
  label: string;
};

export type MobileNavAction = MobileNavItem;

type Props = {
  /** Wordmark. Rendered in both the collapsed bar and the open sheet. */
  logo: React.ReactNode;
  items: readonly MobileNavItem[];
  /** Filled brand button at the bottom of the sheet. */
  primaryAction: MobileNavAction;
  /** Outlined button beneath it — sign in, or the profile link once signed in. */
  secondaryAction: MobileNavAction;
  /** Rendered between the item list and the buttons. Holds the language switch. */
  utility?: React.ReactNode;
  /** Accessible name for the hamburger, translated by the caller. */
  openLabel: string;
  /** Accessible name for the close button, translated by the caller. */
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
 * Bar height = 12px + 48px + 12px = 72px, set by the icon button rather than
 * the 28px wordmark. Keep this in step with the `.glowbal-main-content`
 * padding-top in globals.css: the bar is fixed, so page content is offset by
 * exactly this much.
 */
const BAR = 'flex items-center justify-between px-gb-xl py-gb-lg';

const ICON_BUTTON =
  'inline-flex h-gb-6xl w-gb-6xl items-center justify-center rounded-gb-md text-fg ' +
  'transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

const BUTTON =
  'flex h-gb-6xl items-center justify-center rounded-gb-md text-gb-md font-semibold ' +
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
  const closeRef = useRef<HTMLButtonElement>(null);

  // Close on navigation. An onClick per link would miss browser back/forward
  // and any programmatic push, so key off the path itself. Adjusting state
  // during render (rather than in an effect) is React's documented way to reset
  // state when an input changes, and avoids the extra committed render.
  const [renderedPath, setRenderedPath] = useState(pathname);
  if (renderedPath !== pathname) {
    setRenderedPath(pathname);
    setOpen(false);
  }

  /** Close by an explicit user action — hand focus back to the hamburger. */
  function dismiss() {
    setOpen(false);
    toggleRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
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
      <header
        className={`fixed inset-x-0 top-0 z-50 border-b border-line bg-surface md:hidden ${BAR}`}
      >
        {logo}
        <button
          ref={toggleRef}
          type="button"
          onClick={() => setOpen(true)}
          className={ICON_BUTTON}
          aria-label={openLabel}
          aria-expanded={open}
          aria-haspopup="dialog"
          {...testId(TID.navMobileToggle)}
        >
          <IconMenu />
        </button>
      </header>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={openLabel}
          className="fixed inset-0 z-50 flex flex-col bg-surface md:hidden"
          {...testId(TID.navMobileSheet)}
        >
          <div className={`shrink-0 border-b border-line ${BAR}`}>
            {logo}
            <button ref={closeRef} type="button" onClick={dismiss} className={ICON_BUTTON} aria-label={closeLabel}>
              <IconClose />
            </button>
          </div>

          <nav aria-label={openLabel} className="flex-1 overflow-y-auto py-gb-lg">
            {items.map((item) => {
              const active =
                pathname === item.href || (item.href !== '/' && pathname.startsWith(`${item.href}/`));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex h-gb-6xl items-center px-gb-xl text-gb-md font-semibold transition-colors ${
                    active ? 'text-brand' : 'text-fg hover:bg-surface-hover'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="shrink-0 border-t border-line p-gb-xl pb-[calc(env(safe-area-inset-bottom)+var(--spacing-gb-xl))]">
            {utility}
            <div className="flex flex-col gap-gb-lg">
              <Link href={primaryAction.href} className={`${BUTTON} bg-brand text-on-brand hover:bg-brand-hover`}>
                {primaryAction.label}
              </Link>
              <Link
                href={secondaryAction.href}
                className={`${BUTTON} border border-line-strong bg-surface text-fg-secondary hover:bg-surface-hover`}
              >
                {secondaryAction.label}
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
