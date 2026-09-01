'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useT } from '@/lib/i18n';
import { getLocaleFromPath, getLocaleText, localizePath } from '@/lib/i18n/locale';
import { Avatar } from './avatar';
import { Button } from './button';
import { LanguageSwitcher } from './language-switcher';
import { isNavGroup, isNavLinkActive, type NavEntry, type NavGroup, type NavLink } from './nav-model';
import { NAV_HIDDEN_EVENT, useNavReveal } from './use-nav-reveal';
import { TID, testId } from '@/shared/lib/testids';

/**
 * TopNav — the desktop header, from three Figma frames that are the same
 * component in three states:
 *
 *   104:7114  guest, dark   — Home and the other black-band marketing pages
 *   105:8301  guest, light  — the content pages (universities, study plan)
 *   203:12356 signed in     — dark, and the frame that unblocked Tier 2/3
 *
 * Desktop only: below `md` the header collapses to the hamburger in
 * ./mobile-nav.tsx, which the designer confirmed.
 *
 * Height is 16 + 36 + a 1px rule = 69px, matching all three frames exactly.
 *
 * Three things in the design are worth knowing before changing this file:
 *  - The dark bar is filled with unbound #000000, not the neutral ramp's
 *    darkest step. See --color-gb-neutral-1000 in tokens.css.
 *  - The primary action keeps its 2px translucent white border in BOTH tones
 *    (105:8312 uses the same `on-dark` instance on the white bar). On white it
 *    reads as a slightly lighter inset ring on the rose fill. That is the
 *    design's choice, not an oversight to "fix" — only the SECONDARY button
 *    changes between tones.
 *  - Signed in, the design drops the secondary action entirely: one primary
 *    button, then the avatar and name. So `secondaryAction` is guest-only.
 *  - It does NOT use <Container>. See MEASURE below.
 */

/**
 * The header's measure — deliberately wider than the 1280 every other section
 * sits in, and the reason this file does not use <Container>.
 *
 * Figma only draws the bar at 1440, so 1280 + 32px gutters was read straight
 * off the frame. Past ~1500 it goes wrong: the bar's background is full-bleed
 * but its contents are not, so the actions stop at the centred column's right
 * edge with a few hundred px of empty band beyond them — they read as sitting
 * in the middle of the bar, and the links get squeezed for width they are not
 * short of. Product owner asked for the actions anchored right (with an inset,
 * not flush) and the links given the room back.
 *
 * So: fluid to --container-gb-nav (1728), with the gutter opening to 48px once
 * there is width for it. Below xl nothing changes — under 1280 the viewport was
 * always narrower than the old cap, so those widths render exactly as before.
 *
 * The gutter opens at 2xl, not xl, and that is measured rather than picked. The
 * actions' inset from the viewport's right edge was `(W - 1280) / 2 + 32`; flat
 * 48 only beats that above W = 1312. Bumping at xl would therefore have shoved
 * the buttons 16px the WRONG WAY on a 1280 screen — the exact width Figma's own
 * 1440 frame is closest to. At 2xl the two never cross. Measured insets:
 * 1280 → 32 (unchanged) · 1440 → 32 (was 112) · 1920 → 144 (was 352).
 *
 * ⚠️ Keep this a standalone constant, not an interpolated string: see the
 * scanner note in ./container.tsx for what a `${` touching a class name does.
 */
const MEASURE =
  'mx-auto flex w-full max-w-gb-nav items-center gap-gb-xl px-gb-xl md:px-gb-4xl 2xl:px-gb-6xl';

/**
 * Kept as aliases of the shared model in ./nav-model so the ~15 callers that
 * import `TopNavItem` from the barrel keep compiling. `items` now accepts a
 * `TopNavGroup` alongside plain links — see NavDropdown below.
 */
export type TopNavItem = NavLink;
export type TopNavGroup = NavGroup;
export type TopNavEntry = NavEntry;

export type TopNavUser = {
  /** Display name, shown next to the avatar at text-sm/semibold. */
  name: string;
  avatarUrl?: string | null | undefined;
  /** Where the avatar block links — the account area. */
  href: string;
};

type Tone = 'dark' | 'light';

