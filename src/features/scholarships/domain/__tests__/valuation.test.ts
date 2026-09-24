import { describe, expect, it } from 'vitest';
import type { BenefitAmount, BenefitComponent } from '../benefit-types';
import { calculateScholarshipValue, type CostSource, type TuitionSource } from '../valuation';

const evidence = {
  sourceType: 'catalogue-field' as const,
  sourceField: 'amount' as const,
  excerpt: 'test evidence',
  sourceUrl: null,
};

function amount(
  min: number,
  currency: string | null = 'USD',
  max: number | null = null,
  currencyStatus: BenefitAmount['currencyStatus'] = currency ? 'known' : 'unknown',
): BenefitAmount {
  return { min, max, currency, currencyStatus };
}

function benefit(overrides: Partial<BenefitComponent>): BenefitComponent {
  return {
    type: 'other',
    coverage: 'included',
    valueKind: 'fixed',
    amount: null,
    percentage: null,
    period: 'one-time',
    duration: null,
    scenarioKey: null,
    mutuallyExclusive: false,
    evidence: [evidence],
    confidence: 'high',
    ...overrides,
  };
}

function policy(scenarioKey?: string) {
  return {
    comparableCurrency: 'USD',
    ...(scenarioKey === undefined ? {} : { scenarioKey }),
  };
}

function total(result: ReturnType<typeof calculateScholarshipValue>) {
  expect(result.totalValue).not.toBeNull();
  return result.totalValue!;
}

