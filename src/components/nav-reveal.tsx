'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useScroll } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';

const NAV_ITEMS = [
  { href: '/',             label: 'Home' },
  { href: '/universities', label: 'Universities' },
  { href: '/mentors',      label: 'Mentors' },
];

// Simple SVG icons for mobile nav — no emojis
function IconHome()         { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>; }
function IconUniversities() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>; }
function IconMentors()      { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }
function IconUser()         { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>; }

const MOBILE_ICONS: Record<string, () => JSX.Element> = {
  '/':             IconHome,
  '/universities': IconUniversities,
  '/mentors':      IconMentors,
  '/auth':         IconUser,
  '/profile':      IconUser,
};

// ── Rotating avatar ring ─────────────────────────────────────────────────────
function NavAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  const { scrollY } = useScroll();
  const [deg, setDeg] = useState(135);

  useEffect(() => {
    return scrollY.on('change', (y: number) => setDeg((y / 2) % 360));
  }, [scrollY]);

  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <Link href="/profile" aria-label="Your profile" className="glowbal-nav-profile-link">
      <span className="glowbal-nav-profile-name">{name.split(' ')[0]}</span>
      <div className="glowbal-nav-avatar-ring" style={{ background: `linear-gradient(${deg}deg, #ff4d8c, #00b4d8)` }}>
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt={name} className="glowbal-nav-avatar-img" />
        ) : (
          <div className="glowbal-nav-avatar-initials">{initials}</div>
        )}
      </div>
    </Link>
  );
}

// ── Mobile bottom bar ────────────────────────────────────────────────────────
function MobileNav({ user }: { user: { name: string; avatarUrl?: string } | null }) {
  const pathname = usePathname();
  const { scrollY } = useScroll();
  const [deg, setDeg] = useState(135);

  useEffect(() => {
    return scrollY.on('change', (y: number) => setDeg((y / 2) % 360));
  }, [scrollY]);

  const initials = user?.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() ?? '';

  const allItems = [
    ...NAV_ITEMS,
    user ? { href: '/profile', label: 'Profile' } : { href: '/auth', label: 'Sign in' },
  ];

  return (
    <nav className="glowbal-mobile-nav" aria-label="Mobile navigation">
      {allItems.map((item) => {
        const isActive = pathname === item.href;
        const isProfile = item.href === '/profile' && !!user;
        const Icon = MOBILE_ICONS[item.href] ?? IconUser;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`glowbal-mobile-nav-item${isActive ? ' glowbal-mobile-nav-item-active' : ''}`}
          >
            {isProfile ? (
              <div
                className="glowbal-mobile-nav-avatar"
                style={{ background: `linear-gradient(${deg}deg, #ff4d8c, #00b4d8)` }}
              >
                {user?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatarUrl} alt={user.name} className="glowbal-nav-avatar-img" />
                ) : (
                  <div className="glowbal-nav-avatar-initials" style={{ fontSize: '0.55rem' }}>{initials}</div>
                )}
              </div>
            ) : (
              <span className="glowbal-mobile-nav-icon"><Icon /></span>
            )}
            <span className="glowbal-mobile-nav-label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

// ── Main nav ─────────────────────────────────────────────────────────────────
export function NavReveal() {
  const [revealed, setRevealed] = useState(false);
  const [user, setUser] = useState<{ name: string; avatarUrl?: string } | null>(null);

  useEffect(() => {
    const isLanding = window.location.pathname === '/';
    if (!isLanding || localStorage.getItem('glowbal-nav-revealed') === 'true') setRevealed(true);

    function onReveal() {
      setRevealed(true);
      localStorage.setItem('glowbal-nav-revealed', 'true');
    }
    window.addEventListener('glowbal:reveal-nav', onReveal);

    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser({
        name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'Profile',
        avatarUrl: data.user.user_metadata?.avatar_url,
      });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) {
        setUser({
          name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Profile',
          avatarUrl: session.user.user_metadata?.avatar_url,
        });
      } else {
        setUser(null);
      }
    });

    return () => {
      window.removeEventListener('glowbal:reveal-nav', onReveal);
      subscription.unsubscribe();
    };
  }, []);

  if (!revealed) return null;

  return (
    <>
      <header className="glowbal-topbar border-b border-black/5 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 md:px-10 lg:px-12">
          <Link href="/" className="text-lg font-semibold tracking-tight text-slate-900">
            <span className="glowbal-wordmark">Glowbal</span>
          </Link>
          <nav className="glowbal-nav hidden sm:flex items-center gap-2 text-sm text-slate-600">
            {NAV_ITEMS.map((item) => (
              <Link key={item.href} href={item.href} className="glowbal-nav-link transition hover:text-slate-900">
                {item.label}
              </Link>
            ))}
            {user ? (
              <NavAvatar name={user.name} avatarUrl={user.avatarUrl} />
            ) : (
              <Link href="/auth" className="glowbal-nav-link transition hover:text-slate-900">Sign in</Link>
            )}
          </nav>
        </div>
      </header>
      <MobileNav user={user} />
    </>
  );
}