type Props = {
  /**
   * Wordmark, 28px tall in the design. Pass the bare mark — this component
   * wraps it in the link to `/` itself.
   */
  logo: React.ReactNode;
  items: readonly TopNavEntry[];
  /** Omitted while a user-aware action is still being resolved. */
  primaryAction?: TopNavItem | undefined;
  /** Guest only — ignored when `user` is set, which is what the design does. */
  secondaryAction?: TopNavItem | undefined;
  /** Present => signed-in state (203:12356). */
  user?: TopNavUser | null | undefined;
  /** Defaults to the dark bar the marketing pages use. */
  tone?: Tone | undefined;
  /**
   * A page-specific control sitting before the actions — `SavedNavLink`, in
   * practice.
   *
   * ⚠️ NOT THE LANGUAGE SWITCHER, not any more. This prop was documented as
   * being for it, and exactly one of the seventeen call sites ever passed one —
   * so the switcher shipped on `/profile` and `/scholarships` and on no page
   * that carries its own header. It is now rendered by this component directly;
   * passing another here would show two. See ./language-switcher.tsx.
   */
  utility?: React.ReactNode;
};

const BAR: Record<Tone, string> = {
  dark: 'border-white/12 bg-surface-inverse-strong',
  light: 'border-line bg-surface',
};

/** Nav links: white on the black bar, text-secondary (700) on the white one. */
const LINK: Record<Tone, { idle: string; active: string }> = {
  dark: { idle: 'text-white hover:bg-white/8', active: 'bg-white/12 text-white' },
  light: {
    idle: 'text-fg-secondary hover:bg-surface-hover',
    active: 'bg-surface-muted text-fg',
  },
};

/** The dropdown panel, in the same two tones as the bar it hangs off. */
const MENU: Record<Tone, string> = {
  dark: 'border-white/12 bg-surface-inverse-strong',
  light: 'border-line bg-surface',
};

/**
 * Shared by the links and the dropdown trigger so the two are the same pill.
 * The responsive padding notes live on the link itself, below.
 *
 * ─── THE HOVER OUTLINE IS AN INSET RING, NOT A BORDER (owner, 03/08) ─────────
 *
 * The ask was a red border on hover. `hover:border` cannot deliver it here: a
 * 1px border is part of the box, so the pill would grow 2px in each direction
 * the moment the pointer touched it — every label nudging its neighbours, and
 * the active pill losing the 36px that makes it exactly the height of the two
 * buttons beside it (see the padding note on the link below, which is measured
 * against those buttons).
 *
 * `ring-1 ring-inset` paints the same 1px line on the same edge as a box
 * shadow, which takes no space at all. Nothing moves, and the pill stays 36px.
 * `ring-inset` rather than a plain ring so the line sits on the pill's edge
 * instead of a pixel outside it, where it would crowd the 8px gap between
 * labels. Same treatment in both tones: brand red reads on the black bar and
 * on the white one.
 */
const ITEM =
  'rounded-gb-md px-gb-sm py-gb-xs text-gb-sm font-semibold whitespace-nowrap transition-colors hover:ring-1 hover:ring-inset hover:ring-brand xl:py-gb-md 2xl:px-gb-lg';

/**
 * Gap between the trigger and the panel it opens, in px.
 *
 * A number rather than a class because the panel is positioned from JS (see
 * NavDropdown), so this is the one measurement that cannot be a token. It is
 * --spacing-gb-md; keep the two in step.
 */
const MENU_GAP = 8;

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
      className={`transition-transform ${open ? 'rotate-180' : ''}`}
      aria-hidden
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/**
 * A nav entry that opens a menu — "Search", holding Scholarships, Universities
 * and Mentors.
 *
 * A DISCLOSURE, not an ARIA menu. `role="menu"` is a promise of roving arrow-key
 * focus, type-ahead and a focus trap; a button with `aria-expanded` +
 * `aria-controls` over a plain list of links promises only what this does, and
 * Tab already walks the links because the panel follows the trigger in the DOM.
 *
 * ⚠️ THE PANEL IS `position: fixed`, AND THAT IS LOAD-BEARING. The `<nav>` it
 * sits in is `overflow-hidden` — deliberately, so that a bar too narrow for its
 * labels clips them instead of letting them slide under the action buttons (see
 * the note on the nav element). An absolutely positioned panel is a descendant
 * for clipping purposes and would be cut off at the nav's bottom edge; a fixed
 * one is laid out against the viewport and escapes it. The cost is that the
 * position has to be measured, hence `place()` and the scroll/resize listeners.
 * No ancestor may gain `transform`, `filter` or `contain: paint` without this
 * being revisited — any of them would make the header the containing block
 * again and the clipping would come back.
 */
