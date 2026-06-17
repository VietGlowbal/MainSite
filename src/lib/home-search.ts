/**
 * Homepage interactive search index (Phase 3).
 *
 * The landing page lets a visitor type a university name and instantly see how
 * many scholarships are connected to it, plus a couple of locked previews,
 * before being asked to create a profile.
 *
 * Shipping the full universities + scholarships set to the browser would be
 * heavy (spec §24: "avoid loading all scholarship data on initial page load"),
 * so instead we build a compact server-side index — cached in Next's Data
 * Cache like the other directories — and query it through a tiny API route
 * (/api/home/search). Only the handful of matches for the current query ever
 * reach the client.
 */
import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPublishedScholarships } from '@/lib/scholarships-data';

export type PreviewScholarship = {
  id: number;
  name: string;
  provider: string | null;
  country: string | null;
  amountLabel: string | null;
  fundingType: string[];
  deadlineLabel: string | null;
};

export type UniversityMatch = {
  id: number;
  name: string;
  country: string | null;
  scholarshipCount: number;
  preview: PreviewScholarship[];
};

type HomeIndex = {
  universities: Array<{ id: number; name: string; country: string | null }>;
  byUniversityId: Record<number, PreviewScholarship[]>;
  byCountry: Record<string, PreviewScholarship[]>;
};

const getHomeIndex = unstable_cache(
  async (): Promise<HomeIndex> => {
    const admin = createAdminClient();
    const [{ data: uniData }, scholarships] = await Promise.all([
      admin
        .from('universities')
        .select('id, name, country')
        .order('qs_rank', { ascending: true, nullsFirst: false }),
      getPublishedScholarships(),
    ]);

    const byUniversityId: Record<number, PreviewScholarship[]> = {};
    const byCountry: Record<string, PreviewScholarship[]> = {};

    for (const s of scholarships) {
      const lite: PreviewScholarship = {
        id: s.id,
        name: s.name,
        provider: s.provider,
        country: s.country,
        amountLabel: s.amountLabel,
        fundingType: s.funding_type,
        deadlineLabel: s.deadlineLabel,
      };
      for (const uid of s.universityIds) {
        (byUniversityId[uid] ??= []).push(lite);
      }
      for (const c of s.universityCountries.length ? s.universityCountries : s.country ? [s.country] : []) {
        (byCountry[c] ??= []).push(lite);
      }
    }

    return {
      universities: (uniData ?? []) as HomeIndex['universities'],
      byUniversityId,
      byCountry,
    };
  },
  ['home-search-index'],
  { revalidate: 43200, tags: ['universities', 'scholarships'] },
);

/**
 * Find universities whose name matches `query`, each enriched with a
 * scholarship count and up to `previewLimit` locked preview cards. Falls back
 * to country-scope scholarships when a university has no direct links yet.
 */
export async function searchHomeUniversities(
  query: string,
  { limit = 6, previewLimit = 3 } = {},
): Promise<UniversityMatch[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const index = await getHomeIndex();

  // Prefer prefix matches, then substring matches, capped at `limit`.
  const starts: typeof index.universities = [];
  const contains: typeof index.universities = [];
  for (const u of index.universities) {
    const name = u.name.toLowerCase();
    if (name.startsWith(q)) starts.push(u);
    else if (name.includes(q)) contains.push(u);
    if (starts.length >= limit) break;
  }
  const matches = [...starts, ...contains].slice(0, limit);

  return matches.map((u) => {
    const direct = index.byUniversityId[u.id] ?? [];
    const pool = direct.length ? direct : u.country ? (index.byCountry[u.country] ?? []) : [];
    return {
      id: u.id,
      name: u.name,
      country: u.country,
      scholarshipCount: pool.length,
      preview: pool.slice(0, previewLimit),
    };
  });
}
