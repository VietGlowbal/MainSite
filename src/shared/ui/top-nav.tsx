'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Avatar } from './avatar';
import { Button } from './button';
import { Container } from './container';
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
 */

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
}: Props) {
  const pathname = usePathname();

  return (
    <header
      className={`hidden border-b py-gb-xl md:block ${BAR[tone]}`}
      {...testId(TID.navHeader)}
    >
      <Container className="flex items-center gap-gb-xl">
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
          <nav aria-label="Primary" className="flex min-w-0 items-center gap-gb-md overflow-hidden">
            {items.map((item) => {
              const active =
                pathname === item.href || (item.href !== '/' && pathname.startsWith(`${item.href}/`));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`rounded-gb-md px-gb-sm py-gb-xs text-gb-sm font-semibold whitespace-nowrap transition-colors ${
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
      </Container>
    </header>
  );
}
