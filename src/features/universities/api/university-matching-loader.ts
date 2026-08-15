import type { SupabaseClient } from '@supabase/supabase-js';
import type { StudentProfile } from '@/lib/types';
import {
  rankUniversityMatches,
  type RankedUniversityMatch,
} from '../domain';
import { getUniversityQueries } from './index';

type UniversityMatchProfileRow = Pick<StudentProfile,
  | 'study_level'
  | 'target_subjects'
  | 'preferred_countries'
  | 'budget_range'
  | 'campus_preferences'
  | 'support_needs'
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

function toStudentProfile(row: UniversityMatchProfileRow): StudentProfile {
  return {
    study_level: typeof row.study_level === 'string' ? row.study_level : null,
    target_subjects: stringArray(row.target_subjects),
    preferred_countries: stringArray(row.preferred_countries),
    budget_range: typeof row.budget_range === 'string' ? row.budget_range : null,
    campus_preferences: typeof row.campus_preferences === 'string' ? row.campus_preferences : null,
    support_needs: typeof row.support_needs === 'string' ? row.support_needs : null,
  };
}

/** Load only university-level recommendations for the authenticated student. */
export async function loadRankedUniversityMatches(
  supabase: SupabaseClient,
  userId: string,
): Promise<RankedUniversityMatch[]> {
  const [profileResult, universities] = await Promise.all([
    supabase
      .from('student_profiles')
      .select('study_level,target_subjects,preferred_countries,budget_range,campus_preferences,support_needs')
      .eq('user_id', userId)
      .maybeSingle(),
    getUniversityQueries().allForMatching(),
  ]);

  if (profileResult.error) {
    console.error('loadRankedUniversityMatches profile read failed:', profileResult.error.message);
    return [];
  }

  if (!profileResult.data) return [];
  const profile = toStudentProfile(profileResult.data as UniversityMatchProfileRow);
  return rankUniversityMatches(profile, universities);
}
