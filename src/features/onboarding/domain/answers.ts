import type { StudentProfile } from '@/lib/types';
import { ONBOARDING_FLOW_STEPS } from './content';
import type {
  AwardAnswer,
  OnboardingAnswers,
  OnboardingStepId,
  StoredOnboardingResponse,
  TestScoreAnswer,
} from './types';

const emptyAward = (): AwardAnswer => ({
  id: createLocalId(),
  level: '',
  role: '',
  name: '',
  organization: '',
  description: '',
  date: '',
});

const emptyTest = (): TestScoreAnswer => ({
  id: createLocalId(),
  type: '',
  score: '',
});

export function createEmptyAnswers(): OnboardingAnswers {
  return {
    preferred_countries: [],
    current_education_level: '',
    average_grade: '',
    target_majors: [],
    other_major: '',
    intended_level: '',
    nationality: '',
    grading_system: '',
    grade_value: '',
    budget_range: '',
    test_scores: [],
    has_academic_awards: '',
    academic_awards: [],
  };
}

export function createEmptyAward(): AwardAnswer {
  return emptyAward();
}

export function createEmptyTestScore(): TestScoreAnswer {
  return emptyTest();
}

export function createLocalId(): string {
  return `onboarding-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

export function normalizeAnswers(value: unknown): OnboardingAnswers {
  const source = value && typeof value === 'object' ? value as Partial<OnboardingAnswers> : {};
  const base = createEmptyAnswers();

  const awards = Array.isArray(source.academic_awards)
    ? source.academic_awards.map((award) => ({
      ...emptyAward(),
      ...(award && typeof award === 'object' ? award : {}),
      id: typeof (award as AwardAnswer | undefined)?.id === 'string'
        ? (award as AwardAnswer).id
        : createLocalId(),
    }))
    : [];

  const tests = Array.isArray(source.test_scores)
    ? source.test_scores.map((test) => ({
      ...emptyTest(),
      ...(test && typeof test === 'object' ? test : {}),
      id: typeof (test as TestScoreAnswer | undefined)?.id === 'string'
        ? (test as TestScoreAnswer).id
        : createLocalId(),
    }))
    : [];

  return {
    ...base,
    ...source,
    preferred_countries: Array.isArray(source.preferred_countries)
      ? source.preferred_countries.filter((country): country is string => typeof country === 'string')
      : [],
    target_majors: Array.isArray(source.target_majors)
      ? source.target_majors.filter((major): major is string => typeof major === 'string')
      : [],
    current_education_level: stringValue(source.current_education_level),
    average_grade: stringValue(source.average_grade),
    other_major: stringValue(source.other_major),
    intended_level: stringValue(source.intended_level),
    nationality: stringValue(source.nationality),
    grading_system: stringValue(source.grading_system),
    grade_value: stringValue(source.grade_value),
    budget_range: stringValue(source.budget_range),
    has_academic_awards: source.has_academic_awards === 'yes' || source.has_academic_awards === 'no'
      ? source.has_academic_awards
      : '',
    test_scores: tests,
    academic_awards: awards,
  };
}

export function answersFromProfile(
  profile: StudentProfile | null | undefined,
  storedResponse?: StoredOnboardingResponse,
): OnboardingAnswers {
  if (storedResponse?.answers) return normalizeAnswers(storedResponse.answers);

  const grades = profile?.grades_summary && typeof profile.grades_summary === 'object'
    ? profile.grades_summary as Record<string, unknown>
    : {};

  const achievements = Array.isArray(profile?.achievements) ? profile.achievements : [];

  return normalizeAnswers({
    preferred_countries: profile?.preferred_countries ?? [],
    current_education_level: profile?.current_qualification ?? '',
    average_grade: profile?.predicted_grades ?? '',
    target_majors: profile?.target_subjects ?? [],
    intended_level: profile?.study_level ?? '',
    nationality: profile?.nationality ?? '',
    grading_system: typeof grades.grading_system === 'string' ? grades.grading_system : '',
    grade_value: typeof grades.grade_value === 'string' ? grades.grade_value : '',
    budget_range: profile?.budget_range ?? '',
    has_academic_awards: achievements.length > 0 ? 'yes' : '',
    academic_awards: achievements.map((achievement) => ({
      id: achievement.id,
      level: '',
      role: '',
      name: achievement.title,
      organization: '',
      description: achievement.description,
      date: achievement.year ? `${achievement.year}-01-01` : '',
    })),
  });
}

export function migrateLegacyAnswers(value: unknown): OnboardingAnswers | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as { answers?: unknown };
  const legacy = source.answers && typeof source.answers === 'object'
    ? source.answers as Record<string, unknown>
    : source as unknown as Record<string, unknown>;

  if (!('study_level' in legacy) && !('subjects' in legacy) && !('countries' in legacy)) return null;

  const region = stringValue(legacy.countries);
  const regionCountries: Record<string, string[]> = {
    'UK & Ireland': ['UK'],
    Europe: ['Germany'],
    'North America': ['USA', 'Canada'],
    'Asia-Pacific': ['Australia', 'Japan'],
    'Middle East': [],
  };

  return normalizeAnswers({
    intended_level: stringValue(legacy.study_level),
    target_majors: stringValue(legacy.subjects) ? [stringValue(legacy.subjects)] : [],
    preferred_countries: regionCountries[region] ?? [],
  });
}

export function stepIsComplete(stepId: OnboardingStepId, answers: OnboardingAnswers): boolean {
  switch (stepId) {
    case 'preferred_countries':
      return answers.preferred_countries.length > 0;
    case 'current_education':
      return Boolean(answers.current_education_level.trim() && answers.average_grade.trim());
    case 'target_majors':
      return answers.target_majors.length > 0 || Boolean(answers.other_major.trim());
    case 'intended_level':
      return Boolean(answers.intended_level.trim());
    case 'nationality':
      return Boolean(answers.nationality.trim());
    case 'academic_grades':
      return Boolean(answers.grading_system.trim() && answers.grade_value.trim());
    case 'test_scores':
      return answers.test_scores.some((test) => test.type.trim() && test.score.trim());
    case 'academic_awards':
      if (answers.has_academic_awards === 'no') return true;
      if (answers.has_academic_awards !== 'yes') return false;
      return answers.academic_awards.some((award) => (
        award.name.trim() && award.level.trim() && award.role.trim()
      ));
    case 'budget':
      return Boolean(answers.budget_range.trim());
  }
}

export function completedStepCount(answers: OnboardingAnswers): number {
  return ONBOARDING_FLOW_STEPS.reduce(
    (count, step) => count + (stepIsComplete(step.id, answers) ? 1 : 0),
    0,
  );
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
