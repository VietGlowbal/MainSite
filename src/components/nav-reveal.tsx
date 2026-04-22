'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const navItems = [
  { href: '/', label: 'Home' },
  { href: '/onboarding', label: 'Onboarding' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/auth', label: 'Auth' },
];

export function NavReveal() {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setRevealed(window.localStorage.getItem('glowbal-nav-revealed') === 'true');
  }, []);

  const reveal = () => {
    setRevealed(true);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('glowbal-nav-revealed', 'true');
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={reveal}
        className="text-lg font-semibold tracking-tight text-slate-900"
        aria-label="Reveal navigation"
      >
        <span className="glowbal-wordmark">Glowbal</span>
      </button>

      {revealed ? (
        <nav className="glowbal-nav flex items-center gap-2 text-sm text-slate-600">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="glowbal-nav-link transition hover:text-slate-900">
              {item.label}
            </Link>
          ))}
        </nav>
      ) : (
        <div className="glowbal-nav-hint text-xs text-slate-500">Tap the logo to reveal navigation</div>
      )}
    </div>
  );
}
