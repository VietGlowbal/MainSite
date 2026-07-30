/**
 * URL canonicalization utility (TypeScript-side)
 *
 * Mirrors the Python url_safety.canonicalize_url() behaviour:
 * - Strip tracking query params (utm_*, fbclid, gclid, etc.)
 * - Normalize scheme to lowercase
 * - Normalize hostname to lowercase
 * - Normalize path (remove double slashes, dot segments)
 * - Sort remaining query params
 * - Remove fragment
 *
 * Used for cache lookup comparisons only — security validation is
 * handled separately by validateCourseUrl() and the Python worker.
 */

const TRACKING_PARAMS = new Set([
  'fbclid',
  'gclid',
  'mc_cid',
  'mc_eid',
  'ref',
  'source',
]);

export function canonicalizeUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl.trim());

  // Scheme must be http(s)
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`Unsupported scheme: ${parsed.protocol}`);
  }

  // Drop tracking/UTM query params
  const cleanParams: [string, string][] = [];
  parsed.searchParams.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (!TRACKING_PARAMS.has(lower) && !lower.startsWith('utm_')) {
      cleanParams.push([key, value]);
    }
  });

  // Sort remaining params for deterministic output
  cleanParams.sort(([a], [b]) => a.localeCompare(b));

  const normalized = new URL(parsed.origin + parsed.pathname);
  cleanParams.forEach(([k, v]) => normalized.searchParams.set(k, v));

  // Remove default port
  let result = normalized.toString();
  // Remove trailing ? if no params
  if (result.endsWith('?')) result = result.slice(0, -1);

  return result;
}

function hostnameMatches(hostname: string, allowedDomains: string[]): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, '');
  return allowedDomains.some((domain) => {
    const candidate = domain.trim().toLowerCase().replace(/\.$/, '');
    return (
      candidate.length > 0 &&
      (normalized === candidate || normalized.endsWith(`.${candidate}`))
    );
  });
}

/**
 * Strict validation for the ingestion-provider path.
 *
 * This intentionally performs no network request. The Python worker performs
 * DNS/IP validation immediately before fetching; the Next.js request only
 * accepts HTTPS URLs on an already-approved official university domain.
 */
export function canonicalizeOfficialProgrammeUrl(
  rawUrl: string,
  allowedDomains: string[]
): string {
  const parsed = new URL(rawUrl.trim());

  if (parsed.protocol !== 'https:') {
    throw new Error('Programme URL must use HTTPS.');
  }
  if (parsed.username || parsed.password) {
    throw new Error('Credentials in URLs are not allowed.');
  }
  if (parsed.port && parsed.port !== '443') {
    throw new Error('Programme URL may not use a non-standard port.');
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
  const isIpv4 = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
  const isIpv6 = hostname.includes(':');
  if (
    !hostname ||
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    isIpv4 ||
    isIpv6
  ) {
    throw new Error('Programme URL must use an approved public hostname.');
  }
  if (!hostnameMatches(hostname, allowedDomains)) {
    throw new Error(
      `Domain '${hostname}' is not an approved university domain.`
    );
  }

  return canonicalizeUrl(parsed.toString());
}
