/**
 * The route registry — one description of where things are, read by both the
 * breadcrumbs and the application sub-navigation.
 *
 * ─── WHY A REGISTRY AND NOT PER-PAGE BREADCRUMBS ─────────────────────────────
 *
 * Breadcrumbs written page by page go stale the moment a route moves, and they
 * go stale silently: the trail still renders, it just points somewhere that no
 * longer exists. Worse, two pages in the same subtree end up describing their
 * shared parent differently. A table means a moved route is one edit, and a
 * page that forgets to declare a trail still gets a correct one.
 *
 * ─── IT IS PURE, AND IT LIVES IN `shared` ────────────────────────────────────
 *
 * No React, no imports from `features/` or `app/` — only strings and pattern
 * matching, which is what lets `shared` hold it without breaking the FSD rule
 * that shared may not depend on features. Anything needing real data (a course
 * name, a university name) is passed in as a label override by the page that
 * already has it.
 *
 * ─── DYNAMIC SEGMENTS ────────────────────────────────────────────────────────
 *
 * A trail cannot invent a course's name from its id. Every pattern that
 * contains one declares a `dynamic` entry: a `key` a caller can pass a real
 * name under, and a `fallback` — the honest generic word — for when nobody
 * does. A page that knows the real name should pass it; a page that does not
 * still renders something true.
 */

export type Crumb = {
  label: string;
  /** Absent on the final crumb — you are already there. */
  href?: string;
};

/**
 * A route pattern. `:id` matches one path segment.
 *
 * Order matters: the first match wins, so the most specific patterns are listed
 * first. That is why this is an array and not an object.
 */
type RoutePattern = {
  pattern: string;
  /** Crumb labels from the root down to and including this route. */
  trail: readonly string[];
  /**
   * Which crumbs correspond to a dynamic segment, keyed by trail index.
   *
   * `key` is what a caller passes in `labels`; `fallback` is what shows when
   * they do not. THE TWO ARE SEPARATE FIELDS ON PURPOSE — deriving the key by
   * lowercasing the fallback was the first version, and it meant renaming a
   * display label silently broke every caller passing the old key. It also
   * chained the label to the translation dictionary, where "Application"
   * already means the act of applying rather than the thing being applied to.
   */
  dynamic?: Readonly<Record<number, { key: string; fallback: string }>>;
};

/** The key a caller passes in `labels` to name a dynamic crumb. */
export const APPLICATION_LABEL_KEY = 'application';

/**
 * Every route a student can reach and navigate back from.
 *
 * Admin, coordinator and dev routes are deliberately absent — they are tools,
 * not journeys, and a breadcrumb implying `/admin` is a place students belong
 * would be worse than no breadcrumb.
 */
