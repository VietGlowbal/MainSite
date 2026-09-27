import { describe, expect, it, vi } from 'vitest';
import type { BenefitComponent } from '../../domain/benefit-types';
import { DEFAULT_SCHOLARSHIP_COMPARISON_POLICY } from '../../domain/comparison-policy';
import type { CostReferenceProvider } from '../../domain/cost-reference';
import { buildScholarshipValuationContexts } from '../../domain/valuation-context';
import {
  calculateCandidateScholarshipValue,
  scholarshipValuationCacheKey,
  valuationRefinementFromMatchingSelection,
} from '../candidate-valuation';

const evidence = {
  sourceType: 'catalogue-field' as const,
  sourceField: 'coverage' as const,
  excerpt: 'Living support',
  sourceUrl: null,
};

function livingBenefit(): BenefitComponent {
  return {
    type: 'living',
    coverage: 'included',
    valueKind: 'coverage',
    amount: null,
    percentage: null,
    period: 'unspecified',
    duration: null,
    scenarioKey: null,
    mutuallyExclusive: false,
    evidence: [evidence],
    confidence: 'medium',
  };
}

function fixedBenefit(currency: string, min: number, max: number | null = null): BenefitComponent {
  return {
    type: 'other',
    coverage: 'included',
    valueKind: max == null ? 'fixed' : 'range',
    amount: { min, max, currency, currencyStatus: 'known' },
    percentage: null,
    period: 'one-time',
    duration: null,
    scenarioKey: null,
    mutuallyExclusive: false,
    evidence: [evidence],
    confidence: 'high',
  };
}

function source(overrides: Partial<NonNullable<ReturnType<CostReferenceProvider['resolve']>['source']>> = {}) {
  return {
    benefitType: 'living' as const,
    amount: { min: 1_000, max: 1_200, currency: 'USD', currencyStatus: 'known' as const },
    period: 'one-time' as const,
    status: 'ESTIMATED' as const,
    sourceType: 'cost-reference',
    sourceVersion: 'cost-test-v1',
    confidence: 'medium' as const,
    evidence: [],
    ...overrides,
  };
}

function provider(
  resolver: (context: Record<string, string | null>) => ReturnType<CostReferenceProvider['resolve']>,
): CostReferenceProvider {
  return {
    version: 'cost-test-v1',
    coverage: 'complete',
    diagnostics: [],
    resolve: vi.fn(({ context }) => resolver({
      programmeKey: context.programmeKey ?? null,
      universityKey: context.universityKey ?? null,
      cityKey: context.cityKey ?? null,
      countryKey: context.countryKey ?? null,
      globalKey: context.globalKey ?? null,
    })),
  };
}

