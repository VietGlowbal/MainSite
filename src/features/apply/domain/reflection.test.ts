import { describe, expect, it } from 'vitest';
import {
  EDUCATION_LEVELS,
  FUNDING_SOURCES,
  INTAKE_TERMS,
  INTENDED_LEVELS,
  TUITION_BUDGETS_USD,
  achievementSchema,
  aboutYouSchema,
  profileUpdateFromReflection,
  reflectionCompleteness,
  reflectionFromProfile,
  type ReflectionProfileRow,
  type ReflectionValues,
} from './reflection';

const EMPTY: ReflectionValues = {
  majors: [],
  countries: [],
  achievements: [],
  activities: [],
};

describe('reflectionFromProfile', () => {
  it('pre-fills from what the student has already told us elsewhere', () => {
    // The point of reading the profile: a returning student should not retype
    // what /profile/academic and /profile/preferences already hold.
    const profile: ReflectionProfileRow = {
      nationality: 'Vietnam',
      current_qualification: '4 - Year Bachelor’s Degree',
      study_level: 'Bachelor’s Degree',
      target_subjects: ['Design'],
      preferred_countries: ['Japan'],
      budget_range: '270000000-500000000',
      funding_source: 'Personal savings or parents',
      tuition_budget_usd: '$20,000 - $30,000',
      grades_summary: { gpa: '3.5 / 4', ielts: '7 / 10' },
    };

    expect(reflectionFromProfile(profile)).toEqual({
      highestEducation: '4 - Year Bachelor’s Degree',
      nationality: 'Vietnam',
      gpa: '3.5 / 4',
      ielts: '7 / 10',
      majors: ['Design'],
      countries: ['Japan'],
      intendedLevel: 'Bachelor’s Degree',
      fundingSource: 'Personal savings or parents',
      budgetRange: '270000000-500000000',
      tuitionBudgetUsd: '$20,000 - $30,000',
      achievements: [],
      activities: [],
    });
  });

  it('returns an empty form for a student with no profile yet', () => {
    expect(reflectionFromProfile(null)).toEqual(EMPTY);
  });

  it('drops a stored value that is no longer a valid option', () => {
    // If an option is renamed, the old value must not survive into the form:
    // it would render as an empty select that nevertheless fails validation,
    // with nothing on screen for the student to correct.
    const profile: ReflectionProfileRow = {
      funding_source: 'Crowdfunding',
      current_qualification: 'Some qualification we retired',
      tuition_budget_usd: '£40,000',
    };

    const values = reflectionFromProfile(profile);
    expect(values.fundingSource).toBeUndefined();
    expect(values.highestEducation).toBeUndefined();
    expect(values.tuitionBudgetUsd).toBeUndefined();
  });

  it('treats blank strings in the profile as unanswered', () => {
    const values = reflectionFromProfile({ nationality: '   ', grades_summary: { gpa: '' } });
    expect(values.nationality).toBeUndefined();
    expect(values.gpa).toBeUndefined();
  });

  it('survives a grades_summary holding non-string values', () => {
    // The column is shared JSON; onboarding wrote numbers into it historically.
    const values = reflectionFromProfile({ grades_summary: { gpa: 3.5, ielts: null } });
    expect(values.gpa).toBeUndefined();
    expect(values.ielts).toBeUndefined();
  });
});

