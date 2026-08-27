'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GlowbalLogo } from '@/components/glowbal-logo';
import {
  useNavigationRoles,
  withNavigationRoleItems,
  type NavigationRoles,
} from '@/components/navigation-roles';
import { useNavigationSession, type NavigationSessionValue } from '@/components/navigation-session';
import { SavedNavLink } from '@/components/saved-nav-link';
import { getMarketingNavPresentation } from '@/features/marketing/ui';
import { useLanguage } from '@/lib/i18n';
import { MobileNav, type MobileNavEntry } from '@/shared/ui/mobile-nav';
import { isNavGroup } from '@/shared/ui/nav-model';
import { TopNav } from '@/shared/ui/top-nav';
import { suppressesGlobalNavigation } from './navigation-visibility';

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
 * The destinations this user can see, in order.
 *
 * ⚠️ THE SEVEN-ITEM APP LIST THAT USED TO LIVE HERE IS GONE (01/08). It named
 * the same destinations as `MARKETING_NAV_ITEMS` under different labels, in a
 * different order, with a `mobile` field that differed again — so a signed-in
 * student crossing from `/apply` (own chrome, marketing list) to `/scholarships`
 * (this chrome, app list) watched the whole bar rewrite itself. The owner asked
 * for one menu for both audiences, which makes that list redundant rather than
 * merely inconsistent.
 *
 * Two things went with it and are worth knowing:
 *  - **`requiresAuth` is gone.** It hid `/apply` and `/scholarships` from
 *    guests; the marketing list deliberately shows them (owner, 31/07 — the
 *    links are how a guest finds out the features exist, and each page forces
 *    sign-in when opened).
 * The supplied navigation matrix now explicitly includes Home. Role extras are
 * appended, not merged, so they always sit after the audience's shared entries.
 */
function navEntriesFor(
  roles: NavigationRoles | null,
  t: (key: string) => string,
  session: Pick<NavigationSessionValue, 'ready' | 'signedIn' | 'completed'>,
): MobileNavEntry[] {
  const audience = session.ready
    ? { signedIn: session.signedIn, completed: session.completed }
    : { signedIn: true, completed: true };
  const shared: MobileNavEntry[] = getMarketingNavPresentation(audience, t).items.map((entry) =>
    isNavGroup(entry)
      ? { label: entry.label, items: [...entry.items] }
      : { href: entry.href, label: entry.label },
  );

  return withNavigationRoleItems(shared, roles, t);
}

/*
 * The EN / VI toggle that used to be defined here is now
 * `src/shared/ui/language-switcher.tsx`, rendered by `TopNav` and `MobileNav`
 * themselves. It lived here because this was the only header that had one — and
 * that WAS the bug: fifteen pages ship their own header and none of them
 * remembered to fill the `utility` slot, so `/profile` and `/scholarships` were
 * the only two pages on the site where a Vietnamese student could switch
 * language. Do not pass one into `utility` from here or it renders twice.
 */

// ── Mobile navigation ────────────────────────────────────────────────────────
/**
 * Adapts the app's nav model onto the shared mobile header from the redesign.
 *
 * This replaces two components: a bottom tab bar and a separate top bar with
 * its own drawer, which rendered stacked on top of each other on every mobile
 * page. The designer confirmed the redesign collapses navigation into a single
 * hamburger, so the destinations they carried between them all land here.
 */
function MobileNavigation({
  roles,
  session,
}: {
  roles: NavigationRoles | null;
  session: NavigationSessionValue;
}) {
  const { t } = useLanguage();

  const presentation = getMarketingNavPresentation(
    session.ready
      ? { signedIn: session.signedIn, completed: session.completed }
      : { signedIn: true, completed: true },
    t,
  );
  const items = navEntriesFor(roles, t, session);

  return (
    <MobileNav
      logo={
        <Link href="/" aria-label="Glowbal home" className="inline-flex items-center">
          <GlowbalLogo height={28} />
        </Link>
      }
      items={items}
      primaryAction={session.ready ? presentation.primaryAction : undefined}
      secondaryAction={session.ready ? presentation.accountAction : undefined}
      openLabel={t('Menu')}
      closeLabel={t('Close menu')}
      utility={<SavedNavLink variant="row" />}
    />
  );
}

