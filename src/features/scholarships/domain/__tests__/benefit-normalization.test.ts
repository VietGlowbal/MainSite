import { describe, expect, it } from 'vitest';
import { normalizeScholarshipBenefits } from '../benefit-normalization';
import type {
  BenefitComponent,
  NormalizedScholarshipBenefits,
} from '../benefit-types';

function component(
  result: NormalizedScholarshipBenefits,
  type: BenefitComponent['type'],
  index = 0,
): BenefitComponent {
  const match = result.components.filter((item) => item.type === type)[index];
  expect(match).toBeDefined();
  return match!;
}

describe('normalizeScholarshipBenefits', () => {
  it('normalizes the supported T0 coverage and amount forms without calculating value', () => {
    const halfTuition = normalizeScholarshipBenefits({ coverage: '50% tuition' });
    expect(component(halfTuition, 'tuition')).toMatchObject({
      coverage: 'partial',
      valueKind: 'percentage',
      percentage: { min: 50, max: null },
      amount: null,
      period: 'unspecified',
      duration: null,
    });

    const fullTuition = normalizeScholarshipBenefits({ coverage: '100% tuition' });
    expect(component(fullTuition, 'tuition')).toMatchObject({
      coverage: 'full',
      valueKind: 'percentage',
      percentage: { min: 100, max: null },
    });
    expect(fullTuition.classification).toMatchObject({
      label: 'tuition-only',
      tuitionCoverage: 'full',
      fullRideStatus: 'not-claimed',
      fullRideClaimed: false,
    });

    const namedFullTuition = normalizeScholarshipBenefits({ coverage: 'full tuition' });
    expect(component(namedFullTuition, 'tuition')).toMatchObject({
      coverage: 'full',
      valueKind: 'coverage',
      percentage: null,
      amount: null,
    });

    const fullRide = normalizeScholarshipBenefits({ coverage: 'full ride' });
    expect(component(fullRide, 'tuition')).toMatchObject({ coverage: 'full' });
    expect(fullRide.classification).toMatchObject({
      label: 'full-ride',
      fullRideStatus: 'supported',
      fullRideClaimed: true,
    });

    const fullyFunded = normalizeScholarshipBenefits({ coverage: 'fully funded' });
    expect(fullyFunded.components).toHaveLength(0);
    expect(fullyFunded.classification).toMatchObject({
      label: 'fully-funded',
      fullRideStatus: 'not-claimed',
      fullyFundedClaimed: true,
    });
    expect(fullyFunded.warnings.map((warning) => warning.code)).toContain('fully-funded-ambiguous');
  });

  it('keeps non-tuition components separate and recognizes comprehensive support', () => {
    const living = normalizeScholarshipBenefits({ coverage: 'full tuition + living allowance' });
    expect(living.components.map((item) => item.type)).toEqual(['tuition', 'living']);
    expect(component(living, 'living')).toMatchObject({
      coverage: 'included',
      valueKind: 'coverage',
    });
    expect(living.classification).toMatchObject({
      label: 'full-ride',
      fullRideStatus: 'supported',
    });

    const accommodation = normalizeScholarshipBenefits({
      coverage: 'full tuition + accommodation',
    });
    expect(accommodation.components.map((item) => item.type)).toEqual(['tuition', 'accommodation']);
    expect(accommodation.classification.nonTuitionTypes).toEqual(['accommodation']);
  });

  it('supports every typed benefit category without collapsing them into tuition', () => {
    const result = normalizeScholarshipBenefits({
      coverage: 'tuition + living + accommodation + stipend + meals + travel + insurance + books/materials',
    });

    expect(result.components.map((item) => item.type)).toEqual([
      'tuition',
      'living',
      'accommodation',
      'stipend',
      'meals',
      'travel',
      'insurance',
      'books-materials',
    ]);
  });

  it('parses fixed values, ranges, currencies, periods, and explicit durations', () => {
    const stipend = normalizeScholarshipBenefits({
      coverage: 'full tuition + $2,000/month stipend',
    });
    expect(component(stipend, 'stipend')).toMatchObject({
      valueKind: 'fixed',
      amount: {
        min: 2_000,
        max: null,
        currency: 'USD',
        currencyStatus: 'known',
      },
      period: 'monthly',
      duration: null,
    });

    const fixed = normalizeScholarshipBenefits({ coverage: '$20,000' });
    expect(component(fixed, 'other')).toMatchObject({
      valueKind: 'fixed',
      amount: { min: 20_000, max: null, currency: 'USD' },
    });

    const range = normalizeScholarshipBenefits({ coverage: '$10,000–$20,000' });
    expect(component(range, 'other')).toMatchObject({
      valueKind: 'range',
      amount: { min: 10_000, max: 20_000, currency: 'USD' },
    });

    const annual = normalizeScholarshipBenefits({ coverage: '£30,000/year × 3 years' });
    expect(component(annual, 'other')).toMatchObject({
      valueKind: 'fixed',
      amount: { min: 30_000, max: null, currency: 'GBP' },
      period: 'annual',
      duration: { count: 3, unit: 'year', basis: 'explicit' },
    });

    const monthly = normalizeScholarshipBenefits({ coverage: '$5,000/month × 12 months' });
    expect(component(monthly, 'other')).toMatchObject({
      amount: { min: 5_000, max: null, currency: 'USD' },
      period: 'monthly',
      duration: { count: 12, unit: 'month', basis: 'explicit' },
    });

    const term = normalizeScholarshipBenefits({ coverage: '$4,000 per term for 2 terms' });
    expect(component(term, 'other')).toMatchObject({
      period: 'term',
      duration: { count: 2, unit: 'term', basis: 'explicit' },
    });

    const oneTime = normalizeScholarshipBenefits({ coverage: '$1,000 one-time award' });
    expect(component(oneTime, 'other').period).toBe('one-time');
  });

  it('preserves unknown currencies without defaulting to USD', () => {
    const result = normalizeScholarshipBenefits({ coverage: 'RMB 20,000' });
    expect(component(result, 'other')).toMatchObject({
      amount: {
        min: 20_000,
        max: null,
        currency: 'RMB',
        currencyStatus: 'unknown',
      },
      confidence: 'low',
    });
    expect(result.warnings.map((warning) => warning.code)).toContain('unknown-currency');
    expect(result.components[0]!.amount).toMatchObject({
      currency: 'RMB',
      currencyStatus: 'unknown',
    });
    expect(result.components[0]!.amount?.currency).not.toBe('USD');
  });

  it('removes unsafe source URLs from the UI-facing evidence contract', () => {
    const result = normalizeScholarshipBenefits({
      coverage: '$20,000',
      sourceUrl: 'javascript:alert(1)',
    });

    expect(result.raw.sourceUrl).toBeNull();
    expect(result.components[0]?.evidence[0]?.sourceUrl).toBeNull();
  });

  it('uses existing numeric fields conservatively and preserves raw evidence', () => {
    const result = normalizeScholarshipBenefits({
      coverage: 'full tuition',
      amountMin: 20_000,
      amountMax: 25_000,
      amountCurrency: 'USD',
      fundingType: ['merit'],
      sourceUrl: 'https://example.test/scholarship',
      raw: {
        coverage_original: 'Full tuition',
        source_column: 'Scholarship value',
      },
    });
    const tuition = component(result, 'tuition');
    expect(tuition.amount).toEqual({
      min: 20_000,
      max: 25_000,
      currency: 'USD',
      currencyStatus: 'known',
    });
    expect(tuition.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceField: 'coverage',
        excerpt: 'full tuition',
        sourceUrl: 'https://example.test/scholarship',
      }),
      expect.objectContaining({
        sourceField: 'amount',
        excerpt: '20000–25000 USD',
      }),
    ]));
    expect(result.raw).toEqual({
      coverage: 'full tuition',
      amountMin: 20_000,
      amountMax: 25_000,
      amountCurrency: 'USD',
      fundingType: ['merit'],
      sourceUrl: 'https://example.test/scholarship',
      fields: {
        coverage_original: 'Full tuition',
        source_column: 'Scholarship value',
      },
    });
  });

  it('keeps mutually exclusive alternatives in separate scenarios', () => {
    const result = normalizeScholarshipBenefits({
      coverage: '$10,000 for undergraduate or $5,000 for postgraduate',
    });
    expect(result.scenarios).toMatchObject([
      { key: 'scenario-1', mutuallyExclusive: true },
      { key: 'scenario-2', mutuallyExclusive: true },
    ]);
    expect(result.components.map((item) => item.scenarioKey)).toEqual([
      'scenario-1',
      'scenario-2',
    ]);
    expect(result.components.map((item) => item.amount?.min)).toEqual([10_000, 5_000]);
    expect(result.warnings.map((warning) => warning.code)).toContain('mutually-exclusive-scenarios');
  });

  it('does not infer duration from deadline years, slot counts, or unrelated numbers', () => {
    const result = normalizeScholarshipBenefits({
      coverage: 'Full tuition',
      raw: {
        deadline_text: '30 June 2027',
        slots_text: '12 scholarships',
      },
    });
    expect(component(result, 'tuition').duration).toBeNull();
  });

  it('does not turn a stale full-ride token into a full-ride classification', () => {
    const result = normalizeScholarshipBenefits({
      coverage: '100% tuition',
      fundingType: ['full-ride'],
    });
    expect(result.classification).toMatchObject({
      label: 'tuition-only',
      fullRideStatus: 'not-claimed',
      fullRideClaimed: false,
    });
  });
});
