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

function isActive(pathname: string, item: { href: string; activeMatch: 'exact' | 'prefix' }) {
  if (item.activeMatch === 'exact') return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

// ── Mobile bottom-nav icons (kept simple, theme-friendly) ────────────────────
function IconHome()         { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>; }
function IconSearch()       { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>; }
function IconApply()        { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>; }
function IconScholarship()  { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="5"/><path d="m8.5 12.5-1.5 8 5-2.75 5 2.75-1.5-8"/></svg>; }
function IconMentorship()   { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }
function IconMentorHub()    { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 4 7v10l8 5 8-5V7l-8-5z"/><path d="M4 7l8 5 8-5"/><path d="M12 22V12"/></svg>; }
function IconNews()         { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8z"/></svg>; }
function IconUser()         { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>; }
function IconAdmin()        { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L4 6v6c0 5 3.5 9.5 8 10 4.5-.5 8-5 8-10V6z"/><path d="M9 12l2 2 4-4"/></svg>; }

const MOBILE_ICONS: Record<string, () => React.JSX.Element> = {
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
    <Link href="/auth" className="glowbal-nav-pill glowbal-nav-pill-account">
      {t('Sign In/Up')}
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
            <span>English</span>
          </>
        ) : (
          <>
            <span className="glowbal-language-flag">🇻🇳</span>
            <span>Tiếng Việt</span>
          </>
        )}
      </span>
      <span className="glowbal-language-arrow">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </span>
    </button>
  );
}

// ── Mobile language button ───────────────────────────────────────────────────
// Floating pill above the bottom nav so mobile users can switch language too —
// the desktop switcher lives in the sidebar, which is hidden on mobile.
function MobileLanguageButton() {
  const { lang: language, toggle: toggleLanguage } = useLanguage();

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className="glowbal-mobile-language-button md:hidden"
      aria-label={`Switch to ${language === 'en' ? 'Vietnamese' : 'English'}`}
      title={`Switch to ${language === 'en' ? 'Vietnamese' : 'English'}`}
    >
      <span className="glowbal-mobile-language-flag">{language === 'en' ? '🇬🇧' : '🇻🇳'}</span>
      <span className="glowbal-mobile-language-text">{language === 'en' ? 'EN' : 'VI'}</span>
    </button>
  );
}

// ── Desktop sidebar ──────────────────────────────────────────────────────────
type UserSummary = { name: string; avatarUrl?: string; isMentor?: boolean; isAdmin?: boolean };

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

  // Add admin link to navigation if user is admin
  if (user?.isAdmin) {
    visibleItems = [...visibleItems, { href: '/admin', label: 'Admin', mobile: 'Admin', activeMatch: 'prefix' as const }];
  }

  return (
    <aside className={`glowbal-sidebar hidden md:flex${collapsed ? ' is-collapsed' : ''}`}>
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
                <span className="glowbal-sidebar-item-icon">{MOBILE_ICONS[item.href] ? MOBILE_ICONS[item.href]() : <IconHome />}</span>
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

  if (!revealed || isHomePage) return null;

  return (
    <>
      <DesktopSidebar user={user} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      <MobileNav user={user} />
      <MobileLanguageButton />
    </>
  );
}
