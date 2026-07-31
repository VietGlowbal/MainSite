'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/admin', label: 'Overview', match: 'exact' as const },
  { href: '/admin/achievers', label: 'Mentor applications', match: 'prefix' as const },
  { href: '/admin/bookings', label: 'Bookings & payments', match: 'prefix' as const },
  { href: '/admin/news', label: 'News & GEO', match: 'prefix' as const },
  { href: '/admin/users', label: 'Users', match: 'prefix' as const },
  { href: '/admin/coordinators', label: 'Coordinators', match: 'prefix' as const },
];

/**
 * The console's section rail. It sits on the dark header band, so the active
 * tab is the light surface and the rest are the dark-band foreground ramp —
 * the same inversion the footer and top nav use, rather than a second set of
 * greys invented for this one control.
 *
 * Wraps rather than scrolls: six labels at 14px fit two rows on a 375px screen,
 * and a horizontal scroller hides tabs behind an edge with nothing to say they
 * are there.
 */
export function AdminTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin sections" className="flex flex-wrap gap-gb-md">
      {TABS.map((tab) => {
        const active =
          tab.match === 'exact'
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={`rounded-gb-full px-gb-xl py-gb-md text-gb-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              active
                ? 'bg-surface text-fg'
                : 'text-fg-on-inverse-muted hover:bg-surface-inverse hover:text-fg-on-inverse'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
