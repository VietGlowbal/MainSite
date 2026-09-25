import { describe, expect, it } from 'vitest';
import type { BenefitComponent } from '../benefit-types';
import {
  createCostReferenceProvider,
  parseCostReferenceDataset,
} from '../cost-reference';
import { calculateScholarshipValue } from '../valuation';

function rawCost(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    level: 'university',
    key: 'university-example-living-v1',
    scopeKey: 'university-example',
    benefitType: 'living',
    min: 1_000,
    max: 1_500,
    currency: 'USD',
    currencyStatus: 'known',
    period: 'monthly',
    sourceUrl: 'https://example.test/cost-reference',
    sourceDate: '2026-09-01',
    effectiveDate: '2026-09-01',
    retrievalDate: '2026-09-10',
    datasetVersion: 'cost-test-v1',
    methodology: 'Published university estimate.',
    evidenceExcerpt: 'Published monthly living estimate.',
    confidence: 'medium',
    valueStatus: 'ESTIMATED',
    includedCategories: ['living'],
    excludedCategories: ['accommodation'],
    ...overrides,
  };
}

function dataset(records: readonly Record<string, unknown>[]) {
  return parseCostReferenceDataset({
    version: 'cost-test-v1',
    coverage: 'partial',
    defaultMaxAgeDays: 365,
    records,
  });
}

function benefit(overrides: Partial<BenefitComponent>): BenefitComponent {
  return {
    type: 'living',
    coverage: 'included',
    valueKind: 'coverage',
    amount: null,
    percentage: null,
    period: 'monthly',
    duration: null,
    scenarioKey: null,
    mutuallyExclusive: false,
    evidence: [],
    confidence: 'high',
    ...overrides,
  };
}

