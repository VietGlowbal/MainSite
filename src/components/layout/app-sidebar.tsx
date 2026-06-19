'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
};

const ITEMS: NavItem[] = [
  {
    label: 'Home',
    href: '/apply',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    label: 'Search',
    href: '/universities',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
    ),
  },
  {
    label: 'Universities',
    href: '/universities',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" />
      </svg>
    ),
  },
  {
    label: 'Apply',
    href: '/apply',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="15" y2="17" />
      </svg>
    ),
  },
  {
    label: 'Mentors',
    href: '/mentors',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    label: 'Scholarships',
    href: '/scholarships',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
  {
    label: 'Bookings',
    href: '/dashboard/bookings',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    label: 'Profile',
    href: '/profile',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

const MENTOR_DASHBOARD_ITEM: NavItem = {
  label: 'Mentor dashboard',
  href: '/dashboard/mentor',
  icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 4 7v10l8 5 8-5V7l-8-5z" />
      <path d="M4 7l8 5 8-5" />
      <path d="M12 22V12" />
    </svg>
  ),
};

function HelpCard({ isExpanded }: { isExpanded: boolean }) {
  if (!isExpanded) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-pink-50 to-cyan-50/50 p-2 flex items-center justify-center">
        <Link
          href="/mentors"
          className="flex items-center justify-center"
          title="Need help with your application?"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-pink-600">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-pink-50 to-cyan-50/50 p-4 text-center">
      <div className="text-3xl mb-2 flex items-center justify-center">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-pink-600">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      </div>
      <p className="text-xs font-semibold text-slate-900 leading-tight mb-1">
        Need help with your<br />application?
      </p>
      <p className="text-[0.65rem] text-slate-500 leading-relaxed mb-3">
        Book a mentorship session with<br />our mentors and alumni.
      </p>
      <Link
        href="/mentors"
        className="inline-flex rounded-full border border-pink-300 bg-white px-3 py-1.5 text-xs font-semibold text-pink-600 hover:bg-pink-50 transition"
      >
        Book a Session
      </Link>
    </div>
  );
}

/**
 * Shared sidebar nav for the signed-in app shell.
 * Highlights the active item based on the current pathname.
 *
 * Pass `isMentor` from the parent server component so we can show a
 * "Mentor dashboard" link for users who already have a mentor profile.
 * 
 * Features a collapsible/expandable toggle for desktop views.
 */
export function AppSidebar({ isMentor = false }: { isMentor?: boolean } = {}) {
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(true);

  const items = isMentor ? [...ITEMS, MENTOR_DASHBOARD_ITEM] : ITEMS;

  return (
    <aside className={`hidden lg:flex flex-col space-y-4 transition-all duration-300 ${isExpanded ? 'w-64' : 'w-20'}`}>
      <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
        {/* Toggle Button - placed inside at top */}
        <div className="flex justify-end mb-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
            title={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-label={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <svg 
              width="14" 
              height="14" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              className={`text-slate-600 transition-transform duration-300 ${isExpanded ? '' : 'rotate-180'}`}
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        </div>

        <nav className="space-y-0.5">
          {items.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center ${isExpanded ? 'gap-2.5' : 'justify-center'} rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? 'bg-pink-50 text-pink-600 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
                title={!isExpanded ? item.label : undefined}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {isExpanded && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </div>

      <HelpCard isExpanded={isExpanded} />
    </aside>
  );
}
