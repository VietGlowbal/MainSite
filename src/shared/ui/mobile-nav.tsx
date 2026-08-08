'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LanguageSwitcher } from './language-switcher';
import { isNavGroup, isNavLinkActive, type NavEntry, type NavGroup, type NavLink } from './nav-model';
import { TID, testId } from '@/shared/lib/testids';

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
 * Deviation, deliberate: the mockup's footer has no language switch. The app is
 * bilingual and dropping it would strand Vietnamese users, so it renders above
 * the buttons. It used to be passed in through `utility` by whichever caller
 * remembered; this component renders it itself now, so every sheet has one.
 */

/**
 * Aliases of the shared model in ./nav-model, kept so the existing importers of
 * `MobileNavItem` compile unchanged. `items` also accepts a `MobileNavGroup` —
 * the sheet renders one as a collapsible section rather than a popover.
 */
export type MobileNavItem = NavLink;
export type MobileNavGroup = NavGroup;
export type MobileNavEntry = NavEntry;

export type MobileNavAction = MobileNavItem;

type Props = {
  /** Wordmark, 28px tall in the design. */
  logo: React.ReactNode;
  items: readonly MobileNavEntry[];
  /** Filled brand button at the bottom of the panel. */
  primaryAction?: MobileNavAction | undefined;
  /** Outlined button beneath it — sign in, or the profile link once signed in. */
  secondaryAction?: MobileNavAction | undefined;
  /**
   * A page-specific control between the item list and the buttons —
   * `SavedNavLink`, in practice.
   *
   * ⚠️ The language switch used to be passed in here by the one caller that
   * remembered to. It is rendered below `utility` by this component now, so
   * every sheet has it; passing another would show two. See
   * ./language-switcher.tsx.
   */
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

/** The 44px row the sheet is built from: 12 + a 20px text-sm line + 12. */
const ROW = 'px-gb-xl py-gb-lg text-gb-sm font-semibold transition-colors';

function rowTone(active: boolean): string {
  return active ? 'text-brand' : 'text-fg hover:bg-surface-hover';
}

function IconChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
      aria-hidden
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/**
 * A grouped entry ("Search") in the sheet.
 *
 * The desktop bar shows this as a popover because a horizontal bar has nowhere
 * to put three more items. The sheet is a vertical list and does, so the group
 * expands IN PLACE and starts OPEN: collapsing it by default would bury
 * Scholarships and Universities — two of the four things this app is for —
 * behind an extra tap, to save scroll the sheet is not short of.
 *
 * Still a disclosure rather than a plain heading, so the grouping is announced
 * and someone who wants the list shorter can close it.
 */
function MobileNavGroupRow({ group, pathname }: { group: NavGroup; pathname: string }) {
  const panelId = useId();
  const [open, setOpen] = useState(true);

  return (
    <div className="flex flex-col gap-gb-xxs">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className={`flex w-full items-center justify-between ${ROW} ${rowTone(false)}`}
      >
        <span>{group.label}</span>
        <IconChevronDown open={open} />
      </button>

      {open ? (
        <div id={panelId} className="flex flex-col gap-gb-xxs">
          {group.items.map((item) => {
            const active = isNavLinkActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                /* Indented by one row's padding so the nesting is visible
                   without a second type size or a rule down the left. */
                className={`${ROW} pl-gb-5xl font-medium ${rowTone(active)}`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

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
              {items.map((item) =>
                isNavGroup(item) ? (
                  <MobileNavGroupRow key={item.label} group={item} pathname={pathname} />
                ) : (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isNavLinkActive(pathname, item.href) ? 'page' : undefined}
                    className={`${ROW} ${rowTone(isNavLinkActive(pathname, item.href))}`}
                  >
                    {item.label}
                  </Link>
                ),
              )}
            </nav>

            <div className="border-t border-line px-gb-xl py-gb-3xl pb-[calc(env(safe-area-inset-bottom)+var(--spacing-gb-3xl))]">
              {utility}
              {/* After `utility` so the order matches the desktop bar, where
                  SavedNavLink sits left of the switcher. */}
              <LanguageSwitcher variant="row" />
              {primaryAction || secondaryAction ? (
                <div className="flex flex-col gap-gb-lg">
                  {primaryAction ? (
                    <Link href={primaryAction.href} className={`${BUTTON} bg-brand text-on-brand hover:bg-brand-hover`}>
                      {primaryAction.label}
                    </Link>
                  ) : null}
                  {secondaryAction ? (
                    <Link
                      href={secondaryAction.href}
                      className={`${BUTTON} border border-line-strong bg-surface text-fg-secondary shadow-gb-xs hover:bg-surface-hover`}
                    >
                      {secondaryAction.label}
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </>
      )}
    </>
  );
}
