import { describe, expect, it } from 'vitest';
import { createFxReferenceProvider, parseFxReferenceDataset } from '../fx-reference';

function rawRate(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    key: 'gbp-usd-2026-09-20',
    baseCurrency: 'GBP',
    quoteCurrency: 'USD',
    rate: 1.25,
    effectiveDate: '2026-09-20',
    source: 'https://example.test/fx',
    retrievalDate: '2026-09-21',
    version: 'fx-test-v1',
    ...overrides,
  };
}

function dataset(rates: readonly Record<string, unknown>[]) {
  return parseFxReferenceDataset({
    version: 'fx-test-v1',
    coverage: 'partial',
    defaultMaxAgeDays: 30,
    rates,
  });
}

describe('versioned FX provider', () => {
  it('selects the latest effective version and preserves metadata', () => {
    const provider = createFxReferenceProvider(
      dataset([
        rawRate({ key: 'gbp-usd-older', effectiveDate: '2026-09-01', rate: 1.2 }),
        rawRate({ key: 'gbp-usd-current', effectiveDate: '2026-09-20', rate: 1.25 }),
      ]),
      { asOf: '2026-09-24' },
    );
    const resolved = provider.resolve('GBP', 'USD');

    expect(resolved).toMatchObject({
      status: 'resolved',
      rate: 1.25,
      direction: 'direct',
      record: { key: 'gbp-usd-current', effectiveDate: '2026-09-20', version: 'fx-test-v1' },
    });
    expect(provider.version).toBe('fx-test-v1');
    expect(provider.convert(10, 'GBP', 'USD')).toBe(12.5);
  });

  it('supports an inverse lookup without inventing a second rate', () => {
    const provider = createFxReferenceProvider(
      dataset([rawRate({ baseCurrency: 'USD', quoteCurrency: 'GBP', rate: 0.8 })]),
      { asOf: '2026-09-24' },
    );

    expect(provider.resolve('GBP', 'USD')).toMatchObject({
      status: 'resolved',
      direction: 'inverse',
      rate: 1.25,
    });
  });

  it('returns missing for unknown, stale, and unavailable FX', () => {
    const provider = createFxReferenceProvider(
      dataset([rawRate({ retrievalDate: '2025-01-01', validUntil: '2025-12-31' })]),
      { asOf: '2026-09-24' },
    );

    expect(provider.resolve('XYZ', 'USD')).toMatchObject({ status: 'missing', reason: 'missing-rate' });
    expect(provider.resolve('GBP', 'USD')).toMatchObject({ status: 'missing', reason: 'rate-expired' });
    expect(provider.convert(10, 'GBP', 'USD')).toBeNull();
  });

  it('validates rates and keeps malformed records out of the provider', () => {
    const parsed = dataset([
      rawRate({ key: 'bad-rate', rate: 0 }),
      rawRate({ key: 'bad-version', version: 'other-version' }),
    ]);

    expect(parsed.rates).toHaveLength(0);
    expect(parsed.diagnostics).toHaveLength(2);
    expect(parsed.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      'malformed-rate',
      'malformed-rate',
    ]);
  });

  it('uses identity only for the same explicit currency', () => {
    const provider = createFxReferenceProvider(dataset([]), { asOf: '2026-09-24' });

    expect(provider.resolve('USD', 'USD')).toMatchObject({ status: 'resolved', rate: 1, direction: 'identity' });
    expect(provider.convert(10, 'USD', 'USD')).toBe(10);
  });
});
