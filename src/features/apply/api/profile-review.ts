import type { SupabaseClient } from '@supabase/supabase-js';
import { studyLevelFromStored, type StudyLevel } from '../domain';

/**
 * A minimal, local read of `student_profiles.curriculum_grades` — the same
 * JSONB shape `@/features/onboarding/domain`'s `toCurriculumGrades` reads,
 * duplicated rather than imported: `features/apply` must not import
 * `features/onboarding` (FSD boundary, `eslint.config.mjs`), and this reader
 * only needs the display-ready `grade` string, not the scale-aware
 * validation the onboarding wizard's own editor owns.
 */
export type CurriculumGradeSummary = { curriculum: string; grade: string };

function parseCurriculumGrades(value: unknown): CurriculumGradeSummary[] {
  if (!Array.isArray(value)) return [];
  const rows: CurriculumGradeSummary[] = [];
  for (const entry of value) {
    if (entry === null || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const curriculum = row['curriculum'];
    const grade = row['grade'];
    if (typeof curriculum !== 'string') continue;
    rows.push({ curriculum, grade: typeof grade === 'string' ? grade : '' });
  }
  return rows;
}

/**
 * The data behind Step 1 — "Review Existing Profile". Read-only: every value
 * here already has a canonical column and an existing `/profile/*` editor
 * (`/profile/academic`, `/profile/english`, `/profile/preferences`,
 * `/profile/goals`) that Edit links out to. This reader exists so that page
 * does not have to duplicate five separate queries — it is the Step-1
 * equivalent of `candidate-context.ts`'s report-time reader, but scoped to
 * what a student needs to SEE and re-confirm rather than what an AI prompt
 * needs.
 */

export type EnglishTestSummary = {
  id: string;
  testType: string;
  overallScore: number | null;
};

export type StandardizedTestSummary = {
  id: string;
  testType: string;
  score: string | null;
};

export type ProfileReviewData = {
  nationality: string | null;
  studyLevel: StudyLevel | null;
  targetSubjects: string[];
  preferredCountries: string[];
  countryPreferenceFlexible: boolean;
  targetIntake: string | null;
  curriculumGrades: CurriculumGradeSummary[];
  gpaScale: string | null;
  gpaValue: number | null;
  englishTests: EnglishTestSummary[];
  standardizedTests: StandardizedTestSummary[];
  budgetRange: string | null;
  fundingSource: string | null;
  campusPreferences: string | null;
};

const PROFILE_COLUMNS =
  'nationality, study_level, target_subjects, preferred_countries, target_intake, curriculum_grades, gpa_scale, gpa_value, budget_range, funding_source, campus_preferences';

export async function loadProfileReview(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfileReviewData> {
  const [profileResult, englishResult, standardizedResult] = await Promise.all([
    supabase.from('student_profiles').select(PROFILE_COLUMNS).eq('user_id', userId).maybeSingle(),
    supabase
      .from('english_test_scores')
      .select('id, test_type, overall_score')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('standardized_test_scores')
      .select('id, test_type, score')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  ]);

  if (profileResult.error) {
    console.error('[profile-review] could not load student_profiles:', profileResult.error.message);
  }

  const profile = (profileResult.data ?? {}) as Record<string, unknown>;
  const countries = Array.isArray(profile['preferred_countries'])
    ? (profile['preferred_countries'] as string[])
    : [];
  const studyLevel = studyLevelFromStored(profile['study_level'] as string | null | undefined);

  return {
    nationality: (profile['nationality'] as string | null) ?? null,
    studyLevel: studyLevel ?? null,
    targetSubjects: Array.isArray(profile['target_subjects']) ? (profile['target_subjects'] as string[]) : [],
    preferredCountries: countries.filter((c) => c.toLowerCase() !== 'open to ideas'),
    countryPreferenceFlexible: countries.some((c) => c.toLowerCase() === 'open to ideas'),
    targetIntake: (profile['target_intake'] as string | null) ?? null,
    curriculumGrades: parseCurriculumGrades(profile['curriculum_grades']),
    gpaScale: (profile['gpa_scale'] as string | null) ?? null,
    gpaValue: (profile['gpa_value'] as number | null) ?? null,
    englishTests: ((englishResult.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: row['id'] as string,
      testType: row['test_type'] as string,
      overallScore: (row['overall_score'] as number | null) ?? null,
    })),
    standardizedTests: ((standardizedResult.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: row['id'] as string,
      testType: row['test_type'] as string,
      score: (row['score'] as string | null) ?? null,
    })),
    budgetRange: (profile['budget_range'] as string | null) ?? null,
    fundingSource: (profile['funding_source'] as string | null) ?? null,
    campusPreferences: (profile['campus_preferences'] as string | null) ?? null,
  };
}
