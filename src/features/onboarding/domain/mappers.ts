import type { StudentProfile } from '@/lib/types';
import type { OnboardingAnswers } from './types';

export function answersToProfilePatch(answers: OnboardingAnswers): Partial<StudentProfile> {
  const targetSubjects = Array.from(new Set(
    [...answers.target_majors, answers.other_major.trim()].filter(Boolean),
  ));

  const achievements = answers.has_academic_awards === 'yes'
    ? answers.academic_awards
      .filter((award) => award.name.trim())
      .map((award) => ({
        id: award.id,
        title: [award.name.trim(), award.organization.trim()].filter(Boolean).join(' / '),
        description: [
          award.role.trim(),
          award.level.trim(),
          award.description.trim(),
        ].filter(Boolean).join(' · '),
        year: award.date ? award.date.slice(0, 4) : '',
      }))
    : [];

  return {
    study_level: answers.intended_level.trim() || null,
    current_qualification: answers.current_education_level.trim() || null,
    predicted_grades: answers.average_grade.trim() || null,
    target_subjects: targetSubjects,
    career_interests: targetSubjects,
    preferred_countries: answers.preferred_countries,
    budget_range: answers.budget_range.trim() || null,
    nationality: answers.nationality.trim() || null,
    grades_summary: {
      grading_system: answers.grading_system.trim() || null,
      grade_value: answers.grade_value.trim() || null,
      test_scores: answers.test_scores
        .filter((test) => test.type.trim() || test.score.trim())
        .map((test) => ({ type: test.type.trim(), score: test.score.trim() })),
    },
    achievements,
  };
}
