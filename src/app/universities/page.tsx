import { unstable_cache } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { computeMatchResult } from '@/lib/matching';
import { toExplorerUniversity } from '@/lib/explorer-utils';
import type { ApplicationEntry } from '@/lib/explorer-context';
import type { University } from '@/lib/types';
import { UniversityExplorerClient } from './university-explorer-client';

// Re-render at most every 12 hours — the source data and Wikipedia
// imagery rarely change, and ISR keeps the page snappy.
export const revalidate = 43200;

// The full universities list is identical for every visitor, so cache it in
// Next's Data Cache instead of re-querying Supabase on each request. This
// keeps the largest query off the critical path (improving TTFB); only the
// per-user match scoring below stays dynamic.
const getAllUniversities = unstable_cache(
  async (): Promise<University[]> => {
    const admin = createAdminClient();
    const { data } = await admin
      .from('universities')
      .select('*')
      .order('qs_rank', { ascending: true, nullsFirst: false });
    return (data ?? []) as University[];
  },
  ['all-universities'],
  { revalidate: 43200, tags: ['universities'] },
);

export default async function UniversitiesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch profile for matching
  let profile = null;
  let savedUniversityIds: number[] = [];
  let initialApplications: ApplicationEntry[] = [];

  if (user) {
    const [profileResult, savedResult] = await Promise.all([
      supabase.from('student_profiles').select('*').eq('user_id', user.id).maybeSingle(),
      supabase
        .from('user_universities')
        .select('id, university_id, status, added_at')
        .eq('user_id', user.id),
    ]);
    profile = profileResult.data;
    const savedRows = savedResult.data ?? [];
    savedUniversityIds = savedRows.map((r: { university_id: number }) => r.university_id);

    // Build initial applications from user_universities with active statuses
    const statusToStage: Record<string, number> = {
      interested: -1, // not an application yet
      applying: 0,
      applied: 2,
      offer: 5,
      rejected: 5,
      enrolled: 5,
    };

    initialApplications = savedRows
      .filter((r: { status: string }) => statusToStage[r.status] !== undefined && statusToStage[r.status] >= 0)
      .map((r: { id: number; university_id: number; status: string; added_at: string }) => ({
        universityId: r.university_id,
        userUniversityId: r.id,
        currentStage: statusToStage[r.status] ?? 0,
        submittedAt: r.added_at,
      }));
  }

  // Fetch all universities (served from the Data Cache when warm)
  const universities = await getAllUniversities();

  // Compute match scores and convert to explorer format
  const explorerUniversities = universities.map((uni: University) => {
    const matchResult = profile ? computeMatchResult(profile, uni) : null;
    return toExplorerUniversity({
      ...uni,
      match_score: matchResult?.percentage ?? null,
      match_breakdown: matchResult?.breakdown ?? null,
      is_saved: savedUniversityIds.includes(uni.id),
    });
  });

  // Sort: best match first
  explorerUniversities.sort((a, b) => {
    if (a.match_score !== null && b.match_score !== null) {
      return b.match_score - a.match_score;
    }
    return (a.qs_rank ?? 9999) - (b.qs_rank ?? 9999);
  });

  // Strip the `__wiki__` prefix so the client knows which universities still
  // need imagery resolved. The client lazily fetches `/api/university-images`
  // and patches the cards in place once Wikipedia/Wikidata responds. This
  // keeps the initial server render instant (no waiting on external APIs).
  const wikiPairs: Array<[string, string]> = [];
  for (const uni of explorerUniversities) {
    if (uni.image_url.startsWith('__wiki__')) {
      const title = uni.image_url.replace('__wiki__', '');
      wikiPairs.push([title, uni.name]);
      // Use a deterministic placeholder until the client resolves real imagery.
      uni.image_url = '';
      uni.logo_url = '';
    }
  }

  return (
    <UniversityExplorerClient
      universities={explorerUniversities}
      initialShortlist={savedUniversityIds}
      initialApplications={initialApplications}
      isLoggedIn={!!user}
      hasProfile={!!profile}
      wikiPairs={wikiPairs}
    />
  );
}
