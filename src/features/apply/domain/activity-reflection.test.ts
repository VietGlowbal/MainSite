import { describe, expect, it } from 'vitest';
import {
  EXPERIENCE_CATEGORIES,
  EXPERIENCE_SUBTYPES,
  REFLECTION_DIMENSIONS,
  activityReflectionAnsweredCount,
  activityReflectionProgress,
  activityReflectionSchema,
  experienceCategoryFor,
  firstUnansweredDimension,
  isReflectionCardEmpty,
  reflectionCardSchema,
  reflectionQuestion,
} from './activity-reflection';

describe('experienceCategoryFor', () => {
  it('maps every achievement category onto one of the four approved categories, preserving legacy values', () => {
    expect(experienceCategoryFor('achievement', 'academic_award')).toBe('academic_personal_growth');
    // Competition/Olympiad is folded into Academic & Personal Growth, not its own top-level category.
    expect(experienceCategoryFor('achievement', 'competition')).toBe('academic_personal_growth');
    // Research is folded into Innovation & Projects, not its own top-level category.
    expect(experienceCategoryFor('achievement', 'research')).toBe('innovation_projects');
    expect(experienceCategoryFor('achievement', 'certification')).toBe('academic_personal_growth');
    expect(experienceCategoryFor('achievement', 'other')).toBe('other');
  });

  it('maps every activity category onto one of the four approved categories, preserving legacy values', () => {
    expect(experienceCategoryFor('activity', 'community_project')).toBe('community_impact');
    expect(experienceCategoryFor('activity', 'leadership')).toBe('leadership_initiative');
    expect(experienceCategoryFor('activity', 'innovation')).toBe('innovation_projects');
    expect(experienceCategoryFor('activity', 'personal_growth')).toBe('academic_personal_growth');
    expect(experienceCategoryFor('activity', 'mentoring')).toBe('leadership_initiative');
    expect(experienceCategoryFor('activity', 'other')).toBe('other');
  });
});

describe('EXPERIENCE_CATEGORIES', () => {
  it('has exactly the four approved top-level categories', () => {
    expect(EXPERIENCE_CATEGORIES).toEqual([
      'community_impact',
      'leadership_initiative',
      'innovation_projects',
      'academic_personal_growth',
    ]);
  });
});

describe('EXPERIENCE_SUBTYPES', () => {
  it('resolves every subtype to an existing achievement/activity category, never a new one', () => {
    for (const category of EXPERIENCE_CATEGORIES) {
      const subtypes = EXPERIENCE_SUBTYPES[category];
      expect(subtypes.length).toBeGreaterThan(0);
      for (const subtype of subtypes) {
        expect(['achievement', 'activity']).toContain(subtype.kind);
        expect(subtype.label.length).toBeGreaterThan(0);
      }
    }
  });

  it('places Research under Innovation & Projects and Competition under Academic & Personal Growth', () => {
    expect(
      EXPERIENCE_SUBTYPES.innovation_projects.some((s) => s.kind === 'achievement' && s.category === 'research'),
    ).toBe(true);
    expect(
      EXPERIENCE_SUBTYPES.academic_personal_growth.some((s) => s.kind === 'achievement' && s.category === 'competition'),
    ).toBe(true);
  });
});

describe('reflectionQuestion', () => {
  it('changes the main question wording per category for the same dimension (the spec’s central requirement)', () => {
    const leadership = reflectionQuestion('leadership_initiative', 'context');
    const community = reflectionQuestion('community_impact', 'context');
    const academic = reflectionQuestion('academic_personal_growth', 'context');
    expect(leadership.heading).not.toBe(community.heading);
    expect(leadership.heading).not.toBe(academic.heading);
  });

  it('preserves the approved source’s intentional verbatim duplicate between Leadership and Innovation & Projects challenge questions', () => {
    const leadership = reflectionQuestion('leadership_initiative', 'challenge');
    const innovation = reflectionQuestion('innovation_projects', 'challenge');
    expect(leadership.heading).toBe('What was the toughest leadership decision you had to make?');
    expect(innovation.heading).toBe(leadership.heading);
  });

  it('preserves the approved source’s intentional verbatim repeat of Context’s guidance in Community Impact’s Motivation', () => {
    const context = reflectionQuestion('community_impact', 'context');
    const motivation = reflectionQuestion('community_impact', 'motivation');
    expect(motivation.guidance).toEqual(context.guidance);
  });

  it('every one of the seven dimensions has a heading for every category — no silent gaps', () => {
    const categories = [...EXPERIENCE_CATEGORIES, 'other'] as const;
    for (const category of categories) {
      for (const dimension of REFLECTION_DIMENSIONS) {
        const question = reflectionQuestion(category, dimension);
        expect(question.heading.length).toBeGreaterThan(0);
        expect(Array.isArray(question.guidance)).toBe(true);
      }
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

describe('firstUnansweredDimension', () => {
  it('resumes at context when nothing is answered', () => {
    expect(firstUnansweredDimension(undefined)).toBe('context');
    expect(firstUnansweredDimension({})).toBe('context');
  });

  it('resumes at the first unanswered dimension, not the start', () => {
    expect(
      firstUnansweredDimension({
        context: 'a',
        motivation: 'b',
        challenge: 'c',
        action: 'd',
        impact: 'e',
      }),
    ).toBe('transformation');
  });

  it('resumes at the last dimension once everything is answered', () => {
    expect(
      firstUnansweredDimension({
        context: 'a',
        motivation: 'b',
        challenge: 'c',
        action: 'd',
        impact: 'e',
        transformation: 'f',
        future: 'g',
      }),
    ).toBe('future');
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
