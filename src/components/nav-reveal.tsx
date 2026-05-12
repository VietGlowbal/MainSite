'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, useScroll } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { SignOutButton } from '@/components/sign-out-button';

const NAV_ITEMS = [
  { href: '/',               label: 'Home' },
  { href: '/universities',   label: 'Search' },
  { href: '/my-universities', label: 'My Universities' },
  { href: '/mentors',        label: 'Mentoring', comingSoon: true },
];

// Simple SVG icons for mobile nav — no emojis
function IconHome()         { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>; }
function IconUniversities() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>; }
function IconMyUnis()       { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>; }
function IconMentors()      { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }
function IconUser()         { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>; }

const MOBILE_ICONS: Record<string, () => React.JSX.Element> = {
  '/':                IconHome,
  '/universities':    IconUniversities,
  '/my-universities': IconMyUnis,
  '/mentors':         IconMentors,
  '/auth':            IconUser,
  '/profile':         IconUser,
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

// ── Smart sticky header — hides on scroll-down, reveals on scroll-up ─────────
type UserSummary = { name: string; avatarUrl?: string };

function StickyHeader({ user }: { user: UserSummary | null }) {
  const { scrollY } = useScroll();
  const [visible, setVisible] = useState(true);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let lastY = 0;
    return scrollY.on('change', (y: number) => {
      const delta = y - lastY;
      // Always show at top of page
      if (y < 80) {
        setVisible(true);
        setScrolled(false);
      } else {
        setScrolled(true);
        // Hide when scrolling down more than 4px, show when scrolling up
        if (delta > 4) setVisible(false);
        else if (delta < -4) setVisible(true);
      }
      lastY = y;
    });
  }, [scrollY]);

  return (
    <motion.header
      animate={{ y: visible ? 0 : -80, opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50 }}
    >
      {/* Pill wrapper — floats above page when scrolled, flush when at top */}
      <div
        style={{
          margin: scrolled ? '10px auto' : '0 auto',
          maxWidth: scrolled ? '72rem' : '100%',
          padding: scrolled ? '0 1.5rem' : '0',
          transition: 'margin 0.3s ease, max-width 0.3s ease, padding 0.3s ease',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderRadius: scrolled ? '999px' : '0',
            border: scrolled ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(0,0,0,0.05)',
            borderTop: scrolled ? undefined : 'none',
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(20px)',
            boxShadow: scrolled ? '0 8px 24px rgba(22,33,62,0.1)' : '0 1px 0 rgba(0,0,0,0.05)',
            padding: scrolled ? '0.4rem 0.5rem 0.4rem 1.25rem' : '0.9rem 1.5rem 0.9rem 2.5rem',
            transition: 'border-radius 0.3s ease, padding 0.3s ease, box-shadow 0.3s ease',
          }}
        >
          {/* Wordmark */}
          <Link href="/" style={{ fontSize: '1.05rem', fontWeight: 600, letterSpacing: '-0.01em', textDecoration: 'none' }}>
            <span className="glowbal-wordmark">Glowbal</span>
          </Link>

          {/* Desktop nav links */}
          <nav className="glowbal-nav hidden sm:flex items-center gap-2 text-sm text-slate-600">
            {NAV_ITEMS.map((item) => (
              'comingSoon' in item && item.comingSoon ? (
                <span key={item.href} className="glowbal-nav-link text-slate-400 cursor-not-allowed flex items-center gap-1">
                  {item.label}
                  <span className="text-[10px] bg-pink-50 text-pink-500 px-1.5 py-0.5 rounded-full font-semibold">
                    Soon
                  </span>
                </span>
              ) : (
                <Link key={item.href} href={item.href} className="glowbal-nav-link transition hover:text-slate-900">
                  {item.label}
                </Link>
              )
            ))}
            {user ? (
              <>
                <NavAvatar name={user.name} avatarUrl={user.avatarUrl} />
                <SignOutButton
                  containerClassName="inline-flex"
                  className="glowbal-nav-link transition hover:text-slate-900"
                  redirectTo="/auth"
                >
                  Sign out
                </SignOutButton>
              </>
            ) : (
              <Link href="/auth" className="glowbal-nav-link transition hover:text-slate-900">Sign in</Link>
            )}
          </nav>
        </div>
      </div>
    </motion.header>
  );
}

// ── Main nav ─────────────────────────────────────────────────────────────────
export function NavReveal() {
  const [revealed, setRevealed] = useState(() => {
    if (typeof window === 'undefined') return false;
    const isLanding = window.location.pathname === '/';
    return !isLanding || localStorage.getItem('glowbal-nav-revealed') === 'true';
  });
  const [user, setUser] = useState<UserSummary | null>(null);

  useEffect(() => {
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
      <StickyHeader user={user} />
      {/* Spacer so page content doesn't sit under the fixed header */}
      <div style={{ height: 65 }} aria-hidden />
      <MobileNav user={user} />
    </>
  );
}