// ── Desktop header ───────────────────────────────────────────────────────────
type UserSummary = {
  id: string;
  name: string;
  avatarUrl?: string;
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
function AppTopNav({
  user,
  roles,
  session,
}: {
  user: UserSummary | null;
  roles: NavigationRoles | null;
  session: NavigationSessionValue;
}) {
  const { t } = useLanguage();

  const presentation = getMarketingNavPresentation(
    session.ready
      ? { signedIn: session.signedIn, completed: session.completed }
      : { signedIn: true, completed: true },
    t,
  );
  const items = navEntriesFor(roles, t, session);

  return (
    <TopNav
      tone="light"
      logo={<GlowbalLogo height={28} />}
      items={items}
      primaryAction={session.ready ? presentation.primaryAction : undefined}
      utility={<SavedNavLink />}
      {...(user
        ? {
            user: {
              name: user.name,
              avatarUrl: user.avatarUrl,
              href: presentation.accountAction.href,
            },
          }
        : session.ready
          ? { secondaryAction: presentation.accountAction }
          : {})}
    />
  );
}

// ── Main nav controller ──────────────────────────────────────────────────────
export function NavReveal() {
  const pathname = usePathname();
  const navigationSession = useNavigationSession();
  const roles = useNavigationRoles();

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
    // Pre-launch site lock — bare centered card, same
    // treatment as /auth, no app chrome to double up.
    '/coming-soon',
    '/onboarding',
    '/about',
    // Exact match, like /universities: the Blog LIST is rebuilt (Figma
    // 153:18266) but /news/[slug] is not yet, so the detail pages keep the
    // app chrome until 153:20197 is built. Was '/guides' until the two blog
    // routes were merged onto /news on 31/07.
    '/news',
    /*
     * The "Chọn lại ngành" subject picker (Figma 375:13546).
     *
     * `/my-universities` itself is gone — the saved list merged into /apply
     * (Figma 562:15078) and the bare path now 308s there. This entry is what is
     * left of that subtree that ships its own chrome; the [id] task pages
     * beside it are still on the app chrome, which is why this is an exact
     * match and not a /my-universities prefix.
     */
    '/my-universities/program',
    // The merged "Application Progress" page — My application above the saved
    // list. The workspace under it is covered by the prefix rule below rather
    // than listed here.
    '/apply',
    // And again: the mentor browse is rebuilt (Figma 154:8345). /mentors/[id]
    // is now rebuilt too and is matched below by its uuid, but /mentors/apply
    // and its success page still take the app chrome, so this stays exact.
    '/advisors',
    '/dev/saved-list',
    // The AI strategy journey's entry page ships TopNav + MobileNav + Footer.
    '/ai-strategy',
    // The product help page, split off /ai-strategy on 03/08. Same chrome, so
    // without this entry it would get the app header on top of its own.
    '/how-it-works',
    /*
     * GlowBal Plus. Rebuilt on the design system 02/08 (there is no Figma frame
     * for it — see the header of src/app/plus/page.tsx) and it ships its own
     * TopNav + MobileNav + Footer.
     *
     * /plus/success is listed separately rather than as a prefix, and stays a
     * bare centred card with no navigation at all: it is the return leg of a
     * Stripe redirect that ACTIVATES a subscription on render, and a header full
     * of links is an invitation to navigate away mid-write.
     */
    '/plus',
    '/plus/success',
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
  const OWN_CHROME_PREFIXES = ['/ai-strategy'];

  // The dashboard owns its header; its document workspaces use the shared one.
  const isApplicationWorkspaceRoute = /^\/apply\/[^/]+$/.test(pathname);

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
    /^\/advisors\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pathname);

  const rendersOwnChrome =
    suppressesGlobalNavigation(pathname) ||
    OWN_CHROME_ROUTES.has(pathname) ||
    isApplicationWorkspaceRoute ||
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

    return () => {
      window.removeEventListener('glowbal:reveal-nav', onReveal);
    };
  }, []);

  // Non-landing pages always show the nav, and the server knows that, so the
  // first client render matches the server HTML exactly.
  if (rendersOwnChrome) return null;
  if (isHomePage && !revealedOnLanding) return null;

  return (
    <div data-global-navigation>
      <AppTopNav
        user={navigationSession.user}
        roles={roles}
        session={navigationSession}
      />
      <MobileNavigation
        roles={roles}
        session={navigationSession}
      />
    </div>
  );
}
