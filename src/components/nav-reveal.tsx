'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GlowbalLogo } from '@/components/glowbal-logo';
import { useLanguage } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/client';
import { TID, testId } from '@/shared/lib';
import { MobileNav, type MobileNavItem } from '@/shared/ui';

/* ─────────────────────────────────────────────────────────────────────────
   Persisted nav preferences
   ────────────────────────────────────────────────────────────────────────
   These live in localStorage, which the server cannot see. Reading them in a
   useState initializer (the previous approach) made the server and the client
   render different markup, and React responds to a hydration mismatch by
   discarding the server HTML and re-rendering the whole tree on the client —
   so SSR was being thrown away on every page except the landing page.

   useSyncExternalStore is the primitive for exactly this: it takes a separate
   server snapshot, so the first client render provably matches the server, and
   React re-reads the real value immediately afterwards.
───────────────────────────────────────────────────────────────────────── */

const NAV_PREF_EVENT = 'glowbal:nav-pref-changed';

function subscribeToNavPrefs(onChange: () => void) {
  // `storage` covers changes from other tabs; the custom event covers writes
  // made by this tab, which `storage` deliberately does not fire for.
  window.addEventListener('storage', onChange);
  window.addEventListener(NAV_PREF_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(NAV_PREF_EVENT, onChange);
  };
}

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'true';
  } catch {
    // Private mode / storage blocked — fall back to the default.
    return false;
  }
}

function writeFlag(key: string, value: boolean) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* storage blocked — the change still applies for this session */
  }
  window.dispatchEvent(new Event(NAV_PREF_EVENT));
}

/** A boolean localStorage flag, hydration-safe (server snapshot is always false). */
function useNavPrefFlag(key: string): boolean {
  const getSnapshot = useCallback(() => readFlag(key), [key]);
  return useSyncExternalStore(subscribeToNavPrefs, getSnapshot, () => false);
}

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

/*
 * `mobile` used to hold the abbreviated caption for the bottom tab bar ("Fund",
 * "News"). That bar is gone; the hamburger sheet is a full-width list, so the
 * field now carries the longer wording from the designer's mobile mockup.
 */
