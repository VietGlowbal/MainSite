'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * MobileTabBar — a native-app-style bottom navigation shown only on small
 * screens (md:hidden). Gives the mobile web experience the tab-bar feel from
 * the product mockups. Hidden on the marketing landing + auth screens.
 */

const HIDE_ON_PREFIXES = ['/auth', '/onboarding'];

type Tab = {
  href: string;
  label: string;
  icon: (active: boolean) => React.ReactNode;
};

function iconProps(active: boolean) {
  return {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: active ? 2.4 : 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
}

const TABS: Tab[] = [
  {
    href: '/universities',
    label: 'Search',
    icon: (a) => (
      <svg {...iconProps(a)}>
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  {
    href: '/scholarships',
    label: 'Funding',
    icon: (a) => (
      <svg {...iconProps(a)}>
        <circle cx="12" cy="8" r="6" />
        <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
      </svg>
    ),
  },
  {
    href: '/apply',
    label: 'Apply',
    icon: (a) => (
      <svg {...iconProps(a)}>
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
  {
    href: '/my-universities',
    label: 'Saved',
    icon: (a) => (
      <svg {...iconProps(a)} fill={a ? 'currentColor' : 'none'}>
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    href: '/profile',
    label: 'Profile',
    icon: (a) => (
      <svg {...iconProps(a)}>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

export function MobileTabBar() {
  const pathname = usePathname() || '/';

  // Hide on the marketing landing and on full-screen flows.
  if (pathname === '/' || HIDE_ON_PREFIXES.some((p) => pathname.startsWith(p))) {
    return null;
  }

  return (
    <>
      {/* Spacer so page content can scroll clear of the fixed bar (only when shown). */}
      <div aria-hidden className="h-[64px] md:hidden" />

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul className="mx-auto flex max-w-md items-stretch justify-around">
          {TABS.map((tab) => {
            const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            return (
              <li key={tab.href} className="flex-1">
                <Link
                  href={tab.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex flex-col items-center gap-1 py-2 text-[10px] font-semibold transition ${
                    active ? 'text-pink-600' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {tab.icon(active)}
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
