import { unstable_cache } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUniversityQueries, type UniversityListItem } from '@/features/universities/api';
import { getScholarshipQueries } from '@/features/scholarships/api';
import { CACHE_TAGS, CACHE_TTL_LONG } from '@/server/cache';
import { computeMatchResult } from '@/lib/matching';
import {
  classifyAdmissionFit,
  computeProfileStrength,
  computeUniversitySelectivity,
  type ProfileStrengthSignals,
} from '@/lib/admission-fit';
import { toExplorerUniversity, type UniversityScholarship } from '@/lib/explorer-utils';
import type { ApplicationEntry } from '@/lib/explorer-context';
import { UniversityExplorerClient } from './university-explorer-client';

/**
 * Normalise an English test result to a 0–1 proficiency, used as one input to
 * the applicant's profile-strength score.
 */
function normaliseEnglishScore(testType: string | null, overall: number | null): number | null {
  if (overall == null) return null;
  const t = (testType ?? '').toLowerCase();
  if (t.includes('toefl')) return Math.min(overall / 120, 1);
  if (t.includes('pte')) return Math.min(overall / 90, 1);
  if (t.includes('duolingo')) return Math.min(overall / 160, 1);
  // Default to IELTS-style 0–9 banding.
  return Math.min(overall / 9, 1);
}

// Re-render at most every 12 hours — the source data and Wikipedia
// imagery rarely change, and ISR keeps the page snappy.
export const revalidate = 43200;

// The full universities list is identical for every visitor, so cache it in
// Next's Data Cache instead of re-querying Supabase on each request. This
// keeps the largest query off the critical path (improving TTFB); only the
// per-user match scoring below stays dynamic.
//
// The query itself now goes through the universities repository rather than
// building a Supabase client inline. Same cache key, TTL and tag, so this is
// behaviour-neutral — but the data access is behind a port, which is what lets
// Track A switch this page to real pagination without touching the page shell.
const getAllUniversities = unstable_cache(
  async (): Promise<UniversityListItem[]> => getUniversityQueries().listAllForLegacyExplorer(),
  ['all-universities'],
  { revalidate: CACHE_TTL_LONG, tags: [CACHE_TAGS.universities] },
);

/**
 * Scholarships that are linked to a university, grouped by university id.
 *
 * This replaces a `getPublishedScholarships()` call that pulled all 2,877+
 * published rows — with a nested `scholarship_universities -> universities`
 * join, paged 1,000 at a time — purely to build this Map. Country-, provider-
 * and consortium-scope awards have no university link, so they never appeared
 * in the Map; fetching them was pure waste.
 *
 * Returns entries rather than a Map because the Data Cache serializes through
 * JSON, and a Map does not survive that round trip.
 */
const getScholarshipsByUniversity = unstable_cache(
  async (): Promise<Array<[number, UniversityScholarship[]]>> => {
    const universities = await getUniversityQueries().listAllForLegacyExplorer();
    const byId = await getScholarshipQueries().byUniversityIds(universities.map((u) => u.id));
    return [...byId.entries()];
  },
  ['scholarships-by-university'],
  {
    revalidate: CACHE_TTL_LONG,
    // Depends on both tables: a new university can gain links, and a
    // scholarship edit changes what is attached.
    tags: [CACHE_TAGS.universities, CACHE_TAGS.scholarships],
  },
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

  // Admission-fit (Reach / Recommended / Safe) gating + strength signals.
  let admissionUnlocked = false;
  let profileStrength: ReturnType<typeof computeProfileStrength> | null = null;

  if (user) {
    const [profileResult, savedResult, docsResult, statementsResult, englishResult, workResult] =
      await Promise.all([
        supabase.from('student_profiles').select('*').eq('user_id', user.id).maybeSingle(),
        supabase
          .from('user_universities')
          .select('id, university_id, status, added_at')
          .eq('user_id', user.id),
        // Strength / unlock signals — kept lean (no heavy columns).
        supabase.from('uploaded_documents').select('type').eq('user_id', user.id),
        supabase.from('personal_statements').select('doc_type, ai_analysis').eq('user_id', user.id),
        supabase.from('english_test_scores').select('test_type, overall_score').eq('user_id', user.id),
        supabase.from('work_experiences').select('id').eq('user_id', user.id),
      ]);
    profile = profileResult.data;
    const savedRows = savedResult.data ?? [];

    // ── Build profile-strength signals ────────────────────────────────────
    const docs = (docsResult.data ?? []) as Array<{ type: string | null }>;
    const statements = (statementsResult.data ?? []) as Array<{
      doc_type: string | null;
      ai_analysis: { score?: number } | null;
    }>;
    const englishScores = (englishResult.data ?? []) as Array<{
      test_type: string | null;
      overall_score: number | null;
    }>;
    const workCount = (workResult.data ?? []).length;

    const hasCv = docs.some((d) => (d.type ?? '').toLowerCase().includes('cv'));
    // A statement counts if uploaded as a document OR drafted in-app.
    const hasStatement =
      docs.some((d) => /statement|sop|purpose/i.test(d.type ?? '')) || statements.length > 0;

    const statementScore = statements.reduce<number | null>((best, s) => {
      const score = s.ai_analysis?.score;
      if (typeof score !== 'number') return best;
      return best == null ? score : Math.max(best, score);
    }, null);

    const englishLevel = englishScores.reduce<number | null>((best, s) => {
      const lvl = normaliseEnglishScore(s.test_type, s.overall_score);
      if (lvl == null) return best;
      return best == null ? lvl : Math.max(best, lvl);
    }, null);

    const signals: ProfileStrengthSignals = {
      hasCv,
      hasStatement,
      statementScore,
      englishLevel,
      workExperienceCount: workCount,
    };

    // Grouping unlocks once the applicant has uploaded a CV or a statement.
    admissionUnlocked = hasCv || hasStatement;
    profileStrength = computeProfileStrength(profile, signals);
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

  // Universities + the scholarships linked to them (both from the Data Cache
  // when warm).
  const [universities, scholarshipEntries] = await Promise.all([
    getAllUniversities(),
    getScholarshipsByUniversity(),
  ]);

  // Index scholarships by the universities they're linked to, so each detail
  // view can show "Scholarships available here" without an extra query.
  const scholarshipsByUni = new Map<number, UniversityScholarship[]>(scholarshipEntries);

  // Compute match scores and convert to explorer format
  const strengthScore = profileStrength?.score ?? null;
  const explorerUniversities = universities.map((uni: UniversityListItem) => {
    const matchResult = profile ? computeMatchResult(profile, uni) : null;
    const explorer = toExplorerUniversity({
      ...uni,
      match_score: matchResult?.percentage ?? null,
      match_breakdown: matchResult?.breakdown ?? null,
      is_saved: savedUniversityIds.includes(uni.id),
    });
    explorer.scholarships = scholarshipsByUni.get(uni.id) ?? [];
    // Reach / Recommended / Safe — only once grouping is unlocked, otherwise
    // we don't leak a classification before the CV / statement is in.
    explorer.admission =
      admissionUnlocked && strengthScore != null
        ? classifyAdmissionFit(strengthScore, uni, computeUniversitySelectivity(uni))
        : null;
    return explorer;
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
      admissionUnlocked={admissionUnlocked}
      profileStrength={profileStrength?.score ?? null}
      wikiPairs={wikiPairs}
    />
  );
}
