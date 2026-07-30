export type HipolabsUniversity = {
  name?: unknown;
  country?: unknown;
  alpha_two_code?: unknown;
  domains?: unknown;
  web_pages?: unknown;
};

export type HipolabsCandidate = {
  name: string;
  country: string;
  country_code: string | null;
  primary_domain: string;
  official_url: string;
  domain_candidates: string[];
  official_web_pages: string[];
  domain_source: 'hipolabs';
  domain_review_status: 'pending';
  crawl_seed_enabled: false;
  domain_discovered_at: string;
  source: 'auto';
};

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isPublicHostname(hostname: string): boolean {
  const reservedSuffixes = [
    '.internal',
    '.invalid',
    '.local',
    '.localhost',
    '.onion',
    '.test',
  ];
  if (
    !hostname ||
    hostname.length > 253 ||
    hostname === 'localhost' ||
    reservedSuffixes.some((suffix) => hostname.endsWith(suffix)) ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) ||
    hostname.includes(':')
  ) {
    return false;
  }

  const labels = hostname.split('.');
  return (
    labels.length >= 2 &&
    labels.every(
      (label) =>
        label.length >= 1 &&
        label.length <= 63 &&
        /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label),
    )
  );
}

export function normalizeHipolabsDomain(value: unknown): string | null {
  const raw = asTrimmedString(value);
  if (!raw) return null;

  try {
    const withScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(raw)
      ? raw
      : `https://${raw}`;
    const parsed = new URL(withScheme);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    if (parsed.username || parsed.password || parsed.port) return null;

    const hostname = parsed.hostname
      .toLowerCase()
      .replace(/\.$/, '')
      .replace(/^www\./, '');
    return isPublicHostname(hostname) ? hostname : null;
  } catch {
    return null;
  }
}

export function normalizeHipolabsWebPage(
  value: unknown,
  allowedDomains: readonly string[],
): string | null {
  const raw = asTrimmedString(value);
  if (!raw) return null;

  try {
    const withScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(raw)
      ? raw
      : `https://${raw}`;
    const parsed = new URL(withScheme);
    const hostname = normalizeHipolabsDomain(parsed.hostname);
    if (
      !hostname ||
      !allowedDomains.some(
        (domain) =>
          hostname === domain ||
          hostname.endsWith(`.${domain}`) ||
          domain.endsWith(`.${hostname}`),
      )
    ) {
      return null;
    }

    parsed.protocol = 'https:';
    parsed.username = '';
    parsed.password = '';
    parsed.port = '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return null;
  }
}

export function buildHipolabsCandidate(
  raw: HipolabsUniversity,
  fallbackCountry: string,
  discoveredAt = new Date().toISOString(),
): HipolabsCandidate | null {
  const name = asTrimmedString(raw.name);
  const country = asTrimmedString(raw.country) || fallbackCountry.trim();
  if (name.length < 2 || !country) return null;

  const domains = Array.isArray(raw.domains)
    ? raw.domains.map(normalizeHipolabsDomain).filter((value): value is string => Boolean(value))
    : [];
  const domainCandidates = [...new Set(domains)];
  const primaryDomain = domainCandidates[0];
  if (!primaryDomain) return null;

  const webPages = Array.isArray(raw.web_pages)
    ? raw.web_pages
        .map((value) => normalizeHipolabsWebPage(value, domainCandidates))
        .filter((value): value is string => Boolean(value))
    : [];
  const officialWebPages = [...new Set(webPages)];
  const countryCode = asTrimmedString(raw.alpha_two_code).toUpperCase();

  return {
    name,
    country,
    country_code: /^[A-Z]{2}$/.test(countryCode) ? countryCode : null,
    primary_domain: primaryDomain,
    official_url: officialWebPages[0] ?? `https://${primaryDomain}/`,
    domain_candidates: domainCandidates,
    official_web_pages: officialWebPages,
    domain_source: 'hipolabs',
    domain_review_status: 'pending',
    crawl_seed_enabled: false,
    domain_discovered_at: discoveredAt,
    source: 'auto',
  };
}
