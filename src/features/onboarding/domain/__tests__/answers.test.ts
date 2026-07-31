import {
  answersToProfilePatch,
  completedStepCount,
  createEmptyAnswers,
  createEmptyAward,
  stepIsComplete,
} from '../index';

describe('onboarding answers', () => {
  it('uses logical steps rather than counting individual fields', () => {
    const answers = createEmptyAnswers();
    answers.preferred_countries = ['Canada'];
    answers.current_education_level = "Bachelor's Degree";
    answers.average_grade = '80';
    answers.target_majors = ['Engineering'];
    answers.intended_level = "Master or Post-Graduate Certificate";
    answers.nationality = 'Vietnam';
    answers.grading_system = '10-point scale';
    answers.grade_value = '8';
    answers.test_scores = [{ id: 'test-1', type: 'IELTS (9.0)', score: '7.0' }];
    answers.has_academic_awards = 'no';
    answers.budget_range = 'Up to $25k';

    expect(completedStepCount(answers)).toBe(9);
  });

  it('treats an explicit no-awards answer as complete', () => {
    const answers = createEmptyAnswers();
    answers.has_academic_awards = 'no';

    expect(stepIsComplete('academic_awards', answers)).toBe(true);
  });

  it('requires award metadata when the user selects yes', () => {
    const answers = createEmptyAnswers();
    answers.has_academic_awards = 'yes';
    answers.academic_awards = [createEmptyAward()];

    expect(stepIsComplete('academic_awards', answers)).toBe(false);
    answers.academic_awards[0] = {
      ...answers.academic_awards[0],
      name: 'Science Olympiad',
      level: 'National level',
      role: 'Gold Medal / 1st Prize',
    };
    expect(stepIsComplete('academic_awards', answers)).toBe(true);
  });

  it('projects canonical answers into the existing profile shape', () => {
    const answers = createEmptyAnswers();
    answers.preferred_countries = ['Canada'];
    answers.current_education_level = 'Secondary / High school';
    answers.average_grade = '80';
    answers.target_majors = ['Engineering'];
    answers.other_major = 'Product';
    answers.intended_level = "Bachelor's Degree";
    answers.nationality = 'Vietnam';
    answers.grading_system = '10-point scale';
    answers.grade_value = '8';
    answers.budget_range = 'Up to $25k';
    answers.test_scores = [{ id: 'test-1', type: 'SAT (1600)', score: '1450' }];

    const profile = answersToProfilePatch(answers);

    expect(profile.study_level).toBe("Bachelor's Degree");
    expect(profile.current_qualification).toBe('Secondary / High school');
    expect(profile.target_subjects).toEqual(['Engineering', 'Product']);
    expect(profile.preferred_countries).toEqual(['Canada']);
    expect(profile.budget_range).toBe('Up to $25k');
    expect(profile.grades_summary).toEqual({
      grading_system: '10-point scale',
      grade_value: '8',
      test_scores: [{ type: 'SAT (1600)', score: '1450' }],
    });
  });
});
