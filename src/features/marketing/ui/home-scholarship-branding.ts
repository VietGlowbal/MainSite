export type OfficialScholarshipBranding = {
  logoUrl: string;
  logoTone: 'light' | 'dark';
  sourceUrl: string;
  organization?: string;
  country?: string;
};

/**
 * Small, verified editorial registry for scholarships that publish their own
 * identity. These URLs are taken from the programmes' official sites, never
 * from a search-result thumbnail or a third-party logo library. Awards absent
 * from this registry deliberately fall back to their linked university crest.
 */
const OFFICIAL_SCHOLARSHIP_BRANDING: ReadonlyArray<{
  matches: readonly string[];
  branding: OfficialScholarshipBranding;
}> = [
  {
    matches: ['rhodes scholarship', 'rhodes scholarships'],
    branding: {
      logoUrl:
        'https://www.rhodeshouse.ox.ac.uk/modern/images/rhodes-logo-main-dark.3ba69162169c8985b226.svg',
      logoTone: 'light',
      sourceUrl: 'https://www.rhodeshouse.ox.ac.uk/',
    },
  },
  {
    matches: ['gates cambridge'],
    branding: {
      logoUrl:
        'https://www.gatescambridge.org/wp-content/uploads/2023/08/GC-logo-positive_font_update_WHITE_OUT.png',
      logoTone: 'dark',
      sourceUrl: 'https://www.gatescambridge.org/',
    },
  },
  {
    matches: ['knight-hennessy', 'knight hennessy'],
    branding: {
      logoUrl:
        'https://knight-hennessy.stanford.edu/sites/g/files/sbiybj23586/files/2024-12/khs_logo_primary_rgb.png',
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
