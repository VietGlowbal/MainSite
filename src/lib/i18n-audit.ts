export type StaticKeyOccurrence = { key: string; route: string };

const EXCLUDED_ROUTE_PREFIXES = ['/admin', '/api', '/dev', '/demo-throwaway'];
const PRIVATE_ROUTE_PREFIXES = [
  '/profile',
  '/dashboard',
  '/apply',
  '/onboarding',
  '/my-universities',
  '/ai-strategy',
];

const routeMatches = (route: string, prefix: string) => route === prefix || route.startsWith(`${prefix}/`);

/** Routes containing no production UI (API handlers, demos, and dev fixtures). */
export function isExcludedRoute(route: string, includePrivateChrome = false): boolean {
  if (EXCLUDED_ROUTE_PREFIXES.some((prefix) => routeMatches(route, prefix))) return true;
  return !includePrivateChrome && PRIVATE_ROUTE_PREFIXES.some((prefix) => routeMatches(route, prefix));
}
/** Extracts interpolation names in source order, without duplicates. */
export function placeholders(value: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const match of value.matchAll(/\{([A-Za-z0-9_]+)\}/g)) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      result.push(name);
    }
  }
  return result;
}

/**
 * Returns source strings that have no exact static dictionary entry. Dynamic
 * and excluded-route content is deliberately left to the caller to classify.
 */
export function findMissingStaticKeys(
  occurrences: readonly StaticKeyOccurrence[],
  dictionary: Readonly<Record<string, string>>,
  options: { includePrivateChrome?: boolean } = {},
): StaticKeyOccurrence[] {
  const seen = new Set<string>();
  return occurrences.filter(({ key, route }) => {
    const trimmed = key.trim();
    if (!trimmed || !/[\p{L}]/u.test(trimmed) || dictionary[trimmed] !== undefined) return false;
    if (isExcludedRoute(route, options.includePrivateChrome ?? false)) return false;
    const dedupe = `${route}\u0000${trimmed}`;
    if (seen.has(dedupe)) return false;
    seen.add(dedupe);
    return true;
  }).map(({ key, route }) => ({ key: key.trim(), route }));
}

/** Maps an app/page.tsx path to its unchanged URL path. */
export function routeFromPageFile(filePath: string): string {
  const normalized = filePath.replaceAll('\\', '/');
  const appIndex = normalized.indexOf('/app/');
  if (appIndex < 0 || !normalized.endsWith('/page.tsx')) return '/';
  const route = normalized.slice(appIndex + '/app/'.length, -'/page.tsx'.length);
  const parts = route
    .split('/')
    .filter(Boolean)
    .filter((part) => !(part.startsWith('(') && part.endsWith(')')));
  return parts.length ? `/${parts.join('/')}` : '/';
}
