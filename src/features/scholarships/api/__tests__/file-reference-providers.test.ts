import { describe, expect, it } from 'vitest';
import {
  FILE_COST_REFERENCE_DATASET,
  FILE_FX_REFERENCE_DATASET,
  getFileCostReferenceProvider,
  getFileFxReferenceProvider,
} from '../file-reference-providers';

describe('file-backed scholarship reference providers', () => {
  it('exposes versioned but incomplete cost coverage without fabricated values', () => {
    const provider = getFileCostReferenceProvider();
    const result = provider.resolve({
      benefitType: 'living',
      context: { countryKey: 'any-country' },
      asOf: '2026-09-24',
    });

    expect(FILE_COST_REFERENCE_DATASET.version).toBe('cost-references-v1-empty');
    expect(FILE_COST_REFERENCE_DATASET.coverage).toBe('incomplete');
    expect(FILE_COST_REFERENCE_DATASET.records).toHaveLength(0);
    expect(result.source).toBeNull();
  });

  it('exposes versioned but incomplete FX coverage without an implicit rate', () => {
    const provider = getFileFxReferenceProvider({ asOf: '2026-09-24' });

    expect(FILE_FX_REFERENCE_DATASET.version).toBe('fx-rates-v1-empty');
    expect(FILE_FX_REFERENCE_DATASET.coverage).toBe('incomplete');
    expect(FILE_FX_REFERENCE_DATASET.rates).toHaveLength(0);
    expect(provider.convert(10, 'GBP', 'USD')).toBeNull();
  });
});