const NAV_ITEMS = [
  { href: '/',                label: 'Home',          mobile: 'Home',               activeMatch: 'exact' as const },
  { href: '/universities',    label: 'Search',        mobile: 'Search universities', activeMatch: 'prefix' as const },
  { href: '/apply',           label: 'Apply',         mobile: 'Plan your studies',  activeMatch: 'prefix' as const, requiresAuth: true },
  { href: '/scholarships',    label: 'Scholarships',  mobile: 'Scholarships',       activeMatch: 'prefix' as const, requiresAuth: true },
  { href: '/mentors',         label: 'Mentorship',    mobile: 'Mentorship',         activeMatch: 'prefix' as const },
  { href: '/news',            label: 'GLOWBAL News',  mobile: 'GLOWBAL News',       activeMatch: 'prefix' as const },
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

const ADMIN_ITEM = {
  href: '/admin',
  label: 'Admin',
  mobile: 'Admin',
  activeMatch: 'prefix' as const,
};

type NavItem = {
  href: string;
  label: string;
  mobile: string;
  activeMatch: 'exact' | 'prefix';
  requiresAuth?: boolean;
};

/**
 * The destinations this user can see, in order.
 *
 * Desktop and mobile derive from this same list so the two navigations can
 * never drift — previously the sidebar, the bottom tab bar, and the hamburger
 * drawer each kept their own hand-written subset, and none of the three agreed.
 */
function navItemsFor(user: UserSummary | null): NavItem[] {
  const items: NavItem[] = user ? [...NAV_ITEMS] : NAV_ITEMS.filter((i) => !i.requiresAuth);
  if (user?.isMentor) items.push(MENTOR_DASHBOARD_ITEM);
  if (user?.isCoordinator) items.push(COORDINATOR_ITEM);
  if (user?.isAdmin) items.push(ADMIN_ITEM);
  return items;
}

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

// ── Mobile navigation ────────────────────────────────────────────────────────
/**
 * Adapts the app's nav model onto the shared mobile header from the redesign.
 *
 * This replaces two components: a bottom tab bar and a separate top bar with
 * its own drawer, which rendered stacked on top of each other on every mobile
 * page. The designer confirmed the redesign collapses navigation into a single
 * hamburger, so the destinations they carried between them all land here.
 */
function MobileNavigation({ user }: { user: UserSummary | null }) {
  const { t, lang: language, toggle: toggleLanguage } = useLanguage();

  const items: MobileNavItem[] = navItemsFor(user).map((item) => ({
    href: item.href,
    label: t(item.mobile),
  }));

  return (
    <MobileNav
      logo={
        <Link href="/" aria-label="Glowbal home" className="inline-flex items-center">
          <GlowbalLogo height={28} />
        </Link>
      }
      items={items}
      primaryAction={{ href: '/apply', label: t('Plan your studies') }}
      secondaryAction={
        user
          ? { href: '/profile', label: t('Profile') }
          : { href: '/auth', label: t('Sign in') }
      }
      openLabel={t('Menu')}
      closeLabel={t('Close menu')}
      utility={
        <button
          type="button"
          onClick={toggleLanguage}
          className="mb-gb-lg flex w-full items-center justify-between rounded-gb-md px-gb-lg py-gb-md text-gb-sm font-medium text-fg-tertiary transition-colors hover:bg-surface-hover"
          aria-label={`Switch to ${language === 'en' ? 'Vietnamese' : 'English'}`}
        >
          <span>{language === 'en' ? '🇬🇧 English' : '🇻🇳 Tiếng Việt'}</span>
          <span className="text-gb-xs font-semibold tracking-wide text-fg-muted">
            {language === 'en' ? 'EN' : 'VI'}
          </span>
        </button>
      }
    />
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

  const visibleItems = navItemsFor(user);

  return (
    <aside className={`glowbal-sidebar${collapsed ? ' is-collapsed' : ''}`} {...testId(TID.navHeader)}>
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
  const [user, setUser] = useState<UserSummary | null>(null);

  // Hide nav on home page regardless of revealed state
  const isHomePage = pathname === '/';

  /*
   * Pages that ship their own header. The redesigned pages carry the TopNav +
   * MobileNav + Footer chrome themselves (the /dev/home pattern), so the app
   * chrome must not double up — two headers would also put two elements behind
   * the `nav-header` test id, which the contract in shared/lib/testids.ts
   * forbids, and two mobile navs is exactly the regression mobile-nav.spec.ts
   * guards against.
   *
   * `/universities` matches exactly, not by prefix: the in-page detail view
   * lives at the same path (`?u=<id>`), while the legacy `/universities/vinuni`
   * static page still relies on the app chrome.
   *
   * `/auth` shows no app chrome at all in the redesign — the Figma frames are a
   * bare centered card — so the sidebar and mobile nav are suppressed here too.
   *
   * Two lists, because "rebuilt" arrives at different depths. EXACT is the
   * default and stays the default: most rebuilt pages still have legacy child
   * routes underneath that need the app chrome. PREFIX is only for subtrees
   * where every descendant is rebuilt — matching those by prefix is what stops
   * this list needing a new entry per dynamic segment.
   */
  const OWN_CHROME_ROUTES = new Set([
    '/',
    '/dev/home',
    '/universities',
    '/auth',
    // Pre-launch site lock (LAUNCH_PLAN.md) — bare centered card, same
    // treatment as /auth, no app chrome to double up.
    '/coming-soon',
    '/onboarding',
    '/about',
    // Exact match, like /universities: the Blog LIST is rebuilt (Figma
    // 153:18266) but /guides/[slug] is not yet, so the detail pages keep the
    // app chrome until 153:20197 is built.
    '/guides',
    // Also exact: the saved list is rebuilt (Figma 223:8824), the
    // /my-universities/[id] task pages under it are not.
    '/my-universities',
    // Same again: the applications list is rebuilt (Figma 337:18767), the
    // /apply/[applicationId] workspace under it is not.
    '/apply',
    // And again: the mentor browse is rebuilt (Figma 154:8345); /mentors/[id],
    // /mentors/apply and its success page are not.
    '/mentors',
    '/dev/saved-list',
  ]);

  /*
   * Subtrees where every descendant ships its own chrome, matched by prefix.
   *
   * Keep this list short and only add a path once its WHOLE tree is rebuilt —
   * a prefix entry silently covers routes that do not exist yet, so a legacy
   * page added underneath one would lose its navigation with nothing to say so.
   */
  const OWN_CHROME_PREFIXES = ['/ai-strategy'];

  const rendersOwnChrome =
    OWN_CHROME_ROUTES.has(pathname) ||
    OWN_CHROME_PREFIXES.some((base) => pathname === base || pathname.startsWith(`${base}/`));

  /*
   * The reveal gate only ever mattered for the landing page: everywhere else
   * the nav is always shown, and `pathname` is known during SSR. So the server
   * renders the correct markup directly, and the only genuinely client-known
   * bits — the stored preferences — come from useNavPrefFlag, whose server
   * snapshot matches the server render by construction.
   */

  // Landing page only: hidden until revealed, which persists across visits.
  const revealedOnLanding = useNavPrefFlag('glowbal-nav-revealed');

  // Sidebar starts expanded; collapsing to an icon rail is a remembered choice.
  const collapsed = useNavPrefFlag('glowbal-sidebar-collapsed');

  // Reflect the collapsed state onto <body> so the CSS-driven main-content
  // margin shrinks in step with the sidebar instead of leaving dead space.
  useEffect(() => {
    document.body.classList.toggle('glowbal-sidebar-collapsed', collapsed);
    return () => {
      document.body.classList.remove('glowbal-sidebar-collapsed');
    };
  }, [collapsed]);

  function toggleCollapsed() {
    // Write-through: localStorage is the source of truth, and the notify makes
    // useSyncExternalStore re-read it.
    writeFlag('glowbal-sidebar-collapsed', !collapsed);
  }

  useEffect(() => {
    function onReveal() {
      writeFlag('glowbal-nav-revealed', true);
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      loadUser(session?.user ?? null);

      // Record a login once per browser session. @supabase/ssr fires
      // INITIAL_SESSION (not SIGNED_IN) when restoring a session, so this only
      // logs on an actual sign-in; the sessionStorage flag guards against
      // SIGNED_IN repeats from token refreshes / multiple tabs. Best-effort.
      try {
        if (event === 'SIGNED_IN' && session?.user) {
          if (sessionStorage.getItem('gb_login_logged') !== '1') {
            sessionStorage.setItem('gb_login_logged', '1');
            fetch('/api/auth/login-event', { method: 'POST' }).catch(() => {});
          }
        } else if (event === 'SIGNED_OUT') {
          sessionStorage.removeItem('gb_login_logged');
        }
      } catch {
        /* sessionStorage unavailable — skip login logging */
      }
    });

    return () => {
      window.removeEventListener('glowbal:reveal-nav', onReveal);
      subscription.unsubscribe();
    };
  }, []);

  // Non-landing pages always show the nav, and the server knows that, so the
  // first client render matches the server HTML exactly.
  if (rendersOwnChrome) return null;
  if (isHomePage && !revealedOnLanding) return null;

  return (
    <>
      <DesktopSidebar user={user} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      <MobileNavigation user={user} />
    </>
  );
}
