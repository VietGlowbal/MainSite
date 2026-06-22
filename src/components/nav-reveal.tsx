'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GlowbalLogo } from '@/components/glowbal-logo';
import { useLanguage } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/client';

/**
 * Scroll-driven gradient angle for the avatar ring.
 *
 * This used to rely on framer-motion's `useScroll`, which pulled the whole
 * framer-motion bundle into the global navigation — and therefore every
 * non-home page. A passive, rAF-throttled scroll listener does the same job
 * with zero dependencies, keeping framer-motion off the critical path.
 */
function useScrollDeg() {
  const [deg, setDeg] = useState(135);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setDeg((window.scrollY / 2) % 360);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return deg;
}

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
  { href: '/scholarships',    label: 'Scholarships',  mobile: 'Fund',     activeMatch: 'prefix' as const, requiresAuth: true },
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

// Extra item shown only to users with the coordinator role.
const COORDINATOR_ITEM = {
  href: '/coordinator',
  label: 'Coordinator',
  mobile: 'Coordinator',
  activeMatch: 'prefix' as const,
};

function isActive(pathname: string, item: { href: string; activeMatch: 'exact' | 'prefix' }) {
  if (item.activeMatch === 'exact') return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

// ── Sidebar / nav icons ──────────────────────────────────────────────────────
function IconHome()         { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>; }
function IconSearch()       { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>; }
function IconApply()        { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a1 1 0 0 0 1 1h4"/><path d="m9 15 2 2 4-4"/></svg>; }
function IconScholarship()  { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"/><path d="M21.5 12v6"/></svg>; }
function IconMentorship()   { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }
function IconMentorHub()    { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>; }
function IconNews()         { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>; }
function IconUser()         { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>; }
function IconAdmin()        { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 9.7a1 1 0 0 1-.68 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 .76-.97l8-2a1 1 0 0 1 .48 0l8 2A1 1 0 0 1 20 6v7z"/><path d="m9 12 2 2 4-4"/></svg>; }
function IconCoordinator()  { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>; }
function IconUserGuest()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>; }

const SIDEBAR_ICONS: Record<string, () => React.JSX.Element> = {
  '/':                IconHome,
  '/universities':    IconSearch,
  '/apply':           IconApply,
  '/scholarships':    IconScholarship,
  '/mentors':         IconMentorship,
  '/news':            IconNews,
  '/auth':            IconUser,
  '/profile':         IconUser,
  '/dashboard/mentor': IconMentorHub,
  '/admin':           IconAdmin,
  '/coordinator':     IconCoordinator,
};

// ── Rotating avatar ring ─────────────────────────────────────────────────────
function NavAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  const deg = useScrollDeg();

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
  const { t } = useLanguage();
  if (user) return <NavAvatar name={user.name} avatarUrl={user.avatarUrl} />;
  return (
    <Link href="/auth" className="glowbal-nav-account glowbal-nav-account-guest" title={t('Sign In/Up')} aria-label="Sign in or sign up">
      <div className="glowbal-nav-avatar-ring" style={{ background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.08), rgba(15, 23, 42, 0.12))' }}>
        <div className="glowbal-nav-avatar-initials" style={{ color: 'rgb(71, 85, 105)' }}>
          <IconUserGuest />
        </div>
      </div>
      <span className="glowbal-nav-account-label">{t('Sign In/Up')}</span>
    </Link>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function AdminPill() {
  const { t } = useLanguage();
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
      <span>{t('Admin')}</span>
    </Link>
  );
}

// ── Mobile bottom bar ────────────────────────────────────────────────────────
function MobileNav({ user }: { user: UserSummary | null }) {
  const pathname = usePathname();
  const deg = useScrollDeg();
  const { t } = useLanguage();

  const initials = user?.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() ?? '';

  // Mobile nav shows exactly 4 app-like buttons: Search, Apply, Mentors, Profile
  const mobileItems = [
    { href: '/universities', label: 'Search', mobile: 'Search', icon: IconSearch },
    { href: '/apply', label: 'Apply', mobile: 'Apply', icon: IconApply },
    { href: '/mentors', label: 'Mentors', mobile: 'Mentors', icon: IconMentorship },
    user 
      ? { href: '/profile', label: 'Profile', mobile: 'Profile', icon: IconUser, isProfile: true }
      : { href: '/auth', label: 'Sign in', mobile: 'Sign in', icon: IconUser, isProfile: false },
  ];

  return (
    <nav className="glowbal-mobile-nav" aria-label="Mobile navigation">
      {mobileItems.map((item) => {
        const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(`${item.href}/`));
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`glowbal-mobile-nav-item${active ? ' glowbal-mobile-nav-item-active' : ''}`}
          >
            {item.isProfile && user ? (
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
            <span className="glowbal-mobile-nav-label">{t(item.mobile)}</span>
          </Link>
        );
      })}
    </nav>
  );
}

// ── Language Switcher ────────────────────────────────────────────────────────
function LanguageSwitcher() {
  const { lang: language, toggle: toggleLanguage } = useLanguage();

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className="glowbal-language-switcher"
      aria-label={`Switch to ${language === 'en' ? 'Vietnamese' : 'English'}`}
      title={`Switch to ${language === 'en' ? 'Vietnamese' : 'English'}`}
    >
      <span className="glowbal-language-label">
        {language === 'en' ? (
          <>
            <span className="glowbal-language-flag">🇬🇧</span>
            <span className="glowbal-language-text">English</span>
          </>
        ) : (
          <>
            <span className="glowbal-language-flag">🇻🇳</span>
            <span className="glowbal-language-text">Tiếng Việt</span>
          </>
        )}
      </span>
    </button>
  );
}

// ── Mobile top bar + hamburger drawer ────────────────────────────────────────
// The bottom nav only has room for 4 primary destinations. The hamburger
// surfaces everything else (Scholarships, GLOWBAL News, Mentor hub, Admin) plus
// the language switch, mirroring the desktop sidebar's secondary links. Mobile
// only — hidden from md upward where the full sidebar is visible.
function MobileTopBar({ user }: { user: UserSummary | null }) {
  const pathname = usePathname();
  const { t, lang: language, toggle: toggleLanguage } = useLanguage();
  const [open, setOpen] = useState(false);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Pages not already reachable from the bottom nav (Search/Apply/Mentors/Profile).
  const drawerItems: { href: string; label: string; icon: () => React.JSX.Element }[] = [
    { href: '/', label: 'Home', icon: IconHome },
    { href: '/scholarships', label: 'Scholarships', icon: IconScholarship },
    { href: '/news', label: 'GLOWBAL News', icon: IconNews },
  ];
  if (user?.isMentor) {
    drawerItems.push({ href: '/dashboard/mentor', label: 'Mentor hub', icon: IconMentorHub });
  }
  if (user?.isCoordinator) {
    drawerItems.push({ href: '/coordinator', label: 'Coordinator', icon: IconCoordinator });
  }
  if (user?.isAdmin) {
    drawerItems.push({ href: '/admin', label: 'Admin', icon: IconAdmin });
  }

  return (
    <>
      <header className="glowbal-mobile-topbar">
        <Link href="/" aria-label="Glowbal home" className="glowbal-mobile-topbar-logo">
          <GlowbalLogo height={26} />
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="glowbal-mobile-menu-button"
          aria-label="Open menu"
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </header>

      {open && (
        <div className="glowbal-mobile-drawer-overlay" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            type="button"
            className="glowbal-mobile-drawer-scrim"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <div className="glowbal-mobile-drawer">
            <div className="glowbal-mobile-drawer-header">
              <GlowbalLogo height={28} />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="glowbal-mobile-drawer-close"
                aria-label="Close menu"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <nav className="glowbal-mobile-drawer-nav" aria-label="More navigation">
              {drawerItems.map((item) => {
                const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(`${item.href}/`));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`glowbal-mobile-drawer-item${active ? ' glowbal-mobile-drawer-item-active' : ''}`}
                  >
                    <span className="glowbal-mobile-drawer-item-icon"><Icon /></span>
                    <span>{t(item.label)}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="glowbal-mobile-drawer-footer">
              <button
                type="button"
                onClick={toggleLanguage}
                className="glowbal-mobile-drawer-lang"
                aria-label={`Switch to ${language === 'en' ? 'Vietnamese' : 'English'}`}
              >
                <span className="glowbal-mobile-drawer-item-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <circle cx="12" cy="12" r="10" />
                    <path d="M2 12h20" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                </span>
                <span>
                  {language === 'en' ? '🇬🇧 English' : '🇻🇳 Tiếng Việt'}
                </span>
                <span className="glowbal-mobile-drawer-lang-hint">{language === 'en' ? 'EN' : 'VI'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Desktop sidebar ──────────────────────────────────────────────────────────
type UserSummary = { name: string; avatarUrl?: string; isMentor?: boolean; isAdmin?: boolean; isCoordinator?: boolean };

function DesktopSidebar({
  user,
  collapsed,
  onToggleCollapsed,
}: {
  user: UserSummary | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const pathname = usePathname();
  const { t } = useLanguage();

  const baseItems = user ? NAV_ITEMS : NAV_ITEMS.filter((i) => !i.requiresAuth);
  let visibleItems = user?.isMentor ? [...baseItems, MENTOR_DASHBOARD_ITEM] : baseItems;

  // Add coordinator link to navigation if user has the coordinator role
  if (user?.isCoordinator) {
    visibleItems = [...visibleItems, COORDINATOR_ITEM];
  }

  // Add admin link to navigation if user is admin
  if (user?.isAdmin) {
    visibleItems = [...visibleItems, { href: '/admin', label: 'Admin', mobile: 'Admin', activeMatch: 'prefix' as const }];
  }

  return (
    <aside className={`glowbal-sidebar${collapsed ? ' is-collapsed' : ''}`}>
      {/* Animated brand gradient strip (pink → red → aqua → navy) */}
      <div className="glowbal-brand-strip-vertical" aria-hidden />

      <div className="glowbal-sidebar-inner">
        <div className="glowbal-sidebar-header">
          <Link href="/" aria-label="Glowbal home" className="glowbal-sidebar-logo">
            <GlowbalLogo height={32} />
          </Link>
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="glowbal-sidebar-toggle"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`glowbal-sidebar-toggle-icon${collapsed ? ' is-collapsed' : ''}`}
              aria-hidden
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        </div>

        <nav className="glowbal-sidebar-nav" aria-label="Primary">
          {visibleItems.map((item) => {
            const active = isActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`glowbal-sidebar-item${active ? ' glowbal-sidebar-item-active' : ''}`}
                title={collapsed ? t(item.label) : undefined}
              >
                <span className="glowbal-sidebar-item-icon">{SIDEBAR_ICONS[item.href] ? SIDEBAR_ICONS[item.href]() : <IconHome />}</span>
                <span className="glowbal-sidebar-item-label">{t(item.label)}</span>
              </Link>
            );
          })}
        </nav>

        <div className="glowbal-sidebar-footer">
          <LanguageSwitcher />
          <AccountPill user={user} />
        </div>
      </div>
    </aside>
  );
}

// ── Main nav controller ──────────────────────────────────────────────────────
export function NavReveal() {
  const pathname = usePathname();
  const [revealed, setRevealed] = useState(() => {
    if (typeof window === 'undefined') return false;
    const isLanding = window.location.pathname === '/';
    return !isLanding || localStorage.getItem('glowbal-nav-revealed') === 'true';
  });
  const [user, setUser] = useState<UserSummary | null>(null);

  // Sidebar starts expanded; collapsing to an icon rail is an explicit,
  // remembered user choice. Mirror the `revealed` pattern above and read the
  // stored preference in the initializer (localStorage is client-only).
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('glowbal-sidebar-collapsed') === 'true';
  });

  // Hide nav on home page regardless of revealed state
  const isHomePage = pathname === '/';

  // Reflect the collapsed state onto <body> so the CSS-driven main-content
  // margin shrinks in step with the sidebar instead of leaving dead space.
  useEffect(() => {
    document.body.classList.toggle('glowbal-sidebar-collapsed', collapsed);
    return () => {
      document.body.classList.remove('glowbal-sidebar-collapsed');
    };
  }, [collapsed]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('glowbal-sidebar-collapsed', String(next));
      return next;
    });
  }

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
      const [mentorResult, adminResult, coordinatorResult] = await Promise.all([
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
        // Coordinator status — same server-side pattern as admin so the
        // COORDINATOR_USER_IDS env bootstrap keeps working.
        fetch('/api/coordinator/check', { cache: 'no-store' })
          .then((r) => (r.ok ? r.json() : { isCoordinator: false }))
          .catch(() => ({ isCoordinator: false })) as Promise<{ isCoordinator: boolean }>,
      ]);
      setUser({
        name:
          (authUser.user_metadata?.full_name as string | undefined) ||
          authUser.email?.split('@')[0] ||
          'Profile',
        avatarUrl: authUser.user_metadata?.avatar_url as string | undefined,
        isMentor: !!mentorResult.data,
        isAdmin: adminResult.isAdmin === true,
        isCoordinator: coordinatorResult.isCoordinator === true,
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

  if (!revealed || isHomePage) return null;

  return (
    <>
      <DesktopSidebar user={user} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      <MobileTopBar user={user} />
      <MobileNav user={user} />
    </>
  );
}
