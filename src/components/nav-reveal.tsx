'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, useScroll } from 'framer-motion';
import { GlowbalLogo } from '@/components/glowbal-logo';
import { createClient } from '@/lib/supabase/client';

/**
 * Navigation
 * ──────────
 * Layout per the spec:
 *   ┌────────────────────────────────────────────────────────┐
 *   │  ▰▰▰  thin animated brand gradient strip  ▰▰▰          │
 *   ├────────────────────────────────────────────────────────┤
 *   │ [Logo]   Home  Search  Apply  1-2-1 Sessions ...       │
 *   └────────────────────────────────────────────────────────┘
 *
 * The active item gets a filled gradient pill; the rest are outlined pills.
 */

const NAV_ITEMS = [
  { href: '/',                label: 'Home',          mobile: 'Home',     activeMatch: 'exact' as const },
  { href: '/universities',    label: 'Search',        mobile: 'Search',   activeMatch: 'prefix' as const },
  { href: '/my-universities', label: 'Apply',         mobile: 'Apply',    activeMatch: 'prefix' as const, requiresAuth: true },
  { href: '/achievers',       label: '1-2-1 Sessions', mobile: '1-2-1',   activeMatch: 'prefix' as const },
  { href: '/news',            label: 'GLOWBAL News',  mobile: 'News',     activeMatch: 'prefix' as const },
];

function isActive(pathname: string, item: { href: string; activeMatch: 'exact' | 'prefix' }) {
  if (item.activeMatch === 'exact') return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

// ── Mobile bottom-nav icons (kept simple, theme-friendly) ────────────────────
function IconHome()    { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>; }
function IconSearch()  { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>; }
function IconApply()   { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>; }
function IconSession() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>; }
function IconNews()    { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8z"/></svg>; }
function IconUser()    { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>; }

const MOBILE_ICONS: Record<string, () => React.JSX.Element> = {
  '/':                IconHome,
  '/universities':    IconSearch,
  '/my-universities': IconApply,
  '/achievers':       IconSession,
  '/news':            IconNews,
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
    <Link href="/profile" aria-label="Your profile" className="glowbal-nav-account">
      <div className="glowbal-nav-avatar-ring" style={{ background: `linear-gradient(${deg}deg, #ff4d8c, #ff3b3b, #00b4d8, #1e2a78)` }}>
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt={name} className="glowbal-nav-avatar-img" />
        ) : (
          <div className="glowbal-nav-avatar-initials">{initials}</div>
        )}
      </div>
      <span className="glowbal-nav-account-label">{name.split(' ')[0]}</span>
    </Link>
  );
}

function AccountPill({ user }: { user: UserSummary | null }) {
  if (user) return <NavAvatar name={user.name} avatarUrl={user.avatarUrl} />;
  return (
    <Link href="/auth" className="glowbal-nav-pill glowbal-nav-pill-account">
      Sign In/Up
    </Link>
  );
}

// ── Mobile bottom bar ────────────────────────────────────────────────────────
function MobileNav({ user }: { user: UserSummary | null }) {
  const pathname = usePathname();
  const { scrollY } = useScroll();
  const [deg, setDeg] = useState(135);

  useEffect(() => {
    return scrollY.on('change', (y: number) => setDeg((y / 2) % 360));
  }, [scrollY]);

  const initials = user?.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() ?? '';

  // Show a curated 4-item subset on mobile + the account/profile slot.
  const baseItems = (user
    ? NAV_ITEMS
    : NAV_ITEMS.filter((item) => !item.requiresAuth)
  ).slice(0, 4);

  const allItems = [
    ...baseItems,
    user ? { href: '/profile', label: 'Profile', mobile: 'Profile' } : { href: '/auth', label: 'Sign in', mobile: 'Sign in' },
  ];

  return (
    <nav className="glowbal-mobile-nav" aria-label="Mobile navigation">
      {allItems.map((item) => {
        const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(`${item.href}/`));
        const isProfile = item.href === '/profile' && !!user;
        const Icon = MOBILE_ICONS[item.href] ?? IconUser;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`glowbal-mobile-nav-item${active ? ' glowbal-mobile-nav-item-active' : ''}`}
          >
            {isProfile ? (
              <div
                className="glowbal-mobile-nav-avatar"
                style={{ background: `linear-gradient(${deg}deg, #ff4d8c, #ff3b3b, #00b4d8, #1e2a78)` }}
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
            <span className="glowbal-mobile-nav-label">{item.mobile}</span>
          </Link>
        );
      })}
    </nav>
  );
}

// ── Main sticky header ───────────────────────────────────────────────────────
type UserSummary = { name: string; avatarUrl?: string };

function StickyHeader({ user }: { user: UserSummary | null }) {
  const pathname = usePathname();
  const { scrollY } = useScroll();
  const [visible, setVisible] = useState(true);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let lastY = 0;
    return scrollY.on('change', (y: number) => {
      const delta = y - lastY;
      if (y < 80) {
        setVisible(true);
        setScrolled(false);
      } else {
        setScrolled(true);
        if (delta > 4) setVisible(false);
        else if (delta < -4) setVisible(true);
      }
      lastY = y;
    });
  }, [scrollY]);

  const visibleItems = user ? NAV_ITEMS : NAV_ITEMS.filter((i) => !i.requiresAuth);

  return (
    <motion.header
      animate={{ y: visible ? 0 : -120, opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="glowbal-header"
      data-scrolled={scrolled || undefined}
    >
      {/* Animated brand gradient strip (pink → red → aqua → navy) */}
      <div className="glowbal-brand-strip" aria-hidden />

      <div className={`glowbal-header-inner${scrolled ? ' is-scrolled' : ''}`}>
        <div className="glowbal-header-shell">
          <Link href="/" aria-label="Glowbal home" className="glowbal-header-logo">
            <GlowbalLogo height={32} />
          </Link>

          <nav className="glowbal-nav-tabs hidden md:flex" aria-label="Primary">
            {visibleItems.map((item) => {
              const active = isActive(pathname, item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`glowbal-nav-pill${active ? ' glowbal-nav-pill-active' : ''}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="glowbal-header-account">
            <AccountPill user={user} />
          </div>
        </div>
      </div>
    </motion.header>
  );
}

// ── Main nav controller ──────────────────────────────────────────────────────
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
      <div style={{ height: 88 }} aria-hidden />
      <MobileNav user={user} />
    </>
  );
}