describe('profileUpdateFromReflection', () => {
  it('merges into grades_summary rather than replacing it', () => {
    // Other screens write their own keys here. Overwriting the column
    // wholesale would silently discard them.
    const update = profileUpdateFromReflection({ ...EMPTY, gpa: '3.9 / 4' }, { sat: '1500' });

    // `sat` is nobody's business here and must survive untouched.
    expect(update['grades_summary']).toEqual({ sat: '1500', gpa: '3.9 / 4' });
  });

  it('removes a grade the student cleared', () => {
    const update = profileUpdateFromReflection({ ...EMPTY }, { gpa: '3.5 / 4', sat: '1500' });
    expect(update['grades_summary']).toEqual({ sat: '1500' });
  });

  it('writes nulls for cleared answers rather than omitting them', () => {
    // Reflection is where these facts are stated, so clearing has to mean
    // clearing — otherwise a removed value reappears on the next load.
    const update = profileUpdateFromReflection(EMPTY);

    expect(update['nationality']).toBeNull();
    expect(update['current_qualification']).toBeNull();
    expect(update['study_level']).toBeNull();
    expect(update['funding_source']).toBeNull();
    expect(update['target_subjects']).toBeNull();
    expect(update['grades_summary']).toBeNull();
  });

  it('round-trips through the profile without drift', () => {
    const values: ReflectionValues = {
      highestEducation: EDUCATION_LEVELS[2],
      nationality: 'Vietnam',
      gpa: '8.7 / 10',
      ielts: '7.0',
      majors: ['Economics', 'Finance'],
      countries: ['United Kingdom'],
      intendedLevel: INTENDED_LEVELS[1],
      fundingSource: FUNDING_SOURCES[1],
      budgetRange: '100000000-200000000',
      tuitionBudgetUsd: TUITION_BUDGETS_USD[2],
      achievements: [],
      activities: [],
    };

    const update = profileUpdateFromReflection(values);
    const back = reflectionFromProfile(update as ReflectionProfileRow);

    expect(back).toEqual(values);
  });
});

describe('reflectionCompleteness', () => {
  it('is 0 for an untouched form and 100 for a full one', () => {
    expect(reflectionCompleteness(EMPTY)).toBe(0);
    expect(
      reflectionCompleteness({
        highestEducation: EDUCATION_LEVELS[0],
        nationality: 'Vietnam',
        gpa: '3.5 / 4',
        ielts: '7',
        majors: ['Design'],
        countries: ['Japan'],
        intendedLevel: INTENDED_LEVELS[0],
        fundingSource: FUNDING_SOURCES[0],
        budgetRange: '1-2',
        tuitionBudgetUsd: TUITION_BUDGETS_USD[0],
        careerGoal: 'Product design in healthcare',
        studyMotivation: 'I want to make hospital software less hostile.',
        targetIntake: INTAKE_TERMS[0],
        achievements: [{ category: 'academic_award', title: 'Olympiad' }],
        activities: [{ category: 'leadership', title: 'Student council' }],
      }),
    ).toBe(100);
  });

  it('counts achievements as one slot however many there are', () => {
    // A student with one well-described award should not be told they are 5%
    // complete because they have not listed twenty.
    const one = reflectionCompleteness({
      ...EMPTY,
      achievements: [{ category: 'research', title: 'Paper' }],
    });
    const many = reflectionCompleteness({
      ...EMPTY,
      achievements: Array.from({ length: 8 }, (_, i) => ({
        category: 'research' as const,
        title: `Paper ${i}`,
      })),
    });

    expect(one).toBe(many);
  });
});

describe('schemas', () => {
  it('turns untouched inputs into unanswered rather than empty strings', () => {
    const parsed = aboutYouSchema.parse({ nationality: '  ', gpa: '' });
    expect(parsed.nationality).toBeUndefined();
    expect(parsed.gpa).toBeUndefined();
  });

  it('requires a title on an achievement, since nothing else identifies it', () => {
    expect(achievementSchema.safeParse({ category: 'research', title: '' }).success).toBe(false);
    expect(achievementSchema.safeParse({ category: 'research', title: 'Paper' }).success).toBe(
      true,
    );
  });

  it('rejects a year that would make the portrait nonsensical', () => {
    const base = { category: 'academic_award' as const, title: 'Olympiad' };
    expect(achievementSchema.safeParse({ ...base, year: 1900 }).success).toBe(false);
    expect(achievementSchema.safeParse({ ...base, year: 2100 }).success).toBe(false);
    expect(achievementSchema.safeParse({ ...base, year: 2026 }).success).toBe(true);
  });

  it('rejects a category outside the taxonomy the table constrains', () => {
    // The DB has a CHECK constraint; failing here gives a field error instead
    // of a 400 from Postgres after the student hits save.
    expect(achievementSchema.safeParse({ category: 'sports', title: 'Marathon' }).success).toBe(
      false,
    );
  });
});
