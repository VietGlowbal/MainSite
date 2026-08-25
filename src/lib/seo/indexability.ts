/**
 * Pure indexability classifier defining the public vs private route boundaries
 * for search crawlers (robots meta tag, X-Robots-Tag header, and sitemap inclusion).
 *
 * Rule: Authenticated student app, payment states, and internal admin routes are private (`noindex, nofollow`).
 * Only explicit marketing, discovery, news, university, advisor, and public directory pages are indexable.
 */

const PUBLIC_EXACT_ROUTES = new Set([
  '/',
  '/about',
  '/how-it-works',
  '/news',
  '/universities',
  '/advisors',
  '/scholarships',
  // Localized equivalents
  '/vi',
  '/vi/about',
  '/vi/how-it-works',
  '/vi/news',
  '/vi/universities',
  '/vi/advisors',
  '/vi/scholarships',
]);

const PUBLIC_PREFIX_PATTERNS: readonly RegExp[] = [
  /^\/news\/[^/]+$/,
  /^\/universities\/[^/]+$/,
  /^\/advisors\/[^/]+$/,
  // Localized equivalents
  /^\/vi\/news\/[^/]+$/,
  /^\/vi\/universities\/[^/]+$/,
  /^\/vi\/advisors\/[^/]+$/,
];

/**
 * Normalizes a URL or pathname by stripping query string, hash, and trailing slashes.
 */
export function normalizePathname(urlOrPath: string): string {
  const withoutQuery = urlOrPath.split('?')[0]?.split('#')[0] ?? '/';
  const trimmed = withoutQuery.trim();
  if (!trimmed || trimmed === '/') return '/';
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

/**
 * Determines whether a pathname is in the public indexable allowlist.
 */
export function isPublicIndexablePath(urlOrPath: string): boolean {
  const path = normalizePathname(urlOrPath);
  if (PUBLIC_EXACT_ROUTES.has(path)) return true;
  return PUBLIC_PREFIX_PATTERNS.some((pattern) => pattern.test(path));
}

export type RobotsDirectives = {
  index: boolean;
  follow: boolean;
};

export const PRIVATE_ROBOTS: RobotsDirectives = {
  index: false,
  follow: false,
};

export const PUBLIC_ROBOTS: RobotsDirectives = {
  index: true,
  follow: true,
};

/**
 * Returns `{ index, follow }` robots directives based on the route indexability contract.
 */
export function getRobotsDirectivesForPath(urlOrPath: string): RobotsDirectives {
  return isPublicIndexablePath(urlOrPath) ? PUBLIC_ROBOTS : PRIVATE_ROBOTS;
}