describe('cost-reference provider', () => {
  it('selects the first defensible source in programme-to-global order', () => {
    const parsed = dataset([
      rawCost({
        level: 'programme',
        key: 'programme-living-v1',
        scopeKey: 'programme-example',
        min: 700,
        max: 900,
        excludedCategories: [],
      }),
      rawCost({
        key: 'university-living-v1',
        min: 1_000,
        max: 1_500,
      }),
      rawCost({
        level: 'city',
        key: 'city-living-v1',
        scopeKey: 'city-example',
        min: 1_200,
        max: 1_800,
        excludedCategories: [],
      }),
      rawCost({
        level: 'country',
        key: 'country-living-v1',
        scopeKey: 'country-example',
        excludedCategories: [],
      }),
      rawCost({
        level: 'global',
        key: 'global-living-v1',
        scopeKey: 'global',
        excludedCategories: [],
      }),
    ]);
    const provider = createCostReferenceProvider(parsed);

    const resolved = provider.resolve({
      benefitType: 'living',
      context: {
        programmeKey: 'programme-example',
        universityKey: 'university-example',
        cityKey: 'city-example',
        countryKey: 'country-example',
      },
      asOf: '2026-09-24',
    });

    expect(resolved.level).toBe('programme');
    expect(resolved.record?.key).toBe('programme-living-v1');
    expect(resolved.attempts[0]).toMatchObject({ outcome: 'selected', reason: 'first-defensible-reference' });
  });

  it('falls back when the more-specific reference is stale', () => {
    const parsed = dataset([
      rawCost({
        level: 'programme',
        key: 'stale-programme-living-v1',
        scopeKey: 'programme-example',
        validUntil: '2026-09-20',
        excludedCategories: [],
      }),
      rawCost({ key: 'university-living-v1', excludedCategories: [] }),
    ]);
    const resolved = createCostReferenceProvider(parsed).resolve({
      benefitType: 'living',
      context: { programmeKey: 'programme-example', universityKey: 'university-example' },
      asOf: '2026-09-24',
    });

    expect(resolved.level).toBe('university');
    expect(resolved.attempts.find((attempt) => attempt.level === 'programme')).toMatchObject({
      outcome: 'rejected',
      reason: 'reference-expired',
    });
    expect(resolved.attempts.find((attempt) => attempt.level === 'university')).toMatchObject({ outcome: 'selected' });
  });

  it('reaches city, country, and global levels only when more-specific keys are unavailable', () => {
    const city = createCostReferenceProvider(dataset([
      rawCost({
        level: 'city',
        key: 'city-living-v1',
        scopeKey: 'city-example',
        excludedCategories: [],
      }),
    ])).resolve({
      benefitType: 'living',
      context: { cityKey: 'city-example', countryKey: 'country-example' },
      asOf: '2026-09-24',
    });
    expect(city.level).toBe('city');

    const country = createCostReferenceProvider(dataset([
      rawCost({
        level: 'country',
        key: 'country-living-v1',
        scopeKey: 'country-example',
        excludedCategories: [],
      }),
    ])).resolve({
      benefitType: 'living',
      context: { cityKey: 'city-without-data', countryKey: 'country-example' },
      asOf: '2026-09-24',
    });
    expect(country.level).toBe('country');

    const global = createCostReferenceProvider(dataset([
      rawCost({
        level: 'global',
        key: 'global-living-v1',
        scopeKey: 'global',
        excludedCategories: [],
      }),
    ])).resolve({
      benefitType: 'living',
      context: {},
      asOf: '2026-09-24',
    });
    expect(global.level).toBe('global');
  });

  it('reports missing references without inventing a global value', () => {
    const resolved = createCostReferenceProvider(dataset([])).resolve({
      benefitType: 'accommodation',
      context: { countryKey: 'country-without-data' },
      asOf: '2026-09-24',
    });

    expect(resolved.record).toBeNull();
    expect(resolved.source).toBeNull();
    expect(resolved.attempts.at(-1)).toMatchObject({ level: 'global', outcome: 'missing' });
  });

  it('rejects malformed bounds and records the diagnostic', () => {
    const parsed = dataset([rawCost({ min: 2_000, max: 1_000 })]);

    expect(parsed.records).toHaveLength(0);
    expect(parsed.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'malformed-record', message: 'Cost max cannot be lower than min.' }),
    ]));
  });

  it('rejects malformed identifiers marked as known currencies', () => {
    const parsed = dataset([rawCost({ currency: 'not-a-currency', currencyStatus: 'known' })]);

    expect(parsed.records).toHaveLength(0);
    expect(parsed.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'malformed-record' }),
    ]));
  });

  it('rejects internally inconsistent cost-reference dates', () => {
    const parsed = dataset([
      rawCost({ key: 'effective-after-retrieval', effectiveDate: '2026-09-11', retrievalDate: '2026-09-10' }),
      rawCost({ key: 'expiry-before-retrieval', validUntil: '2026-09-09' }),
    ]);

    expect(parsed.records).toHaveLength(0);
    expect(parsed.diagnostics).toHaveLength(2);
  });

  it('rejects a future retrieval reference at lookup time', () => {
    const provider = createCostReferenceProvider(dataset([
      rawCost({ retrievalDate: '2026-10-01' }),
    ]));

    const resolved = provider.resolve({
      benefitType: 'living',
      context: { universityKey: 'university-example' },
      asOf: '2026-09-24',
    });

    expect(resolved.record).toBeNull();
    expect(resolved.attempts.find((attempt) => attempt.level === 'university')).toMatchObject({
      outcome: 'rejected',
      reason: 'reference-retrieval-in-future',
    });
  });

  it('preserves unknown currency and never defaults it to USD', () => {
    const parsed = dataset([
      rawCost({
        key: 'unknown-currency-living-v1',
        currency: 'RMB',
        currencyStatus: 'unknown',
        excludedCategories: [],
      }),
    ]);
    const resolved = createCostReferenceProvider(parsed).resolve({
      benefitType: 'living',
      context: { universityKey: 'university-example' },
      asOf: '2026-09-24',
    });

    expect(resolved.source?.amount).toMatchObject({ currency: 'RMB', currencyStatus: 'unknown' });
    expect(resolved.source?.amount.currency).not.toBe('USD');
  });

  it('carries included/excluded categories into the T2A cost source', () => {
    const parsed = dataset([
      rawCost({
        key: 'bundled-living-housing-v1',
        benefitType: 'living',
        includedCategories: ['living', 'accommodation'],
        excludedCategories: [],
        period: 'one-time',
      }),
    ]);
    const provider = createCostReferenceProvider(parsed);
    const resolved = provider.resolve({
      benefitType: 'accommodation',
      context: { universityKey: 'university-example' },
      asOf: '2026-09-24',
    });

    expect(resolved.source?.covers).toEqual(['living', 'accommodation']);
    expect(resolved.source?.id).toBe('bundled-living-housing-v1');
    expect(
      calculateScholarshipValue({
        benefits: [benefit({ type: 'accommodation', period: 'one-time' })],
        costSources: resolved.source ? [resolved.source] : [],
        policy: { comparableCurrency: 'USD' },
      }),
    ).toMatchObject({ complete: true, comparableTotalValue: { amount: 1_000 } });
  });

  it('keeps duplicate scope/category records deterministic', () => {
    const parsed = dataset([
      rawCost({ key: 'first-living-v1' }),
      rawCost({ key: 'second-living-v1', min: 1_400 }),
    ]);

    expect(parsed.records.map((record) => record.key)).toEqual(['first-living-v1']);
    expect(parsed.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'duplicate-record', key: 'second-living-v1' }),
    ]));
  });
});
