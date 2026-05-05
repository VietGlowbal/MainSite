import { createClient } from '@/lib/supabase/server';
import { computeMatchScore } from '@/lib/matching';
import { toExplorerUniversity, type ApplicationEntry } from '@/lib/explorer-context';
import type { University } from '@/lib/types';
import { UniversityExplorerClient } from './university-explorer-client';

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

  // Fetch all universities
  const { data: universities } = await supabase
    .from('universities')
    .select('*')
    .order('qs_rank', { ascending: true, nullsFirst: false });

  // Compute match scores and convert to explorer format
  const explorerUniversities = (universities ?? []).map((uni: University) => {
    const matchScore = profile ? computeMatchScore(profile, uni) : null;
    return toExplorerUniversity({
      ...uni,
      match_score: matchScore,
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

  return (
    <UniversityExplorerClient
      universities={explorerUniversities}
      initialShortlist={savedUniversityIds}
      initialApplications={initialApplications}
      isLoggedIn={!!user}
    />
  );
}
