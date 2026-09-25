import { describe, expect, it } from 'vitest';
import type { ScholarshipValueResult } from '../valuation';
import {
  paginateRanked,
  rankScholarships,
  scholarshipRankingCacheKey,
} from '../ranking';
import type { ScholarshipRankingCandidate } from '../ranking';

function value(
  amount: number,
  options: {
    max?: number;
    currency?: string;
    status?: ScholarshipValueResult['status'];
  } = {},
): ScholarshipValueResult {
  const currency = options.currency ?? 'USD';
  const max = options.max ?? amount;
  return {
    status: options.status ?? 'EXACT',
    valueStatus: options.status ?? 'EXACT',
    complete: true,
    duration: null,
    scenarioKey: null,
    totalValue: {
      min: amount,
      max,
      currency,
      currencyStatus: 'known',
    },
    comparableTotalValue: {
      amount,
      currency,
      bound: 'lower',
      fxVersion: 'test-fx-v1',
    },
    components: [],
    warnings: [],
  };
}

function candidate(
  id: number,
  options: {
    name?: string;
    deadline?: string | null;
    value?: ScholarshipValueResult | null;
    eligibility?: 'ELIGIBLE' | 'INELIGIBLE' | 'UNKNOWN';
    score?: number | null;
    fitStatus?: 'SCORED' | 'UNKNOWN' | 'INELIGIBLE';
  } = {},
): ScholarshipRankingCandidate<number> {
  const eligibility = options.eligibility ?? 'ELIGIBLE';
  const fitStatus = options.fitStatus ?? (eligibility === 'ELIGIBLE' ? 'SCORED' : eligibility);
  return {
    id,
    name: options.name ?? `Scholarship ${id}`,
    deadline: options.deadline ?? null,
    value: options.value ?? null,
    eligibility: { status: eligibility },
    fit: { fitStatus, score: options.score ?? null },
    item: id,
  };
}

const policy = { version: 'ranking-test-v1' };

describe('scholarship global ranking', () => {
  it('sorts value_desc by lower bound, then upper bound, with missing last', () => {
    const ranked = rankScholarships(
      [
        candidate(1, { value: value(10_000, { max: 50_000 }) }),
        candidate(2, { value: value(20_000) }),
        candidate(3, { value: null }),
        candidate(4, { value: value(20_000, { max: 25_000 }) }),
      ],
      'value_desc',
      policy,
    );

    expect(ranked.map((item) => item.id)).toEqual([4, 2, 1, 3]);
  });

  it('sorts value_asc by lower bound and still leaves missing values last', () => {
    const ranked = rankScholarships(
      [
        candidate(1, { value: value(10_000) }),
        candidate(2, { value: value(20_000) }),
        candidate(3, { value: null }),
      ],
      'value_asc',
      policy,
    );

    expect(ranked.map((item) => item.id)).toEqual([1, 2, 3]);
  });

  it('uses status quality after equal lower and upper bounds', () => {
    const ranked = rankScholarships(
      [
        candidate(1, { value: value(10_000, { status: 'ESTIMATED' }) }),
        candidate(2, { value: value(10_000, { status: 'EXACT' }) }),
        candidate(3, { value: value(10_000, { status: 'MIXED' }) }),
      ],
      'value_desc',
      policy,
    );

    expect(ranked.map((item) => item.id)).toEqual([2, 3, 1]);
  });

  it('keeps a mixed-currency set incomparable until an FX target is supplied', () => {
    const ranked = rankScholarships(
      [
        candidate(1, { name: 'USD award', value: value(90_000, { currency: 'USD' }) }),
        candidate(2, { name: 'GBP award', value: value(1_000, { currency: 'GBP' }) }),
      ],
      'value_desc',
      policy,
    );

    expect(ranked.map((item) => item.id)).toEqual([2, 1]);
  });

  it('uses T5 fit only for eligible candidates in relevance order', () => {
    const ranked = rankScholarships(
      [
        candidate(1, { score: 92, value: value(100) }),
        candidate(2, { score: 99, eligibility: 'INELIGIBLE', fitStatus: 'INELIGIBLE', value: value(1_000_000) }),
        candidate(3, { score: null, eligibility: 'UNKNOWN', fitStatus: 'UNKNOWN', value: value(2_000_000) }),
        candidate(4, { score: 75, value: value(200) }),
      ],
      'relevance',
      policy,
    );

    expect(ranked.map((item) => item.id)).toEqual([1, 4, 3, 2]);
  });

  it('preserves deadline and name behavior with deterministic id ties', () => {
    const deadline = rankScholarships(
      [
        candidate(2, { name: 'Beta', deadline: '2027-06-01' }),
        candidate(1, { name: 'Alpha', deadline: '2027-06-01' }),
        candidate(3, { name: 'Gamma', deadline: null }),
      ],
      'deadline',
      policy,
    );
    const name = rankScholarships(
      [candidate(2, { name: 'same' }), candidate(1, { name: 'same' })],
      'name',
      policy,
    );

    expect(deadline.map((item) => item.id)).toEqual([1, 2, 3]);
    expect(name.map((item) => item.id)).toEqual([1, 2]);
  });

  it('paginates only after the complete ranked list is ordered', () => {
    const ranked = rankScholarships(
      [candidate(1, { value: value(10) }), candidate(2, { value: value(100) }), candidate(3, { value: value(50) })],
      'value_desc',
      policy,
    );

    expect(paginateRanked(ranked, 1, 2).items.map((item) => item.id)).toEqual([2, 3]);
    expect(paginateRanked(ranked, 2, 2).items.map((item) => item.id)).toEqual([1]);
  });
});

describe('scholarship ranking cache identity', () => {
  const common = {
    filtersKey: 'country=Canada',
    sort: 'relevance' as const,
    costReferenceVersion: 'cost-v1',
    fxVersion: 'fx-v1',
    fitPolicyVersion: 'fit-v1',
  };

  it('separates public and user/profile-specific ranking keys', () => {
    const publicKey = scholarshipRankingCacheKey({ scope: 'public', ...common });
    const userKey = scholarshipRankingCacheKey({
      scope: 'user',
      userId: 'user-1',
      profileVersion: 'profile-2',
      ...common,
    });

    expect(publicKey).not.toBe(userKey);
    expect(userKey).toContain('user-1');
    expect(userKey).toContain('profile-2');
    expect(() => scholarshipRankingCacheKey({ scope: 'user', ...common })).toThrow(/user id/i);
    expect(() => scholarshipRankingCacheKey({ scope: 'public', userId: 'user-1', ...common })).toThrow(/public/i);
  });

  it('changes when a ranking dependency version changes', () => {
    const first = scholarshipRankingCacheKey({ scope: 'public', ...common, fxVersion: 'fx-v1' });
    const second = scholarshipRankingCacheKey({ scope: 'public', ...common, fxVersion: 'fx-v2' });
    expect(first).not.toBe(second);
  });
});