describe('calculateScholarshipValue', () => {
  it('sums a fixed tuition amount and a monthly living amount over twelve months', () => {
    const result = calculateScholarshipValue({
      benefits: [
        benefit({ type: 'tuition', amount: amount(20_000) }),
        benefit({
          type: 'living',
          period: 'monthly',
          amount: amount(5_000),
          duration: { count: 12, unit: 'month', basis: 'explicit', rawText: '$5,000/month × 12 months' },
        }),
      ],
      policy: policy(),
    });

    expect(total(result)).toMatchObject({ min: 80_000, max: 80_000, currency: 'USD' });
    expect(result.comparableTotalValue).toMatchObject({ amount: 80_000, currency: 'USD', bound: 'lower' });
    expect(result.status).toBe('EXACT');
  });

  it('multiplies an annual amount by four years', () => {
    const result = calculateScholarshipValue({
      benefits: [
        benefit({
          type: 'other',
          period: 'annual',
          amount: amount(40_000),
        }),
      ],
      duration: { programme: { count: 4, unit: 'year' } },
      policy: policy(),
    });

    expect(total(result).min).toBe(160_000);
    expect(result.comparableTotalValue?.amount).toBe(160_000);
  });

  it('preserves pounds before converting the lower bound through an injected FX provider', () => {
    const result = calculateScholarshipValue({
      benefits: [
        benefit({
          period: 'annual',
          amount: amount(30_000, 'GBP'),
          duration: { count: 3, unit: 'year', basis: 'explicit', rawText: '£30,000/year × 3 years' },
        }),
      ],
      policy: policy(),
      fx: {
        version: 'test-fx-v1',
        convert: (value, from, to) => (from === 'GBP' && to === 'USD' ? value * 1.25 : null),
      },
    });

    expect(total(result)).toMatchObject({ min: 90_000, currency: 'GBP' });
    expect(result.comparableTotalValue).toMatchObject({ amount: 112_500, currency: 'USD', fxVersion: 'test-fx-v1' });
  });

  it('multiplies a monthly stipend by twelve months', () => {
    const result = calculateScholarshipValue({
      benefits: [
        benefit({
          type: 'stipend',
          period: 'monthly',
          amount: amount(5_000),
          duration: { count: 12, unit: 'month', basis: 'explicit', rawText: '$5,000/month × 12 months' },
        }),
      ],
      policy: policy(),
    });

    expect(total(result).min).toBe(60_000);
  });

  it('derives percentage tuition from an injected tuition source', () => {
    const tuition: TuitionSource = {
      amount: amount(20_000),
      period: 'annual',
      duration: { count: 4, unit: 'year' },
      status: 'EXACT',
      sourceType: 'programme',
      evidence: [evidence],
    };
    const result = calculateScholarshipValue({
      benefits: [
        benefit({
          type: 'tuition',
          coverage: 'partial',
          valueKind: 'percentage',
          amount: null,
          percentage: { min: 50, max: null },
          period: 'unspecified',
        }),
      ],
      tuitionSource: tuition,
      policy: policy(),
    });

    expect(total(result)).toMatchObject({ min: 40_000, max: 40_000, currency: 'USD' });
    expect(result.status).toBe('EXACT');
  });

  it('values full tuition without inventing a full-ride living component', () => {
    const result = calculateScholarshipValue({
      benefits: [
        benefit({
          type: 'tuition',
          coverage: 'full',
          valueKind: 'coverage',
          amount: null,
          percentage: null,
        }),
      ],
      tuitionSource: {
        amount: amount(20_000),
        period: 'one-time',
        status: 'EXACT',
        sourceType: 'programme',
        evidence: [evidence],
      },
      policy: policy(),
    });

    expect(total(result).min).toBe(20_000);
    expect(result.components).toHaveLength(1);
    expect(result.components[0]!.type).toBe('tuition');
  });

  it('keeps fixed cash and ranges as ranges', () => {
    const result = calculateScholarshipValue({
      benefits: [
        benefit({ type: 'other', amount: amount(10_000, 'USD', 20_000) }),
        benefit({ type: 'travel', amount: amount(5_000) }),
      ],
      policy: policy(),
    });

    expect(total(result)).toMatchObject({ min: 15_000, max: 25_000 });
    expect(result.comparableTotalValue?.amount).toBe(15_000);
  });

  it('reports mixed provenance when an estimated cost reference joins an exact amount', () => {
    const livingCost: CostSource = {
      id: 'city-living-v1',
      benefitType: 'living',
      amount: amount(5_000),
      period: 'monthly',
      duration: { count: 12, unit: 'month' },
      status: 'ESTIMATED',
      sourceType: 'city-cost-reference',
      sourceVersion: 'city-v1',
      evidence: [evidence],
    };
    const result = calculateScholarshipValue({
      benefits: [
        benefit({ type: 'tuition', amount: amount(20_000) }),
        benefit({ type: 'living', amount: null, valueKind: 'coverage', period: 'monthly' }),
      ],
      costSources: [livingCost],
      policy: policy(),
    });

    expect(total(result).min).toBe(80_000);
    expect(result.status).toBe('MIXED');
    expect(result.comparableTotalValue?.amount).toBe(80_000);
  });

  it('does not expand a periodic amount when duration is unknown', () => {
    const result = calculateScholarshipValue({
      benefits: [benefit({ type: 'stipend', period: 'monthly', amount: amount(5_000) })],
      policy: policy(),
    });

    expect(result.complete).toBe(false);
    expect(result.totalValue).toBeNull();
    expect(result.comparableTotalValue).toBeNull();
    expect(result.warnings).toContain('complete-total-unavailable');
  });

  it('keeps an unknown currency out of comparable value and never assumes USD', () => {
    const result = calculateScholarshipValue({
      benefits: [benefit({ amount: amount(20_000, 'XYZ', null, 'unknown') })],
      policy: policy(),
    });

    expect(total(result)).toMatchObject({ min: 20_000, currency: 'XYZ', currencyStatus: 'unknown' });
    expect(result.comparableTotalValue).toBeNull();
    expect(result.warnings).toContain('unknown-currency-comparable-unavailable');
  });

  it('does not sum mutually exclusive scenarios without a selected scenario', () => {
    const benefits = [
      benefit({ type: 'tuition', amount: amount(10_000), scenarioKey: 'A', mutuallyExclusive: true }),
      benefit({ type: 'tuition', amount: amount(5_000), scenarioKey: 'B', mutuallyExclusive: true }),
    ];
    const unresolved = calculateScholarshipValue({ benefits, policy: policy() });
    expect(unresolved.complete).toBe(false);
    expect(unresolved.totalValue).toBeNull();
    expect(unresolved.warnings).toContain('scenario-selection-required');

    const selected = calculateScholarshipValue({ benefits, policy: policy('A') });
    expect(total(selected).min).toBe(10_000);
    expect(selected.comparableTotalValue?.amount).toBe(10_000);
    expect(selected.components.filter((component) => component.included)).toHaveLength(1);
  });

  it('counts a bundled living/accommodation cost source once', () => {
    const bundled: CostSource = {
      id: 'living-and-housing-v1',
      benefitType: 'living',
      covers: ['living', 'accommodation'],
      amount: amount(12_000),
      period: 'one-time',
      status: 'ESTIMATED',
      sourceType: 'university-cost-reference',
      evidence: [evidence],
    };
    const result = calculateScholarshipValue({
      benefits: [
        benefit({ type: 'living', amount: null, valueKind: 'coverage' }),
        benefit({ type: 'accommodation', amount: null, valueKind: 'coverage' }),
      ],
      costSources: [bundled],
      policy: policy(),
    });

    expect(total(result).min).toBe(12_000);
    expect(result.status).toBe('ESTIMATED');
    expect(result.components[1]!.reason).toBe('included-in-bundled-cost-source');
  });

  it('uses the lower bound for comparable ranking values', () => {
    const result = calculateScholarshipValue({
      benefits: [benefit({ amount: amount(10_000, 'USD', 20_000) })],
      policy: policy(),
    });

    expect(total(result)).toMatchObject({ min: 10_000, max: 20_000 });
    expect(result.comparableTotalValue).toMatchObject({ amount: 10_000, bound: 'lower' });
  });

  it('uses an explicit one-year benefit duration instead of multiplying by a four-year programme', () => {
    const result = calculateScholarshipValue({
      benefits: [
        benefit({
          period: 'annual',
          amount: amount(40_000),
          duration: { count: 1, unit: 'year', basis: 'explicit', rawText: 'for one year' },
        }),
      ],
      duration: { programme: { count: 4, unit: 'year' } },
      policy: policy(),
    });

    expect(total(result).min).toBe(40_000);
  });
});
