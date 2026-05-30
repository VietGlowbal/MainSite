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
 *   │ [Logo]   Home  Search  Apply  Mentorship ...           │
 *   └────────────────────────────────────────────────────────┘
 *
 * The active item gets a filled gradient pill; the rest are outlined pills.
 */

const NAV_ITEMS = [
  { href: '/',                label: 'Home',          mobile: 'Home',     activeMatch: 'exact' as const },
  { href: '/universities',    label: 'Search',        mobile: 'Search',   activeMatch: 'prefix' as const },
  { href: '/apply',           label: 'Apply',         mobile: 'Apply',    activeMatch: 'prefix' as const, requiresAuth: true },
  { href: '/mentors',         label: 'Mentorship',     mobile: 'Mentors',  activeMatch: 'prefix' as const },
  { href: '/news',            label: 'GLOWBAL News',  mobile: 'News',     activeMatch: 'prefix' as const },
];

// Extra item shown only to users who have a mentor profile (any status).
const MENTOR_DASHBOARD_ITEM = {
  href: '/dashboard/mentor',
  label: 'Mentor hub',
  mobile: 'Mentor',
  activeMatch: 'prefix' as const,
};

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
  '/apply':           IconApply,
  '/mentors':         IconSession,
  '/news':            IconNews,
  '/auth':            IconUser,
  '/profile':         IconUser,
  '/dashboard/mentor': IconSession,
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

function AdminPill() {
  return (
    <Link
      href="/admin"
      className="glowbal-nav-pill glowbal-nav-pill-admin"
      aria-label="Admin console"
      title="Admin console"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 2L4 6v6c0 5 3.5 9.5 8 10 4.5-.5 8-5 8-10V6z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
      <span>Admin</span>
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
  // Mentors get the mentor hub swapped in for the "News" slot so they can
  // jump straight to their dashboard without a desktop.
  const baseList = user ? NAV_ITEMS : NAV_ITEMS.filter((item) => !item.requiresAuth);
  const baseItems = user?.isMentor
    ? [...baseList.slice(0, 3), MENTOR_DASHBOARD_ITEM]
    : baseList.slice(0, 4);

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

// ── Desktop sidebar ──────────────────────────────────────────────────────────
type UserSummary = { name: string; avatarUrl?: string; isMentor?: boolean; isAdmin?: boolean };

function DesktopSidebar({ user }: { user: UserSummary | null }) {
  const pathname = usePathname();

  const baseItems = user ? NAV_ITEMS : NAV_ITEMS.filter((i) => !i.requiresAuth);
  const visibleItems = user?.isMentor ? [...baseItems, MENTOR_DASHBOARD_ITEM] : baseItems;

  return (
    <aside className="glowbal-sidebar hidden md:flex">
      {/* Animated brand gradient strip (pink → red → aqua → navy) */}
      <div className="glowbal-brand-strip-vertical" aria-hidden />

      <div className="glowbal-sidebar-inner">
        <div className="glowbal-sidebar-header">
          <Link href="/" aria-label="Glowbal home" className="glowbal-sidebar-logo">
            <GlowbalLogo height={32} />
          </Link>
        </div>

        <nav className="glowbal-sidebar-nav" aria-label="Primary">
          {visibleItems.map((item) => {
            const active = isActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`glowbal-sidebar-item${active ? ' glowbal-sidebar-item-active' : ''}`}
              >
                <span className="glowbal-sidebar-item-icon">{MOBILE_ICONS[item.href] ? MOBILE_ICONS[item.href]() : <IconHome />}</span>
                <span className="glowbal-sidebar-item-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="glowbal-sidebar-footer">
          {user?.isAdmin && <AdminPill />}
          <AccountPill user={user} />
        </div>
      </div>
    </aside>
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
    async function loadUser(authUser: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } | null) {
      if (!authUser) {
        setUser(null);
        return;
      }
      // Best-effort fetch of the mentor profile flag. RLS-safe — anyone
      // can read their own row. We don't block the header on this; the
      // pill simply appears after the request resolves.
      const [mentorResult, adminResult] = await Promise.all([
        supabase
          .from('achiever_profiles')
          .select('id')
          .eq('id', authUser.id)
          .maybeSingle(),
        // Admin status is checked server-side so the env-based bootstrap
        // list (ADMIN_USER_IDS) keeps working without exposing it.
        fetch('/api/admin/check', { cache: 'no-store' })
          .then((r) => (r.ok ? r.json() : { isAdmin: false }))
          .catch(() => ({ isAdmin: false })) as Promise<{ isAdmin: boolean }>,
      ]);
      setUser({
        name:
          (authUser.user_metadata?.full_name as string | undefined) ||
          authUser.email?.split('@')[0] ||
          'Profile',
        avatarUrl: authUser.user_metadata?.avatar_url as string | undefined,
        isMentor: !!mentorResult.data,
        isAdmin: adminResult.isAdmin === true,
      });
    }

    supabase.auth.getUser().then(({ data }) => {
      loadUser(data.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      loadUser(session?.user ?? null);
    });

    return () => {
      window.removeEventListener('glowbal:reveal-nav', onReveal);
      subscription.unsubscribe();
    };
  }, []);

  if (!revealed) return null;

  return (
    <>
      <DesktopSidebar user={user} />
      <MobileNav user={user} />
    </>
  );
}
