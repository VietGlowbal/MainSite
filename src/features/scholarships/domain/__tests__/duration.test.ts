import { describe, expect, it } from 'vitest';
import type { BenefitComponent } from '../benefit-types';
import {
  periodMultiplier,
  resolveScholarshipDuration,
  type DurationContext,
} from '../duration';

function benefit(duration: BenefitComponent['duration']): BenefitComponent {
  return {
    type: 'living',
    coverage: 'included',
    valueKind: 'coverage',
    amount: null,
    percentage: null,
    period: 'monthly',
    duration,
    scenarioKey: null,
    mutuallyExclusive: false,
    evidence: [],
    confidence: 'high',
  };
}

describe('scholarship duration resolution', () => {
  it('prefers explicit scholarship duration over programme and application fallbacks', () => {
    const duration: DurationContext = {
      programme: { count: 4, unit: 'year' },
      application: { count: 24, unit: 'month' },
    };

    expect(
      resolveScholarshipDuration({
        benefits: [
          benefit({ count: 1, unit: 'year', basis: 'explicit', rawText: 'for one year' }),
        ],
        duration,
      }),
    ).toMatchObject({ count: 1, unit: 'year', source: 'scholarship' });

    expect(
      resolveScholarshipDuration({
        duration: {
          scholarship: { count: 12, unit: 'month' },
          programme: { count: 4, unit: 'year' },
        },
      }),
    ).toMatchObject({ count: 12, unit: 'month', source: 'scholarship' });
  });

  it('uses programme and then application duration only as explicit fallbacks', () => {
    expect(
      resolveScholarshipDuration({
        duration: { programme: { count: 4, unit: 'year' }, application: { count: 2, unit: 'year' } },
      }),
    ).toMatchObject({ count: 4, unit: 'year', source: 'programme' });

    expect(
      resolveScholarshipDuration({
        duration: { application: { count: 2, unit: 'year' } },
      }),
    ).toMatchObject({ count: 2, unit: 'year', source: 'application' });
  });

  it('does not infer duration from an absent or conflicting source', () => {
    expect(resolveScholarshipDuration({ duration: null })).toBeNull();
    expect(
      resolveScholarshipDuration({
        benefits: [
          benefit({ count: 1, unit: 'year', basis: 'explicit', rawText: 'one year' }),
          benefit({ count: 2, unit: 'year', basis: 'explicit', rawText: 'two years' }),
        ],
      }),
    ).toBeNull();
  });
});

describe('periodMultiplier', () => {
  it('normalizes annual and monthly periods without guessing a duration', () => {
    expect(periodMultiplier({ period: 'annual', duration: { count: 4, unit: 'year' } })).toBe(4);
    expect(periodMultiplier({ period: 'monthly', duration: { count: 12, unit: 'month' } })).toBe(12);
    expect(periodMultiplier({ period: 'monthly', duration: null })).toBeNull();
    expect(periodMultiplier({ period: 'annual', duration: { count: 1, unit: 'year' } })).toBe(1);
  });

  it('does not expand a one-time amount using a longer programme duration', () => {
    expect(
      periodMultiplier({ period: 'one-time', duration: { count: 4, unit: 'year' } }),
    ).toBe(1);
    expect(
      periodMultiplier({ period: 'unspecified', duration: { count: 4, unit: 'year' } }),
    ).toBe(1);
  });
});
