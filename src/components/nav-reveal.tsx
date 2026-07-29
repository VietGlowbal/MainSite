'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GlowbalLogo } from '@/components/glowbal-logo';
import { useLanguage } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/client';
import { MobileNav, TopNav, type MobileNavItem } from '@/shared/ui';

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

// ── Language Switcher ────────────────────────────────────────────────────────
/**
 * EN / VI toggle for the desktop header.
 *
 * Restyled with tokens rather than kept on `.glowbal-language-switcher`: that
 * rule is `width: 100%` with a hover lift, sized for the sidebar footer it used
 * to sit in, and it is one of the legacy selectors CLAUDE.md quarantines.
 *
 * The flag stays but the language name goes — a header has no room for
 * "Tiếng Việt" beside five nav items and two buttons, and the two-letter code
 * is what the mobile sheet already shows.
 */
function LanguageSwitcher() {
  const { lang: language, toggle: toggleLanguage } = useLanguage();
  const next = language === 'en' ? 'Vietnamese' : 'English';

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      aria-label={`Switch to ${next}`}
      title={`Switch to ${next}`}
      className="flex items-center gap-gb-sm rounded-gb-md border border-line px-gb-lg py-gb-sm text-gb-sm font-semibold text-fg-secondary transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <span aria-hidden="true">{language === 'en' ? '🇬🇧' : '🇻🇳'}</span>
      <span>{language === 'en' ? 'EN' : 'VI'}</span>
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

// ── Desktop header ───────────────────────────────────────────────────────────
type UserSummary = {
  name: string;
  avatarUrl?: string;
  isMentor?: boolean;
  isAdmin?: boolean;
  isCoordinator?: boolean;
};

/**
 * The app's desktop header.
 *
 * REPLACES THE SIDEBAR. A fixed 240px rail used to sit down the left of every
 * page that did not ship its own chrome, with `.glowbal-main-content` carrying
 * a matching `margin-left` and a collapsed 76px variant remembered in
 * localStorage. All of that is gone; the design is a top bar everywhere.
 *
 * It is the shared `TopNav`, not a second header component — the rebuilt pages
 * (/universities, /apply, /ai-strategy) already ship that one themselves, and
 * having the app chrome draw a lookalike is how the two drift apart. Those
 * pages still render their own and this returns null for them, which is what
 * keeps a single element behind the `nav-header` test id.
 *
 * `tone="light"`: the dark bar belongs to the marketing pages. Signed-in app
 * pages are content, and the light frame (105:8301) is the one for those.
 */
function AppTopNav({ user }: { user: UserSummary | null }) {
  const { t } = useLanguage();

  const items = navItemsFor(user).map((item) => ({
    href: item.href,
    label: t(item.label),
  }));

  return (
    <TopNav
      tone="light"
      logo={<GlowbalLogo height={28} />}
      items={items}
      primaryAction={{ href: '/apply', label: t('Plan your studies') }}
      utility={<LanguageSwitcher />}
      {...(user
        ? { user: { name: user.name, avatarUrl: user.avatarUrl, href: '/profile' } }
        : { secondaryAction: { href: '/auth', label: t('Sign in') } })}
    />
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
    // The applications list. The workspace under it is covered by the prefix
    // rule below rather than listed here.
    '/apply',
    // And again: the mentor browse is rebuilt (Figma 154:8345). /mentors/[id]
    // is now rebuilt too and is matched below by its uuid, but /mentors/apply
    // and its success page still take the app chrome, so this stays exact.
    '/mentors',
    '/dev/saved-list',
    // The AI strategy journey's entry page ships TopNav + MobileNav + Footer.
    '/ai-strategy',
    // Previews the workspace, which ships its own chrome. Listed for the same
    // reason as the two above: a dev route that renders the app chrome as well
    // would preview a page nobody can navigate to.
    '/dev/apply-workspace',
  ]);

  /*
   * Subtrees where every descendant ships its own chrome, matched by prefix.
   *
   * Keep this list short and only add a path once its WHOLE tree is rebuilt —
   * a prefix entry silently covers routes that do not exist yet, so a legacy
   * page added underneath one would lose its navigation with nothing to say so.
   */
  const OWN_CHROME_PREFIXES = [
    '/ai-strategy',
    /*
     * `/apply` and everything under it. The per-course workspace was rebuilt
     * with its own chrome in #85/#86 and this prefix went with it, but the
     * mentor-detail change (536755a) restructured this list and dropped it —
     * which put the app header AND the workspace's own header on the same page.
     * The whole tree is rebuilt, so the prefix is correct.
     */
    '/apply',
  ];

  /*
   * `/universities/<id>` — the rebuilt detail page (Figma 375:10629) — ships
   * its own chrome, but `/universities/vinuni` next door still uses the app
   * chrome, so this cannot be a plain prefix. Matching digits separates them:
   * the new route is keyed on the numeric id because `universities` has no slug
   * column. When vinuni is retired this can become a prefix entry.
   */
  const isNumericUniversityRoute = /^\/universities\/\d+$/.test(pathname);

  /*
   * `/mentors/<uuid>` — the rebuilt profile page (Figma 375:21633). Same
   * problem as /universities above and the same solution: `/mentors/apply` and
   * `/mentors/apply/success` sit next door and still use the app chrome, so a
   * prefix would strip the navigation off them. Mentor ids are uuids, which is
   * what separates the two — `apply` cannot match this shape.
   */
  const isMentorProfileRoute =
    /^\/mentors\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pathname);

  const rendersOwnChrome =
    OWN_CHROME_ROUTES.has(pathname) ||
    isNumericUniversityRoute ||
    isMentorProfileRoute ||
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
      <AppTopNav user={user} />
      <MobileNavigation user={user} />
    </>
  );
}
