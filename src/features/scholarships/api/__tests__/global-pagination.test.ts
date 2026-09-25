import { describe, expect, it } from 'vitest';
import type { ScholarshipValueResult } from '../../domain/valuation';
import {
  paginateRanked,
  rankScholarships,
  type ScholarshipRankingCandidate,
} from '../../domain/ranking';

function amount(value: number): ScholarshipValueResult {
  return {
    status: 'EXACT',
    valueStatus: 'EXACT',
    complete: true,
    duration: null,
    scenarioKey: null,
    totalValue: { min: value, max: value, currency: 'USD', currencyStatus: 'known' },
    comparableTotalValue: { amount: value, currency: 'USD', bound: 'lower', fxVersion: 'fx-v1' },
    components: [],
    warnings: [],
  };
}

function candidate(id: number, value: number): ScholarshipRankingCandidate<number> {
  return {
    id,
    name: `Award ${id}`,
    deadline: null,
    value: amount(value),
    eligibility: null,
    fit: null,
    item: id,
  };
}

describe('global scholarship ranking pagination', () => {
  it('filters and ranks the complete candidate set before page slicing', () => {
    const filtered = [candidate(1, 10), candidate(2, 90), candidate(3, 50)];
    const ranked = rankScholarships(filtered, 'value_desc', { version: 'test-v1' });

    expect(paginateRanked(ranked, 1, 2).items.map((item) => item.id)).toEqual([2, 3]);
    expect(paginateRanked(ranked, 2, 2).items.map((item) => item.id)).toEqual([1]);
  });

  it('does not allow a page-local relevance pass to reorder server output', () => {
    const filtered = [candidate(2, 20), candidate(1, 10)];
    const ranked = rankScholarships(filtered, 'name', { version: 'test-v1' });

    // A client receiving this page must render the server order as-is. The
    // ranking contract is not a client-side post-pagination comparator.
    expect(paginateRanked(ranked, 1, 2).items.map((item) => item.id)).toEqual([1, 2]);
  });
});
