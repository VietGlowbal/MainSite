import type { SupabaseClient } from '@supabase/supabase-js';
import type { StudentProfile } from '@/lib/types';
import {
  rankUniversityRecommendations,
  RECOMMENDATION_CONFIG,
  recommendationProfileHasPreferences,
  type RecommendationProgramme,
  type RecommendationResponse,
  type RecommendationUniversity,
} from '../domain';
import { getProgrammeQueries, getUniversityQueries } from './index';
import type { CatalogueProgramme, UniversityListItem } from './index';

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

function toProgramme(programme: CatalogueProgramme): RecommendationProgramme {
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

function toProgrammeMap(
  programmes: Map<number, CatalogueProgramme[]>,
): Map<number, RecommendationProgramme[]> {
  return new Map([...programmes.entries()].map(([universityId, entries]) => [
    universityId,
    entries.map(toProgramme),
  ]));
}

/** Load server-side recommendation inputs and return a typed UI response. */
export async function loadUniversityRecommendations(
  supabase: SupabaseClient,
  userId: string,
): Promise<RecommendationResponse> {
  const generatedAt = new Date().toISOString();
  try {
    const [profileResult, universities] = await Promise.all([
      supabase
        .from('student_profiles')
        .select('study_level,target_subjects,preferred_countries,budget_range,campus_preferences')
        .eq('user_id', userId)
        .maybeSingle(),
      getUniversityQueries().allForMatching(),
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
    const universityIds = universities.map((university) => university.id);
    const programmeRows = await getProgrammeQueries().byUniversityIds(universityIds);
    return rankUniversityRecommendations(
      profile,
      universities.map(toUniversity),
      toProgrammeMap(programmeRows),
      { asOf: generatedAt },
    );
  } catch (error) {
    console.error('loadUniversityRecommendations failed:', error instanceof Error ? error.message : error);
    return { status: 'error', results: [], algorithmVersion: RECOMMENDATION_CONFIG.version, generatedAt };
  }
}