describe('candidate valuation adapter', () => {
  it('does not let focused university A contaminate a scholarship linked to B', () => {
    const costProvider = provider((context) => ({
      record: null,
      source: context.universityKey === '20' ? source() : null,
      level: context.universityKey === '20' ? 'university' : null,
      attempts: [],
    }));
    const candidate = {
      id: 1,
      country: 'United Kingdom',
      benefits: [livingBenefit()],
      valuationContexts: buildScholarshipValuationContexts({
        scholarshipId: 1,
        scholarshipCountry: 'United Kingdom',
        universities: [{ id: 20, name: 'B', country: 'United Kingdom', city: 'Oxford' }],
      }),
    };

    const result = calculateCandidateScholarshipValue(candidate, {
      programme: null,
      university: {
        id: 10,
        name: 'A',
        city: 'London',
        country: 'United Kingdom',
        provenance: { sourceType: 'university', recordId: '10', sourceUrl: null, retrievedAt: null },
      },
    }, { asOf: '2026-09-24', costProvider });

    expect(costProvider.resolve).toHaveBeenCalledWith(expect.objectContaining({
      context: expect.objectContaining({ universityKey: '20', cityKey: 'Oxford' }),
    }));
    expect(result.complete).toBe(true);
  });

  it('uses a related-country candidate context without user context', () => {
    const costProvider = provider((context) => ({
      record: null,
      source: context.countryKey === 'Canada' ? source() : null,
      level: context.countryKey === 'Canada' ? 'country' : null,
      attempts: [],
    }));
    const candidate = {
      id: 2,
      country: 'Canada',
      benefits: [livingBenefit()],
      valuationContexts: buildScholarshipValuationContexts({
        scholarshipId: 2,
        scholarshipCountry: 'Canada',
        universities: [],
      }),
    };

    const result = calculateCandidateScholarshipValue(candidate, null, {
      asOf: '2026-09-24',
      costProvider,
    });

    expect(costProvider.resolve).toHaveBeenCalledWith(expect.objectContaining({
      context: expect.objectContaining({ countryKey: 'Canada', universityKey: null }),
    }));
    expect(result.complete).toBe(true);
  });

  it('passes the complete programme-to-global context to the provider for public valuation', () => {
    const costProvider = provider(() => ({
      record: null,
      source: source(),
      level: 'programme',
      attempts: [],
    }));
    const candidate = {
      id: 3,
      benefits: [livingBenefit()],
      valuationContexts: [{
        ...buildScholarshipValuationContexts({
          scholarshipId: 3,
          scholarshipCountry: 'United Kingdom',
          universities: [{ id: 20, country: 'United Kingdom', city: 'Oxford' }],
        })[0]!,
        programmeKey: 'programme-3',
        tuitionReferenceKey: 'programme-3-tuition',
        cityKey: 'Oxford',
        countryKey: 'United Kingdom',
      }],
    };

    calculateCandidateScholarshipValue(candidate, null, { asOf: '2026-09-24', costProvider });

    expect(costProvider.resolve).toHaveBeenCalledWith(expect.objectContaining({
      context: {
        programmeKey: 'programme-3',
        universityKey: '20',
        cityKey: 'Oxford',
        countryKey: 'United Kingdom',
        globalKey: 'global',
      },
    }));
  });

  it('does not invent a value when candidate context and providers are unresolved', () => {
    const candidate = {
      id: 4,
      country: null,
      benefits: [livingBenefit()],
      valuationContexts: [],
    };

    const result = calculateCandidateScholarshipValue(candidate, {
      programme: null,
      university: {
        id: 10,
        name: 'Unrelated A',
        city: 'London',
        country: 'United Kingdom',
        provenance: { sourceType: 'university', recordId: '10', sourceUrl: null, retrievedAt: null },
      },
    }, {
      asOf: '2026-09-24',
      costProvider: provider(() => ({ record: null, source: null, level: null, attempts: [] })),
    });

    expect(result.complete).toBe(false);
    expect(result.comparableTotalValue).toBeNull();
  });

  it('does not carry an incoherent programme into candidate valuation context', () => {
    const costProvider = provider(() => ({
      record: null,
      source: null,
      level: null,
      attempts: [],
    }));
    const [candidateContext] = buildScholarshipValuationContexts({
      scholarshipId: 8,
      scholarshipCountry: 'United Kingdom',
      universities: [{ id: 20, name: 'University B', country: 'United Kingdom', city: 'Oxford' }],
    });
    const candidate = {
      id: 8,
      country: 'United Kingdom',
      benefits: [livingBenefit()],
      valuationContexts: [{
        ...candidateContext!,
        duration: { count: 3, unit: 'year' as const },
      }],
    };

    const result = calculateCandidateScholarshipValue(candidate, {
      programme: {
        id: 'programme-a',
        name: 'Programme A',
        universityId: 10,
        duration: { count: 1, unit: 'year' },
        tuitionSource: null,
        provenance: { sourceType: 'programme', recordId: 'programme-a', sourceUrl: null, retrievedAt: null },
      },
      university: {
        id: 20,
        name: 'University B',
        city: 'Oxford',
        country: 'United Kingdom',
        provenance: { sourceType: 'university', recordId: '20', sourceUrl: null, retrievedAt: null },
      },
    }, { asOf: '2026-09-24', costProvider });

    expect(costProvider.resolve).toHaveBeenCalledWith(expect.objectContaining({
      context: expect.objectContaining({
        programmeKey: null,
        universityKey: '20',
        cityKey: 'Oxford',
      }),
    }));
    expect(result.duration).toMatchObject({ count: 3, unit: 'year' });
  });

  it('preserves candidate valuation facts when matching rejects an unresolved university selection', () => {
    const costProvider = provider((context) => ({
      record: null,
      source: context.programmeKey === 'candidate-programme' ? source() : null,
      level: context.programmeKey === 'candidate-programme' ? 'programme' : null,
      attempts: [],
    }));
    const [candidateContext] = buildScholarshipValuationContexts({
      scholarshipId: 81,
      scholarshipCountry: 'United Kingdom',
      universities: [{ id: 20, name: 'University B', country: 'United Kingdom', city: 'Oxford' }],
    });
    const candidate = {
      id: 81,
      country: 'United Kingdom',
      benefits: [livingBenefit()],
      valuationContexts: [{
        ...candidateContext!,
        duration: { count: 3, unit: 'year' as const },
        programmeKey: 'candidate-programme',
        tuitionReferenceKey: 'candidate-tuition',
      }],
    };

    const result = calculateCandidateScholarshipValue(
      candidate,
      valuationRefinementFromMatchingSelection({ programme: null, university: null }),
      { asOf: '2026-09-24', costProvider },
    );

    expect(result.duration).toMatchObject({ count: 3, unit: 'year' });
    expect(costProvider.resolve).toHaveBeenCalledWith(expect.objectContaining({
      context: {
        programmeKey: 'candidate-programme',
        universityKey: '20',
        cityKey: 'Oxford',
        countryKey: 'United Kingdom',
        globalKey: 'global',
      },
    }));
  });

  it('converts candidate values into the explicit comparison currency', () => {
    const result = calculateCandidateScholarshipValue({
      id: 5,
      benefits: [fixedBenefit('GBP', 80_000, 100_000)],
      valuationContexts: buildScholarshipValuationContexts({
        scholarshipId: 5,
        scholarshipCountry: 'United Kingdom',
        universities: [],
      }),
    }, null, {
      asOf: '2026-09-24',
      fx: {
        version: 'fx-test-v1',
        convert: (amount, from, to) => from === 'GBP' && to === DEFAULT_SCHOLARSHIP_COMPARISON_POLICY.currency
          ? amount * 1.25
          : from === to ? amount : null,
      },
    });

    expect(result.comparableTotalValue).toMatchObject({
      amount: 100_000,
      upperBound: 125_000,
      currency: 'USD',
      fxVersion: 'fx-test-v1',
    });
  });

  it('keeps Home and directory projections equivalent through the shared candidate adapter', () => {
    const candidate = {
      id: 9,
      country: 'United Kingdom',
      benefits: [fixedBenefit('GBP', 80_000, 100_000)],
      valuationContexts: buildScholarshipValuationContexts({
        scholarshipId: 9,
        scholarshipCountry: 'United Kingdom',
        universities: [],
      }),
    };
    const dependencies = {
      asOf: '2026-09-24',
      fx: {
        version: 'fx-test-v1',
        convert: (amount: number, from: string, to: string) => from === to
          ? amount
          : from === 'GBP' && to === DEFAULT_SCHOLARSHIP_COMPARISON_POLICY.currency
            ? amount * 1.25
            : null,
      },
    };

    const directoryValue = calculateCandidateScholarshipValue(candidate, null, dependencies);
    const homeValue = calculateCandidateScholarshipValue(candidate, null, dependencies);

    expect(homeValue).toEqual(directoryValue);
  });

  it('keeps cross-currency values incomparable when FX is missing or stale', () => {
    const result = calculateCandidateScholarshipValue({
      id: 6,
      benefits: [fixedBenefit('GBP', 80_000)],
      valuationContexts: buildScholarshipValuationContexts({
        scholarshipId: 6,
        scholarshipCountry: 'United Kingdom',
        universities: [],
      }),
    }, null, {
      asOf: '2026-09-24',
      fx: {
        version: 'fx-stale-v1',
        convert: () => null,
      },
    });

    expect(result.complete).toBe(true);
    expect(result.totalValue).toMatchObject({ currency: 'GBP', currencyStatus: 'known' });
    expect(result.comparableTotalValue).toBeNull();
    expect(result.warnings).toContain('comparable-value-unavailable');
  });

  it('does not convert an unknown raw currency into the explicit target', () => {
    const benefit = fixedBenefit('RMB', 80_000);
    benefit.amount = {
      ...benefit.amount!,
      currencyStatus: 'unknown',
    };

    const result = calculateCandidateScholarshipValue({
      id: 7,
      benefits: [benefit],
      valuationContexts: buildScholarshipValuationContexts({
        scholarshipId: 7,
        scholarshipCountry: 'China',
        universities: [],
      }),
    }, null, {
      asOf: '2026-09-24',
      fx: {
        version: 'fx-test-v1',
        convert: (amount) => amount,
      },
    });

    expect(result.totalValue).toMatchObject({ currency: 'RMB', currencyStatus: 'unknown' });
    expect(result.totalValue?.currency).not.toBe('USD');
    expect(result.comparableTotalValue).toBeNull();
  });

  it('keys public valuation caches by date bucket and provider versions', () => {
    const baseVersions = ['candidate-v1', 'cost-v1', 'fx-v1', 'comparison-v1', 'USD'];
    const base = scholarshipValuationCacheKey('2026-09-24', baseVersions);

    expect(scholarshipValuationCacheKey('2026-09-24', baseVersions)).toBe(base);
    expect(scholarshipValuationCacheKey('2026-09-25', baseVersions)).not.toBe(base);
    expect(scholarshipValuationCacheKey('2026-09-24', [
      'candidate-v1', 'cost-v2', 'fx-v1', 'comparison-v1', 'USD',
    ])).not.toBe(base);
    expect(scholarshipValuationCacheKey('2026-09-24', [
      'candidate-v1', 'cost-v1', 'fx-v2', 'comparison-v1', 'USD',
    ])).not.toBe(base);
    expect(base).not.toContain('user-');
  });
});
