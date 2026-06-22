'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { GlowbalLogo } from '@/components/glowbal-logo';
import { useLanguage } from '@/lib/i18n';

/**
 * SiteHeader — sticky marketing header for the product-led home page.
 *
 * The global app sidebar/nav (NavReveal) is intentionally hidden on "/", so
 * the landing page ships its own lightweight header: logo, in-page anchor
 * links, the language toggle, sign-in, and the primary "Find my scholarships"
 * CTA that opens the funnel at /universities.
 */
const NAV_LINKS = [
  { href: '#how-it-works', label: 'How it works' },
  // The in-page university-search section is hidden from the current flow, so
  // this points at the full explorer route instead of a (now-absent) anchor.
  { href: '/universities', label: 'Universities' },
  { href: '#scholarships', label: 'Scholarships' },
  { href: '#team', label: 'Team' },
  { href: '#faq', label: 'FAQ' },
];

function LanguageToggle() {
  const { lang, toggle } = useLanguage();
  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
      aria-label={`Switch to ${lang === 'en' ? 'Vietnamese' : 'English'}`}
      title={`Switch to ${lang === 'en' ? 'Vietnamese' : 'English'}`}
    >
      <span aria-hidden>{lang === 'en' ? '🇬🇧' : '🇻🇳'}</span>
      <span>{lang === 'en' ? 'EN' : 'VI'}</span>
    </button>
  );
}

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-colors duration-200 ${
        scrolled
          ? 'border-b border-slate-200/70 bg-white/85 backdrop-blur-xl'
          : 'border-b border-transparent bg-white/0'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-6">
        <Link href="/" aria-label="GLOWBAL home" className="shrink-0">
          <GlowbalLogo height={30} priority />
        </Link>

        <nav aria-label="Sections" className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-full px-3.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <LanguageToggle />
          </div>
          <Link
            href="/auth"
            className="hidden rounded-full px-4 py-2 text-sm font-semibold text-slate-700 transition hover:text-slate-900 sm:inline-flex"
          >
            Sign in
          </Link>
          <Link
            href="/universities"
            className="inline-flex items-center justify-center rounded-full bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(255,77,140,0.28)] transition hover:-translate-y-0.5"
          >
            Find my scholarships
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 lg:hidden"
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {open ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-slate-200/70 bg-white/95 backdrop-blur-xl lg:hidden">
          <nav aria-label="Sections" className="mx-auto flex max-w-7xl flex-col gap-1 px-5 py-4 sm:px-6">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                {link.label}
              </a>
            ))}
            <div className="mt-2 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
              <Link
                href="/auth"
                onClick={() => setOpen(false)}
                className="text-sm font-semibold text-slate-700"
              >
                Sign in
              </Link>
              <LanguageToggle />
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
