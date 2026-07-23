'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from './button';
import { Container } from './container';
import { TID, testId } from '@/shared/lib';

/**
 * TopNav — the desktop marketing header, from Figma node 104:7114
 * ("Dropdown header navigation", 1440x69).
 *
 * Desktop only: below `md` the header collapses to the hamburger in
 * ./mobile-nav.tsx, which the designer confirmed.
 *
 * Height is 16 + 36 + a 1px rule = 69px, matching the frame exactly.
 *
 * Two things in the design are worth knowing before changing this file:
 *  - The bar is filled with unbound #000000, not the neutral ramp's darkest
 *    step. See --color-gb-neutral-1000 in tokens.css.
 *  - The primary action carries a 2px translucent white border it does not have
 *    anywhere else — that is the `secondary-on-dark` sibling problem in
 *    reverse, and it exists because the button sits on black.
 */

export type TopNavItem = {
  href: string;
  /** Already-translated label. */
  label: string;
};

type Props = {
  /** Wordmark, 28px tall in the design. Links home. */
  logo: React.ReactNode;
  items: readonly TopNavItem[];
  primaryAction: TopNavItem;
  secondaryAction: TopNavItem;
};

export function TopNav({ logo, items, primaryAction, secondaryAction }: Props) {
  const pathname = usePathname();

  return (
    <header
      className="hidden border-b border-white/12 bg-surface-inverse-strong py-gb-xl md:block"
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
          {logo}
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
                    active ? 'bg-white/12 text-white' : 'text-white hover:bg-white/8'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-gb-lg">
          <Button href={secondaryAction.href} variant="secondary-on-dark">
            {secondaryAction.label}
          </Button>
          <Button href={primaryAction.href} variant="primary-on-dark">
            {primaryAction.label}
          </Button>
        </div>
      </Container>
    </header>
  );
}
