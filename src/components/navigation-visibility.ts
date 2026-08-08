/**
 * Routes that must not receive the root layout's navigation.
 *
 * Most entries render the shared TopNav/MobileNav pair inside the page because
 * they need route-specific actions. A few intentionally render no navigation
 * at all (auth, the launch gate, and the post-payment write flow).
 *
 * Keep the matcher pure so every route shape can be covered without mounting
 * the auth-aware navigation controller.
 */
const EXACT_ROUTES_WITHOUT_GLOBAL_NAV = new Set([
  '/',
  '/about',
  '/ai-strategy',
  '/apply',
  '/auth',
  '/coming-soon',
  '/dev/apply-workspace',
  '/dev/home',
  '/dev/saved-list',
  '/how-it-works',
  '/advisors',
  '/my-universities/program',
  '/news',
  '/onboarding',
  '/plus',
  '/plus/success',
  '/universities',
]);

/** Remove a non-root trailing slash so deployment URL policy cannot duplicate chrome. */
export function normalizeNavigationPathname(pathname: string): string {
  if (pathname === '/') return pathname;
  return pathname.replace(/\/+$/, '') || '/';
}

export function suppressesGlobalNavigation(rawPathname: string): boolean {
  const pathname = normalizeNavigationPathname(rawPathname);

  if (EXACT_ROUTES_WITHOUT_GLOBAL_NAV.has(pathname)) return true;

  // Every page in the AI strategy journey supplies the same strategy chrome.
  if (pathname.startsWith('/ai-strategy/')) return true;

  // The application overview owns full page chrome. Feature children use the
  // root header, except LOR feedback which renders its own review chrome.
  if (/^\/apply\/[^/]+$/.test(pathname)) return true;
  if (/^\/apply\/[^/]+\/lor-feedback$/.test(pathname)) return true;

  // The AI statement writer is a full-height editor with its own top bar (back
  // link, university, match score). With the root header above it a student got
  // two stacked bars and lost the editor's height to chrome it did not need.
  // Same call as lor-feedback: a write surface keeps its own frame.
  if (/^\/my-universities\/[^/]+\/writer$/.test(pathname)) return true;

  // Numeric university details and UUID mentor profiles are rebuilt pages.
  // Their legacy/static siblings still depend on the root header.
  if (/^\/universities\/\d+$/.test(pathname)) return true;
  if (
    /^\/advisors\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      pathname,
    )
  ) {
    return true;
  }

  return false;
}