const ROUTES: readonly RoutePattern[] = [
  // ── The strategy journey, deepest first ──────────────────────────────────
  {
    pattern: '/ai-strategy/:id/strategy/recommendations/:recId',
    trail: ['My Portal', 'Your application', 'Planner', 'Task'],
    dynamic: {
      1: { key: APPLICATION_LABEL_KEY, fallback: 'Your application' },
      3: { key: 'task', fallback: 'Task' },
    },
  },
  {
    pattern: '/ai-strategy/:id/strategy/analysis/portrait',
    trail: ['My Portal', 'Your application', 'Personal Report'],
    dynamic: { 1: { key: APPLICATION_LABEL_KEY, fallback: 'Your application' } },
  },
  {
    pattern: '/ai-strategy/:id/strategy/analysis/fit',
    trail: ['My Portal', 'Your application', 'GlowBal Matching Report'],
    dynamic: { 1: { key: APPLICATION_LABEL_KEY, fallback: 'Your application' } },
  },
  {
    pattern: '/ai-strategy/:id/strategy/analysis',
    trail: ['My Portal', 'Your application', 'AI Analysis'],
    dynamic: { 1: { key: APPLICATION_LABEL_KEY, fallback: 'Your application' } },
  },
  {
    pattern: '/ai-strategy/:id/strategy/dashboard',
    trail: ['My Portal', 'Your application', 'Planner'],
    dynamic: { 1: { key: APPLICATION_LABEL_KEY, fallback: 'Your application' } },
  },
  {
    pattern: '/ai-strategy/:id/strategy/intro',
    trail: ['My Portal', 'Your application', 'Your Strategy'],
    dynamic: { 1: { key: APPLICATION_LABEL_KEY, fallback: 'Your application' } },
  },
  {
    pattern: '/ai-strategy/:id/strategy',
    trail: ['My Portal', 'Your application', 'Strategy'],
    dynamic: { 1: { key: APPLICATION_LABEL_KEY, fallback: 'Your application' } },
  },
  {
    pattern: '/ai-strategy/:id/cv/:step',
    trail: ['My Portal', 'Your application', 'CV builder'],
    dynamic: { 1: { key: APPLICATION_LABEL_KEY, fallback: 'Your application' } },
  },
  {
    pattern: '/ai-strategy/:id/statement',
    trail: ['My Portal', 'Your application', 'Statement writer'],
    dynamic: { 1: { key: APPLICATION_LABEL_KEY, fallback: 'Your application' } },
  },
  {
    pattern: '/ai-strategy/reflection/achievements',
    trail: ['My Portal', 'Reflections', 'Achievements'],
  },
  { pattern: '/ai-strategy/reflection', trail: ['My Portal', 'Reflections'] },
  /*
   * Split on 03/08: /how-it-works explains the whole product, /ai-strategy is
   * stage 3 on its own. The Strategy page hangs off the help page, which is
   * both where the nav sends a student and where its own "See the whole
   * journey" button goes — so the crumb out matches the two links they can see.
   */
  { pattern: '/ai-strategy', trail: ['How GlowBal works', 'GlowBal Strategy'] },
  { pattern: '/how-it-works', trail: ['How GlowBal works'] },

  // ── My Portal ────────────────────────────────────────────────────────────
  {
    pattern: '/apply/:id',
    trail: ['My Portal', 'Your application'],
    dynamic: { 1: { key: APPLICATION_LABEL_KEY, fallback: 'Your application' } },
  },
  { pattern: '/apply', trail: ['My Portal'] },
  { pattern: '/my-universities/program', trail: ['My Portal', 'Choose your subject'] },

  // ── Discovery ────────────────────────────────────────────────────────────
  { pattern: '/universities/:id', trail: ['Universities', 'University'], dynamic: { 1: { key: 'university', fallback: 'University' } } },
  { pattern: '/universities', trail: ['Universities'] },
  { pattern: '/scholarships', trail: ['Scholarships'] },
  { pattern: '/mentors/apply/success', trail: ['Mentors', 'Become a mentor', 'Application sent'] },
  { pattern: '/mentors/apply', trail: ['Mentors', 'Become a mentor'] },
  { pattern: '/mentors/:id', trail: ['Mentors', 'Mentor'], dynamic: { 1: { key: 'mentor', fallback: 'Mentor' } } },
  { pattern: '/mentors', trail: ['Mentors'] },
  { pattern: '/news/:slug', trail: ['News', 'Article'], dynamic: { 1: { key: 'article', fallback: 'Article' } } },
  { pattern: '/news', trail: ['News'] },

  // ── Account ──────────────────────────────────────────────────────────────
  { pattern: '/plus/success', trail: ['GlowBal Plus', 'Welcome'] },
  { pattern: '/plus', trail: ['GlowBal Plus'] },
  { pattern: '/profile', trail: ['Profile'] },
  { pattern: '/about', trail: ['About us'] },
];

/**
 * The href for each crumb depth, per route.
 *
 * A trail's parents are NOT derived by chopping the pathname: `/ai-strategy/x/
 * strategy/analysis/portrait` has "My Portal" as its grandparent, which is
 * `/apply` and shares no prefix with it at all. The journey's shape and the
 * URL's shape are different things, and pretending otherwise is how a "back"
 * link lands on a 404.
 */
