export type OfficialScholarshipBranding = {
  logoUrl: string;
  logoTone: 'light' | 'dark';
  sourceUrl: string;
  organization?: string;
  country?: string;
};

/**
 * Small, verified editorial registry for scholarships that publish their own
 * identity. Each mark was taken from the programme's own site — never from a
 * search-result thumbnail or a third-party logo library — and `sourceUrl`
 * records where. Awards absent from this registry deliberately fall back to
 * their linked university crest.
 *
 * ⚠️ THE FILES ARE SERVED FROM `public/`, NOT HOT-LINKED. They used to point
 * straight at rhodeshouse.ox.ac.uk / gatescambridge.org / stanford.edu, and
 * `home-scholarship-pillars.tsx` renders them in a plain `<img>`. That made
 * every anonymous visitor's browser issue three cross-origin requests on the
 * home page before the cookie banner had even been answered — each one handing
 * a university's server the visitor's IP and Referer, and letting it set a
 * cookie. That is exactly what `ConsentBoundary` exists to prevent for GA, so
 * it cannot be left open here. Copying the files removes the request entirely;
 * it also drops three hosts that were never in the CSP's `img-src`, which would
 * have blanked these logos the day that header stops being report-only.
 *
 * Re-download from `sourceUrl` if a programme restyles its mark. Note that
 * gatescambridge.org answers a plain `curl` with 410 and a browser User-Agent
 * with 200 — the asset is live, its WAF just refuses non-browser agents. That
 * bot filter is a second reason not to depend on the remote copy at render time.
 */
const OFFICIAL_SCHOLARSHIP_BRANDING: ReadonlyArray<{
  matches: readonly string[];
  branding: OfficialScholarshipBranding;
}> = [
  {
    matches: ['rhodes scholarship', 'rhodes scholarships'],
    branding: {
      logoUrl: '/brand/scholarships/rhodes.svg',
      logoTone: 'light',
      sourceUrl: 'https://www.rhodeshouse.ox.ac.uk/',
    },
  },
  {
    matches: ['gates cambridge'],
    branding: {
      logoUrl: '/brand/scholarships/gates-cambridge.png',
      logoTone: 'dark',
      sourceUrl: 'https://www.gatescambridge.org/',
    },
  },
  {
    matches: ['knight-hennessy', 'knight hennessy'],
    branding: {
      logoUrl: '/brand/scholarships/knight-hennessy.png',
      logoTone: 'light',
      sourceUrl: 'https://knight-hennessy.stanford.edu/',
      organization: 'Stanford University',
      country: 'United States',
    },
  },
];

export function getOfficialScholarshipBranding(
  scholarshipName: string,
): OfficialScholarshipBranding | null {
  const normalizedName = scholarshipName.trim().toLowerCase();
  return (
    OFFICIAL_SCHOLARSHIP_BRANDING.find(({ matches }) =>
      matches.some((candidate) => normalizedName.includes(candidate)),
    )?.branding ?? null
  );
}
