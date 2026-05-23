'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/admin', label: 'Overview', match: 'exact' as const },
  { href: '/admin/achievers', label: 'Mentor applications', match: 'prefix' as const },
  { href: '/admin/bookings', label: 'Bookings & payments', match: 'prefix' as const },
  { href: '/admin/users', label: 'Users', match: 'prefix' as const },
];

export function AdminTabs() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Admin sections"
      className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white/80 p-2 shadow-[0_2px_8px_rgba(15,23,42,0.04)] backdrop-blur"
    >
      {TABS.map((tab) => {
        const active =
          tab.match === 'exact'
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              active
                ? 'bg-pink-500 text-white shadow-[0_6px_16px_rgba(255,77,140,0.25)]'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