function NavDropdown({
  group,
  tone,
  pathname,
}: {
  group: NavGroup;
  tone: Tone;
  pathname: string;
}) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState({ left: 0, top: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const active = group.items.some((item) => isNavLinkActive(pathname, item.href));

  // Close on navigation. Adjusting state during render is React's documented
  // way to reset on a changed input, and it is what MobileNav does — an onClick
  // per link would miss browser back/forward and any programmatic push.
  const [renderedPath, setRenderedPath] = useState(pathname);
  if (renderedPath !== pathname) {
    setRenderedPath(pathname);
    setOpen(false);
  }

  const place = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setAnchor({ left: rect.left, top: rect.bottom + MENU_GAP });
  }, []);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (target == null) return;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setOpen(false);
      // Escape can be pressed with focus on a link inside the panel, which is
      // about to be unmounted — put it somewhere deliberate.
      triggerRef.current?.focus();
    }

    // The bar can slide out from under an open panel (useNavReveal). The panel
    // is placed against the viewport and only re-measures on scroll, so it
    // would be left mid-air; closing with the bar is the honest behaviour.
    function onNavHidden() {
      setOpen(false);
    }

    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', place);
    // Capture phase: the panel is placed against the viewport, so it has to
    // follow the trigger when ANY scroller moves it, not only the page.
    window.addEventListener('scroll', place, true);
    window.addEventListener(NAV_HIDDEN_EVENT, onNavHidden);

    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener(NAV_HIDDEN_EVENT, onNavHidden);
    };
  }, [open, place]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        // Measured before the state flips so the panel's first paint is already
        // in the right place — an effect would run a frame late and it would
        // flash at the top-left corner.
        onClick={() => {
          if (!open) place();
          setOpen((value) => !value);
        }}
        className={`inline-flex items-center gap-gb-xs ${ITEM} ${
          active || open ? LINK[tone].active : LINK[tone].idle
        }`}
      >
        {group.label}
        <IconChevronDown open={open} />
      </button>

      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          style={{ left: anchor.left, top: anchor.top }}
          className={`fixed z-50 flex min-w-gb-width-xs flex-col gap-gb-xxs rounded-gb-lg border p-gb-sm shadow-gb-lg ${MENU[tone]}`}
        >
          {group.items.map((item) => {
            const itemActive = isNavLinkActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={itemActive ? 'page' : undefined}
                onClick={() => setOpen(false)}
                /* Same hover ring as the top-level pills (see ITEM) — these are
                   nav options too, and a menu whose rows highlighted
                   differently from the bar above them would read as a different
                   control. Not `ITEM` itself: these rows are wider (px-gb-lg at
                   every width) because a dropdown has the room. */
                className={`rounded-gb-md px-gb-lg py-gb-md text-gb-sm font-semibold whitespace-nowrap transition-colors hover:ring-1 hover:ring-inset hover:ring-brand ${
                  itemActive ? LINK[tone].active : LINK[tone].idle
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </>
  );
}

export function TopNav({
  logo,
  items,
  primaryAction,
  secondaryAction,
  user,
  tone = 'dark',
  utility,
}: Props) {
  const t = useT();
  const pathname = usePathname();
  const routeLocale = getLocaleFromPath(pathname);
  const translate = routeLocale === 'vi' ? (label: string) => getLocaleText(routeLocale, label) : t;
  // Destructured rather than held as one object: react-hooks/refs treats a
  // value carrying a ref as a ref itself, and reading `.top` off it during
  // render trips the rule even though `top` is ordinary state.
  const { ref: navRef, top: navTop, isFloating, isHidden } = useNavReveal();

  return (
    <header
      ref={navRef}
      /*
       * Sticky, and moved by `top` rather than `transform` — see
       * use-nav-reveal.ts. A transform here would make this element the
       * containing block for NavDropdown's fixed panel and bring back the
       * clipping the ⚠️ note on that component describes.
       *
       * `z-40` sits under the dropdown panel (z-50) and under Modal, so a bar
       * that follows the page cannot cover a dialog.
       */
      style={{ top: navTop }}
      /*
       * The shadow goes with `isFloating`, but NOT while parked off-screen: a
       * box-shadow paints outside the border box, so a fully hidden bar would
       * still smear a grey band across the top few px of the page — the other
       * half of "the nav doesn't disappear completely".
       */
      className={`sticky z-40 hidden border-b py-gb-xl transition-[top] duration-200 ease-out motion-reduce:transition-none md:block ${BAR[tone]}${
        isFloating && !isHidden ? ' shadow-gb-xs' : ''
      }`}
      {...testId(TID.navHeader)}
    >
      <div className={MEASURE}>
        {/*
         * 66px between wordmark and nav in the design; the nearest step is 64.
         * The design only specifies 1440, and at 64px the five nowrap labels
         * collide with the actions somewhere below ~1200 — so the gap opens up
         * only once there is room for it.
         */}
        <div className="flex min-w-0 flex-1 items-center gap-gb-3xl xl:gap-gb-7xl">
          {/* The wordmark is the site's home affordance, which is why the `logo`
              prop is documented as "Links home". The <Link> lives HERE rather
              than in each caller so no page can forget it — MobileNav takes the
              opposite approach and its callers wrap the node themselves, so do
              not pass an already-linked node in here or the anchors nest. */}
          <Link
            href={localizePath('/', routeLocale)}
            aria-label={getLocaleText(routeLocale, 'GlowBal home')}
            className="flex shrink-0 items-center rounded-gb-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {logo}
          </Link>
          {/*
           * Spacing between the links opens up with the viewport, and the steps
           * are measured against the slack between the nav and the actions, not
           * chosen by eye. At the tight setting that slack is 116px at 1280 and
           * 532px at 1920 — room the links were not using.
           *
           * ⚠️ `overflow-hidden` means running out of room CLIPS links silently
           * rather than wrapping or scrolling, so every loosening is gated at
           * `2xl`. It has to be: below 1280 the bar is over-subscribed (a
           * pre-existing bug, see docs/known-issues.md), and clipping is the
           * least-bad failure — without it the labels slide out under the two
           * action buttons instead.
           *
           * Folding Scholarships / Universities / Advisors into the "Search"
           * dropdown keeps the audience-aware bar to four or five top-level
           * labels and buys back most of that margin, but the rule stands: this
           * clips if a future change oversubscribes it.
           *
           * It is also why NavDropdown's panel is `position: fixed`. Read the ⚠️
           * on that component before changing either.
           */}
          <nav
            aria-label={translate('Primary')}
            className="flex min-w-0 items-center gap-gb-md overflow-hidden 2xl:gap-gb-xl"
          >
            {items.map((item) =>
              isNavGroup(item) ? (
                <NavDropdown key={item.label} group={item} tone={tone} pathname={pathname} />
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isNavLinkActive(pathname, item.href) ? 'page' : undefined}
                  /* The pill geometry is in ITEM above, shared with the dropdown
                     trigger. `py-gb-md` from xl up makes the active pill exactly
                     the 36px of the two buttons beside it instead of a squat
                     28px, and costs no header height: the row is already 36px
                     because the buttons set it.

                     The matching `px-gb-lg` (which would complete Button's `sm`
                     size) waits for 2xl, and that is a hard constraint, not a
                     taste call. It widens the labels by ~12px each — more slack
                     than the bar had at 1280 back when it carried six of them,
                     and it clipped "Blog" on any machine whose text measured a
                     few px wider than the author's (CI did). At 2xl there are
                     ~200px spare and it is free. */
                  className={`${ITEM} ${
                    isNavLinkActive(pathname, item.href) ? LINK[tone].active : LINK[tone].idle
                  }`}
                >
                  {item.label}
                </Link>
              ),
            )}
          </nav>
        </div>

        {/* 24px between the actions and the avatar block (203:12466); the
            buttons themselves stay 12px apart in both states. */}
        <div className="flex shrink-0 items-center gap-gb-3xl">
          {/* Never empty — the switcher is unconditional — so this div can be
              rendered flat rather than guarded. A guarded-but-present empty div
              would still take the 24px gap beside it. */}
          <div className="flex shrink-0 items-center gap-gb-lg">
            {utility}
            <LanguageSwitcher tone={tone} />
          </div>

          <div className="flex shrink-0 items-center gap-gb-lg">
            {/* Signed in, the design shows no "Sign in" button at all. */}
            {user == null && secondaryAction ? (
              <Button
                href={secondaryAction.href}
                variant={tone === 'dark' ? 'secondary-on-dark' : 'secondary'}
              >
                {secondaryAction.label}
              </Button>
            ) : null}
            {primaryAction ? (
              <Button href={primaryAction.href} variant="primary-on-dark">
                {primaryAction.label}
              </Button>
            ) : null}
          </div>

          {user ? (
            <Link
              href={user.href}
              className="flex shrink-0 items-center gap-gb-xs rounded-gb-full transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              {...testId(TID.navProfileLink)}
            >
              <Avatar name={user.name} src={user.avatarUrl} />
              {/* neutral-50 rather than pure white in the design (203:12469). */}
              <span
                className={`text-gb-sm font-semibold whitespace-nowrap ${
                  tone === 'dark' ? 'text-fg-on-inverse' : 'text-fg'
                }`}
              >
                {user.name}
              </span>
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}
