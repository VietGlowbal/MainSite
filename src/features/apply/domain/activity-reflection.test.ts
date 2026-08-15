import { describe, expect, it } from 'vitest';
import {
  REFLECTION_DIMENSIONS,
  activityReflectionAnsweredCount,
  activityReflectionProgress,
  activityReflectionSchema,
  experienceCategoryFor,
  isReflectionCardEmpty,
  reflectionCardSchema,
  reflectionInspiration,
  reflectionQuestion,
} from './activity-reflection';

describe('experienceCategoryFor', () => {
  it('maps every achievement category onto one of the seven spec categories', () => {
    expect(experienceCategoryFor('achievement', 'academic_award')).toBe('academic_growth');
    expect(experienceCategoryFor('achievement', 'competition')).toBe('competition_olympiad');
    expect(experienceCategoryFor('achievement', 'research')).toBe('research');
    expect(experienceCategoryFor('achievement', 'certification')).toBe('academic_growth');
    expect(experienceCategoryFor('achievement', 'other')).toBe('other');
  });

  it('maps every activity category onto one of the seven spec categories', () => {
    expect(experienceCategoryFor('activity', 'community_project')).toBe('community_impact');
    expect(experienceCategoryFor('activity', 'leadership')).toBe('leadership_initiative');
    expect(experienceCategoryFor('activity', 'innovation')).toBe('innovation_projects');
    expect(experienceCategoryFor('activity', 'personal_growth')).toBe('academic_growth');
    expect(experienceCategoryFor('activity', 'mentoring')).toBe('leadership_initiative');
    expect(experienceCategoryFor('activity', 'other')).toBe('other');
  });
});

describe('reflectionQuestion', () => {
  it('changes the main question wording per category for the same dimension (the spec’s central requirement)', () => {
    const leadership = reflectionQuestion('leadership_initiative', 'challenge');
    const community = reflectionQuestion('community_impact', 'challenge');
    const innovation = reflectionQuestion('innovation_projects', 'challenge');
    expect(leadership.heading).not.toBe(community.heading);
    expect(leadership.heading).not.toBe(innovation.heading);
    expect(leadership.heading).toBe('What was the toughest leadership decision you faced?');
  });

  it('every one of the seven dimensions has a heading for every category — no silent gaps', () => {
    const categories = [
      'community_impact',
      'leadership_initiative',
      'innovation_projects',
      'research',
      'competition_olympiad',
      'academic_growth',
      'other',
    ] as const;
    for (const category of categories) {
      for (const dimension of REFLECTION_DIMENSIONS) {
        const question = reflectionQuestion(category, dimension);
        expect(question.heading.length).toBeGreaterThan(0);
        expect(question.guidance).toHaveLength(2);
      }
    }
  });

  it('has inspiration scaffolding for every dimension', () => {
    for (const dimension of REFLECTION_DIMENSIONS) {
      expect(reflectionInspiration(dimension).length).toBeGreaterThan(0);
    }
  });
});

describe('activityReflectionProgress', () => {
  it('goes from empty to full across the seven dimensions', () => {
    expect(activityReflectionProgress(0)).toBe(0);
    expect(activityReflectionProgress(7)).toBe(1);
    expect(activityReflectionProgress(-5)).toBe(0);
    expect(activityReflectionProgress(99)).toBe(1);
  });
});

describe('activityReflectionSchema / activityReflectionAnsweredCount', () => {
  it('stores all seven dimensions', () => {
    const parsed = activityReflectionSchema.parse({
      context: 'a',
      motivation: 'b',
      challenge: 'c',
      action: 'd',
      impact: 'e',
      transformation: 'f',
      future: 'g',
    });
    expect(Object.keys(parsed).filter((k) => REFLECTION_DIMENSIONS.includes(k as never))).toHaveLength(7);
  });

  it('counts only answered dimensions', () => {
    expect(activityReflectionAnsweredCount(undefined)).toBe(0);
    expect(activityReflectionAnsweredCount({})).toBe(0);
    expect(activityReflectionAnsweredCount({ context: 'x', impact: '  ' })).toBe(1);
    expect(
      activityReflectionAnsweredCount({
        context: 'a',
        motivation: 'b',
        challenge: 'c',
        action: 'd',
        impact: 'e',
        transformation: 'f',
        future: 'g',
      }),
    ).toBe(7);
  });
});

describe('reflectionCardSchema / isReflectionCardEmpty', () => {
  it('defaults status to "generated"', () => {
    const card = reflectionCardSchema.parse({});
    expect(card.status).toBe('generated');
    expect(card.contributions).toEqual([]);
  });

  it('a card with nothing generated yet is empty', () => {
    expect(isReflectionCardEmpty(undefined)).toBe(true);
    expect(isReflectionCardEmpty(reflectionCardSchema.parse({}))).toBe(true);
  });

  it('a card with any real content is not empty', () => {
    expect(isReflectionCardEmpty(reflectionCardSchema.parse({ story: 'Something happened.' }))).toBe(false);
    expect(
      isReflectionCardEmpty(reflectionCardSchema.parse({ demonstratedSkills: [{ skill: 'Leadership' }] })),
    ).toBe(false);
  });
});
