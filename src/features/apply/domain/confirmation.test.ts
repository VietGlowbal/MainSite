import { describe, expect, it } from 'vitest';
import { candidateReadiness } from './confirmation';
import type { ReflectionValues } from './reflection';

const READY: ReflectionValues = {
  majors: [],
  countries: [],
  achievements: [],
  activities: [],
};

describe('candidateReadiness', () => {
  it('does not require fields from the retired twelve-question reflection wizard', () => {
    const readiness = candidateReadiness(READY);

    expect(readiness.ready).toBe(true);
    expect(readiness.blockingIssues).toEqual([]);
  });

  it('does not revive legacy majors, countries, study-level or intake gates when those fields are empty', () => {
    const readiness = candidateReadiness({
      ...READY,
      countryPreferenceFlexible: undefined,
      intendedLevel: undefined,
      intake: undefined,
    });

    expect(readiness.ready).toBe(true);
    expect(readiness.blockingIssues).toEqual([]);
  });

  it('keeps Review & Confirm available when legacy extracted items still have review status', () => {
    const readiness = candidateReadiness({
      ...READY,
      achievements: [
        { category: 'academic_award', title: 'Demo', reviewStatus: 'needs_review' },
      ],
      activities: [{ category: 'leadership', title: 'Demo', reviewStatus: 'needs_review' }],
    });
    expect(readiness.ready).toBe(true);
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