const CRUMB_HREFS: readonly { pattern: string; hrefs: readonly (string | null)[] }[] = [
  // Strategy pages: My Portal → the application workspace → this page.
  { pattern: '/ai-strategy/:id/strategy/recommendations/:recId', hrefs: ['/apply', '/apply/:id', '/ai-strategy/:id/strategy/dashboard', null] },
  { pattern: '/ai-strategy/:id/strategy/analysis/portrait', hrefs: ['/apply', '/apply/:id', null] },
  { pattern: '/ai-strategy/:id/strategy/analysis/fit', hrefs: ['/apply', '/apply/:id', null] },
  { pattern: '/ai-strategy/:id/strategy/analysis', hrefs: ['/apply', '/apply/:id', null] },
  { pattern: '/ai-strategy/:id/strategy/dashboard', hrefs: ['/apply', '/apply/:id', null] },
  { pattern: '/ai-strategy/:id/strategy/intro', hrefs: ['/apply', '/apply/:id', null] },
  { pattern: '/ai-strategy/:id/strategy', hrefs: ['/apply', '/apply/:id', null] },
  { pattern: '/ai-strategy/:id/cv/:step', hrefs: ['/apply', '/apply/:id', null] },
  { pattern: '/ai-strategy/:id/statement', hrefs: ['/apply', '/apply/:id', null] },
  { pattern: '/ai-strategy/reflection/achievements', hrefs: ['/apply', '/ai-strategy/reflection', null] },
  { pattern: '/ai-strategy/reflection', hrefs: ['/apply', null] },
  // Stage 3's explainer, under the help page it was split out of on 03/08.
  { pattern: '/ai-strategy', hrefs: ['/how-it-works', null] },
  { pattern: '/apply/:id', hrefs: ['/apply', null] },
  { pattern: '/my-universities/program', hrefs: ['/apply', null] },
  { pattern: '/universities/:id', hrefs: ['/universities', null] },
  { pattern: '/mentors/apply/success', hrefs: ['/mentors', '/mentors/apply', null] },
  { pattern: '/mentors/apply', hrefs: ['/mentors', null] },
  { pattern: '/mentors/:id', hrefs: ['/mentors', null] },
  { pattern: '/news/:slug', hrefs: ['/news', null] },
  { pattern: '/plus/success', hrefs: ['/plus', null] },
];

/** Match a pathname against a `:param` pattern, returning captured segments. */
export function matchRoute(pattern: string, pathname: string): Record<string, string> | null {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = pathname.split('/').filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i += 1) {
    const patternPart = patternParts[i];
    const pathPart = pathParts[i];
    if (patternPart === undefined || pathPart === undefined) return null;
    if (patternPart.startsWith(':')) {
      params[patternPart.slice(1)] = pathPart;
    } else if (patternPart !== pathPart) {
      return null;
    }
  }
  return params;
}

function fillPattern(pattern: string, params: Record<string, string>): string {
  return pattern
    .split('/')
    .map((part) => (part.startsWith(':') ? (params[part.slice(1)] ?? part) : part))
    .join('/');
}

/**
 * The breadcrumb trail for a pathname, or an empty array when the route is not
 * one a student navigates back through.
 *
 * An empty result is a real answer, not a failure: `/auth`, `/onboarding` and
 * `/coming-soon` are all places where a trail out would be actively unhelpful,
 * and returning nothing lets the renderer draw nothing rather than guess.
 *
 * `labels` overrides a dynamic crumb — `{ application: 'MSc Health Admin' }`.
 */
export function breadcrumbTrail(
  pathname: string,
  labels: Readonly<Record<string, string>> = {},
): Crumb[] {
  // Query strings and trailing slashes are not part of a route's identity.
  const clean = pathname.split('?')[0]?.replace(/\/+$/, '') || '/';

  for (const route of ROUTES) {
    const params = matchRoute(route.pattern, clean);
    if (!params) continue;

    const hrefs = CRUMB_HREFS.find((entry) => entry.pattern === route.pattern)?.hrefs;

    return route.trail.map((label, index) => {
      const dynamic = route.dynamic?.[index];
      const resolved = dynamic ? (labels[dynamic.key] ?? dynamic.fallback) : label;

      const hrefPattern = hrefs?.[index];
      const isLast = index === route.trail.length - 1;

      return hrefPattern && !isLast
        ? { label: resolved, href: fillPattern(hrefPattern, params) }
        : { label: resolved };
    });
  }

  return [];
}

