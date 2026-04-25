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
    if (localStorage.getItem('glowbal-nav-revealed') === 'true') {
      setRevealed(true);
    }
    function onReveal() {
      setRevealed(true);
      localStorage.setItem('glowbal-nav-revealed', 'true');
    }
    window.addEventListener('glowbal:reveal-nav', onReveal);
    return () => window.removeEventListener('glowbal:reveal-nav', onReveal);
  }, []);

  if (!revealed) return null;

  return (
    <header className="glowbal-topbar border-b border-black/5 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 md:px-10 lg:px-12">
        <Link href="/" className="text-lg font-semibold tracking-tight text-slate-900">
          <span className="glowbal-wordmark">Glowbal</span>
        </Link>
        <nav className="glowbal-nav flex items-center gap-2 text-sm text-slate-600">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="glowbal-nav-link transition hover:text-slate-900">
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
