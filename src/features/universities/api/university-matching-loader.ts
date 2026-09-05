import { unstable_cache } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { StudentProfile } from '@/lib/types';
import { CACHE_TAGS, CACHE_TTL_LONG } from '@/server/cache';
import {
  rankUniversityRecommendations,
  RECOMMENDATION_CONFIG,
  recommendationProfileHasPreferences,
  type RecommendationProgramme,
  type RecommendationResponse,
  type RecommendationUniversity,
} from '../domain';
import { getProgrammeQueries, getUniversityQueries } from './index';
import type { MatchingProgramme, UniversityListItem } from './index';

type UniversityRecommendationProfileRow = Pick<StudentProfile,
  | 'study_level'
  | 'target_subjects'
  | 'preferred_countries'
  | 'budget_range'
  | 'campus_preferences'
>;

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }
  if (typeof value !== 'string') return [];

  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

function toProfile(row: UniversityRecommendationProfileRow): UniversityRecommendationProfileRow {
  return {
    study_level: typeof row.study_level === 'string' ? row.study_level : null,
    target_subjects: stringArray(row.target_subjects),
    preferred_countries: stringArray(row.preferred_countries),
    budget_range: typeof row.budget_range === 'string' ? row.budget_range : null,
    campus_preferences: typeof row.campus_preferences === 'string' ? row.campus_preferences : null,
  };
}

function toUniversity(university: UniversityListItem): RecommendationUniversity {
  return {
    id: university.id,
    name: university.name,
    country: university.country,
    ...(university.strengths === undefined ? {} : { strengths: university.strengths }),
    ...(university.best_for === undefined ? {} : { best_for: university.best_for }),
    ...(university.international_environment === undefined
      ? {}
      : { international_environment: university.international_environment }),
    ...(university.housing === undefined ? {} : { housing: university.housing }),
    ...(university.teaching_style === undefined ? {} : { teaching_style: university.teaching_style }),
    ...(university.tuition_usd === undefined ? {} : { tuition_usd: university.tuition_usd }),
    ...(university.accept_rate === undefined ? {} : { accept_rate: university.accept_rate }),
  };
}

function toProgramme(programme: MatchingProgramme): RecommendationProgramme {
  return {
    id: programme.id,
    universityId: programme.universityId,
    name: programme.name,
    degreeLevel: programme.degreeLevel,
    normalizedSubject: programme.normalizedSubject,
    officialUrl: programme.officialUrl,
    verificationStatus: programme.verificationStatus,
    retrievedAt: programme.retrievedAt,
  };
}

function groupByUniversity(programmes: MatchingProgramme[]): Map<number, RecommendationProgramme[]> {
  const grouped = new Map<number, RecommendationProgramme[]>();
  for (const programme of programmes) {
    const current = grouped.get(programme.universityId);
    if (current) current.push(toProgramme(programme));
    else grouped.set(programme.universityId, [toProgramme(programme)]);
  }
  return grouped;
}

/**
 * The half of the recommendation inputs that is the same for every student.
 *
 * `universities` and `catalog_programmes` are public reference data rewritten
 * by a nightly crawl and the occasional operator CSV import — nothing about
 * them depends on who is asking. Reading them fresh on every request was most
 * of why this route measured ~640ms of server time for eight visits.
 *
 * ⚠️ The cached value must stay JSON-serialisable. `unstable_cache` writes it
 * to the Next data cache, and a `Map` comes back as `{}` — which is why
 * `allForMatching` returns a flat array and the grouping happens after the
 * cache boundary rather than inside it.
 *
 * ⚠️ **This entry is the only cached reader of `catalog_programmes`, and that
 * table has a writer the `universities` tag did not originally cover.** The
 * tag is invalidated by the nightly `discover-universities` cron and by
 * `/api/admin/universities/revalidate`; the programme CSV importer
 * (`scripts/import-university-programs-csv.mjs`) writes straight to Postgres
 * and used to trigger neither, so caching here silently gave a student
 * pre-import rankings for up to twelve hours. The importer now calls that
 * endpoint itself on a successful `--apply`. Anything else that learns to write
 * `catalog_programmes` must do the same. See the producer registry in
 * `src/server/cache/tags.ts` and docs/performance.md fix 6.
 */
const getMatchingCatalogue = unstable_cache(
  async () => {
    const [universities, programmes] = await Promise.all([
      getUniversityQueries().allForMatching(),
      getProgrammeQueries().allForMatching(),
    ]);
    return { universities, programmes };
  },
  ['university-matching-catalogue'],
  { revalidate: CACHE_TTL_LONG, tags: [CACHE_TAGS.universities] },
);

/** Load server-side recommendation inputs and return a typed UI response. */
export async function loadUniversityRecommendations(
  supabase: SupabaseClient,
  userId: string,
): Promise<RecommendationResponse> {
  const generatedAt = new Date().toISOString();
  try {
    // The only per-user read is the profile; everything else is the shared
    // catalogue, so both sides go out at once and the catalogue side is a cache
    // hit for all but the first request in a twelve-hour window.
    const [profileResult, catalogue] = await Promise.all([
      supabase
        .from('student_profiles')
        .select('study_level,target_subjects,preferred_countries,budget_range,campus_preferences')
        .eq('user_id', userId)
        .maybeSingle(),
      getMatchingCatalogue(),
    ]);

    if (profileResult.error) {
      console.error('loadUniversityRecommendations profile read failed:', profileResult.error.message);
      return { status: 'error', results: [], algorithmVersion: RECOMMENDATION_CONFIG.version, generatedAt };
    }

    if (!profileResult.data) {
      return { status: 'incomplete_profile', results: [], algorithmVersion: RECOMMENDATION_CONFIG.version, generatedAt };
    }

    const profile = toProfile(profileResult.data as UniversityRecommendationProfileRow);
    if (!recommendationProfileHasPreferences(profile)) {
      return { status: 'incomplete_profile', results: [], algorithmVersion: RECOMMENDATION_CONFIG.version, generatedAt };
    }
    return rankUniversityRecommendations(
      profile,
      catalogue.universities.map(toUniversity),
      groupByUniversity(catalogue.programmes),
      { asOf: generatedAt },
    );
  } catch (error) {
    console.error('loadUniversityRecommendations failed:', error instanceof Error ? error.message : error);
    return { status: 'error', results: [], algorithmVersion: RECOMMENDATION_CONFIG.version, generatedAt };
  }
}