/* ── Application sub-navigation ───────────────────────────────────────────── */

export type SubNavItem = {
  key: string;
  label: string;
  href: string;
  /** Shown but not linked until the student can actually reach it. */
  locked?: boolean;
};

/**
 * The destinations that belong to one application.
 *
 * ─── THE PROBLEM THIS SOLVES ─────────────────────────────────────────────────
 *
 * Reaching the board used to be: My Portal → the workspace → Strategy → up to
 * four onboarding redirects → the dashboard → click a tab that was not even in
 * the URL. Every one of those steps is a place to get lost, and a student who
 * wanted to check a deadline had to walk the whole funnel again. Onboarding is
 * a sequence the FIRST time; afterwards these are just places, and this is the
 * list of them.
 *
 * `locked` is not a hiding mechanism. A student who has not finished the
 * analysis still sees that a Planner exists — hiding it would make the product
 * look smaller than it is and give them no idea what finishing unlocks. It is
 * rendered plainly and does not navigate, because `strategy/dashboard`
 * redirects back to onboarding until the analysis has run and a link that
 * bounces is worse than one that waits.
 */
export function applicationSubNav(
  applicationId: string,
  options: { analysisReady: boolean; plannerReady: boolean },
): SubNavItem[] {
  const strategy = `/ai-strategy/${applicationId}`;

  return [
    { key: 'overview', label: 'Overview', href: `/apply/${applicationId}` },
    {
      key: 'portrait',
      label: 'Personal Report',
      href: `${strategy}/strategy/analysis/portrait`,
      ...(options.analysisReady ? {} : { locked: true }),
    },
    {
      key: 'fit',
      label: 'Matching Report',
      href: `${strategy}/strategy/analysis/fit`,
      ...(options.analysisReady ? {} : { locked: true }),
    },
    {
      key: 'planner',
      label: 'Planner',
      href: `${strategy}/strategy/dashboard`,
      ...(options.plannerReady ? {} : { locked: true }),
    },
    { key: 'cv', label: 'CV builder', href: `${strategy}/cv/target-profile` },
    { key: 'statement', label: 'Statement', href: `${strategy}/statement` },
  ];
}

/**
 * Which sub-nav entry a pathname belongs under.
 *
 * Matched longest-prefix-first so `/strategy/analysis/fit` does not resolve to
 * the Planner just because both live under `/strategy`.
 */
export function activeSubNavKey(pathname: string): string | null {
  const clean = pathname.split('?')[0] ?? '';
  if (/\/strategy\/analysis\/fit$/.test(clean)) return 'fit';
  if (/\/strategy\/analysis\/portrait$/.test(clean)) return 'portrait';
  if (/\/strategy\/analysis$/.test(clean)) return 'portrait';
  if (/\/strategy\/(dashboard|recommendations)/.test(clean)) return 'planner';
  if (/\/strategy(\/intro)?$/.test(clean)) return 'planner';
  if (/\/cv\//.test(clean)) return 'cv';
  if (/\/statement$/.test(clean)) return 'statement';
  if (/^\/apply\/[^/]+$/.test(clean)) return 'overview';
  return null;
}

/** The application id in a pathname, when it carries one. */
export function applicationIdFromPath(pathname: string): string | null {
  const clean = pathname.split('?')[0] ?? '';
  const strategy = /^\/ai-strategy\/([^/]+)\//.exec(clean);
  if (strategy?.[1] && strategy[1] !== 'reflection') return strategy[1];
  const apply = /^\/apply\/([^/]+)/.exec(clean);
  return apply?.[1] ?? null;
}
