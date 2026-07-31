'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Avatar } from './avatar';
import { Button } from './button';
import { TID, testId } from '@/shared/lib';

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

export type TopNavItem = {
  href: string;
  /** Already-translated label. */
  label: string;
};

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
  items: readonly TopNavItem[];
  primaryAction: TopNavItem;
  /** Guest only — ignored when `user` is set, which is what the design does. */
  secondaryAction?: TopNavItem | undefined;
  /** Present => signed-in state (203:12356). */
  user?: TopNavUser | null | undefined;
  /** Defaults to the dark bar the marketing pages use. */
  tone?: Tone | undefined;
  /**
   * A control that sits before the actions — the language switcher, in practice.
   *
   * Not in the Figma frames, which draw the header for an English-only mockup.
   * It is here because the app is bilingual and the switcher used to live in
   * the sidebar footer: with the sidebar gone there is nowhere else on desktop
   * for it, and MobileNav has had the equivalent `utility` slot all along.
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

export function TopNav({
  logo,
  items,
  primaryAction,
  secondaryAction,
  user,
  tone = 'dark',
  utility,
}: Props) {
  const pathname = usePathname();

  return (
    <header
      className={`hidden border-b py-gb-xl md:block ${BAR[tone]}`}
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
            href="/"
            aria-label="GlowBal home"
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
           * `2xl`. It has to be: below 1280 the bar is ALREADY over-subscribed
           * (371px clipped at 768, 115px at 1024 — a pre-existing bug, see
           * docs/known-issues.md), and at 1280 the links fit with only ~99px to
           * spare. Anything that widens them before 2xl eats that margin and
           * buries "Blog" on the first machine that measures text differently.
           */}
          <nav
            aria-label="Primary"
            className="flex min-w-0 items-center gap-gb-md overflow-hidden 2xl:gap-gb-xl"
          >
            {items.map((item) => {
              const active =
                pathname === item.href || (item.href !== '/' && pathname.startsWith(`${item.href}/`));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  /* `py-gb-md` from xl up makes the active pill exactly the 36px
                     of the two buttons beside it instead of a squat 28px, and
                     costs no header height: the row is already 36px because the
                     buttons set it.

                     The matching `px-gb-lg` (which would complete Button's `sm`
                     size) waits for 2xl, and that is a hard constraint, not a
                     taste call. It widens the six labels by 72px in total —
                     more than the 27px of slack the bar has left at 1280, so at
                     xl it clipped "Blog" on any machine whose text measured a
                     few px wider than the author's (CI did). At 2xl there are
                     ~200px spare and it is free. */
                  className={`rounded-gb-md px-gb-sm py-gb-xs text-gb-sm font-semibold whitespace-nowrap transition-colors xl:py-gb-md 2xl:px-gb-lg ${
                    active ? LINK[tone].active : LINK[tone].idle
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* 24px between the actions and the avatar block (203:12466); the
            buttons themselves stay 12px apart in both states. */}
        <div className="flex shrink-0 items-center gap-gb-3xl">
          {utility ? <div className="flex shrink-0 items-center">{utility}</div> : null}

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
            <Button href={primaryAction.href} variant="primary-on-dark">
              {primaryAction.label}
            </Button>
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
