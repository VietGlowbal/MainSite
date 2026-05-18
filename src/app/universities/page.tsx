import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { computeMatchResult } from '@/lib/matching';
import { toExplorerUniversity } from '@/lib/explorer-utils';
import { resolveWikiImages } from '@/lib/wiki-images';
import type { ApplicationEntry } from '@/lib/explorer-context';
import type { University } from '@/lib/types';
import { UniversityExplorerClient } from './university-explorer-client';

export default async function UniversitiesPage() {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

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

  // Fetch all universities
  const { data: universities } = await adminSupabase
    .from('universities')
    .select('*')
    .order('qs_rank', { ascending: true, nullsFirst: false });

  // Compute match scores and convert to explorer format
  const explorerUniversities = (universities ?? []).map((uni: University) => {
    const matchResult = profile ? computeMatchResult(profile, uni) : null;
    return toExplorerUniversity({
      ...uni,
      match_score: matchResult?.percentage ?? null,
      match_breakdown: matchResult?.breakdown ?? null,
      is_saved: savedUniversityIds.includes(uni.id),
    });
  });

  // Resolve Wikipedia thumbnail images for all universities
  const wikiTitles = explorerUniversities
    .map((u) => u.image_url)
    .filter((url) => url.startsWith('__wiki__'))
    .map((url) => url.replace('__wiki__', ''));

  const wikiImages = await resolveWikiImages(wikiTitles);

  // Inject resolved image URLs
  for (const uni of explorerUniversities) {
    if (uni.image_url.startsWith('__wiki__')) {
      const title = uni.image_url.replace('__wiki__', '');
      uni.image_url = wikiImages.get(title) ?? '';
    }
  }

  // Sort: best match first
  explorerUniversities.sort((a, b) => {
    if (a.match_score !== null && b.match_score !== null) {
      return b.match_score - a.match_score;
    }
    return (a.qs_rank ?? 9999) - (b.qs_rank ?? 9999);
  });

  return (
    <UniversityExplorerClient
      universities={explorerUniversities}
      initialShortlist={savedUniversityIds}
      initialApplications={initialApplications}
      isLoggedIn={!!user}
      hasProfile={!!profile}
    />
  );
}
