import { describe, expect, it } from 'vitest';
import { candidateReadiness } from './confirmation';
import type { ReflectionValues } from './reflection';

const READY: ReflectionValues = {
  majors: ['computer-science'],
  countries: ['GB'],
  intendedLevel: 'Bachelor’s Degree',
  intake: { type: 'undecided' },
  achievements: [],
  activities: [],
};

describe('candidateReadiness', () => {
  it('is ready when the four required questions are answered and nothing needs review', () => {
    const readiness = candidateReadiness(READY);
    expect(readiness.ready).toBe(true);
    expect(readiness.blockingIssues).toEqual([]);
  });

  it('lists a blocking issue per unanswered required question', () => {
    const readiness = candidateReadiness({
      ...READY,
      majors: [],
      countries: [],
      countryPreferenceFlexible: undefined,
    });
    expect(readiness.ready).toBe(false);
    expect(readiness.blockingIssues.map((issue) => issue.key)).toEqual(['majors', 'countries']);
  });

  it('treats "open to other countries" as answering the countries question', () => {
    const readiness = candidateReadiness({ ...READY, countries: [], countryPreferenceFlexible: true });
    expect(readiness.blockingIssues).toEqual([]);
  });

  it('is not ready while an extracted achievement or activity still needs review', () => {
    const readiness = candidateReadiness({
      ...READY,
      achievements: [
        { category: 'academic_award', title: 'Demo', reviewStatus: 'needs_review' },
      ],
      activities: [{ category: 'leadership', title: 'Demo', reviewStatus: 'needs_review' }],
    });
    expect(readiness.ready).toBe(false);
    expect(readiness.achievementsNeedingReview).toBe(1);
    expect(readiness.activitiesNeedingReview).toBe(1);
  });

  it('does not block on a reviewed or manual achievement', () => {
    const readiness = candidateReadiness({
      ...READY,
      achievements: [
        { category: 'academic_award', title: 'Demo', reviewStatus: 'reviewed' },
        { category: 'academic_award', title: 'Demo 2', sourceType: 'manual' },
      ],
    });
    expect(readiness.achievementsNeedingReview).toBe(0);
    expect(readiness.ready).toBe(true);
  });
});
