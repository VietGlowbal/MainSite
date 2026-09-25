import type { ScholarshipEligibilityResult } from './eligibility';
import type { PersonalFitResult } from './personal-fit';
import type { ScholarshipValueResult } from './valuation';
import {
  commonComparableCurrency,
  compareScholarshipValues,
  SCHOLARSHIP_VALUE_SORT_VERSION,
  valueSortInputFromResult,
  type ScholarshipValueSortInput,
} from './value-sort';

export const SCHOLARSHIP_RANKING_VERSION = 'scholarship-ranking-v1';
export const SCHOLARSHIP_BENEFIT_NORMALIZER_VERSION = 'scholarship-benefit-normalizer-v1';
export const SCHOLARSHIP_VALUATION_VERSION = 'scholarship-valuation-v1';
export const SCHOLARSHIP_QUERY_VERSION = 'scholarship-query-v2';

export type ScholarshipRankingSort =
  | 'relevance'
  | 'value_desc'
  | 'value_asc'
  | 'deadline'
  | 'name';

export type ScholarshipRankingCandidate<T = unknown> = {
  id: number;
  name: string;
  deadline: string | number | null;
  value: ScholarshipValueResult | null;
  eligibility: Pick<ScholarshipEligibilityResult, 'status'> | null;
  fit: Pick<PersonalFitResult, 'fitStatus' | 'score'> | null;
  item: T;
};

export type ScholarshipRankingPolicy = {
  /** A versioned policy is required for reproducible cached ordering. */
  version: string;
  /** Required when an injected FX provider produced one target currency. */
  comparisonCurrency?: string | null;
};

export type RankedPage<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

export type ScholarshipRankingCacheKeyInput = {
  scope: 'public' | 'user';
  userId?: string | null;
  profileVersion?: string | null;
  queryVersion?: string;
  filtersKey: string;
  sort: ScholarshipRankingSort;
  comparisonCurrency?: string | null;
  normalizerVersion?: string;
  valuationVersion?: string;
  valueSortVersion?: string;
  costReferenceVersion: string;
  fxVersion: string;
  fitPolicyVersion: string;
};

function finite(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value);
}

function deadlineValue(value: string | number | null): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : Infinity;
  if (!value) return Infinity;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : Infinity;
}

function compareDeadline(left: string | number | null, right: string | number | null): number {
  const leftValue = deadlineValue(left);
  const rightValue = deadlineValue(right);
  if (leftValue === rightValue) return 0;
  if (leftValue === Infinity) return 1;
  if (rightValue === Infinity) return -1;
  return leftValue - rightValue;
}

function compareName(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: 'base' }) || left.localeCompare(right);
}

function compareId(left: number, right: number): number {
  return left - right;
}

function fitRank(candidate: ScholarshipRankingCandidate): number {
  if (
    candidate.eligibility?.status === 'ELIGIBLE' &&
    candidate.fit?.fitStatus === 'SCORED' &&
    finite(candidate.fit.score)
  ) return 0;
  if (candidate.eligibility?.status === 'ELIGIBLE') return 1;
  if (candidate.eligibility?.status === 'UNKNOWN') return 2;
  return 3;
}

function comparableCurrency(
  candidates: readonly ScholarshipRankingCandidate[],
  policy: ScholarshipRankingPolicy,
): string | null {
  const explicit = policy.comparisonCurrency?.trim().toUpperCase() ?? null;
  if (explicit) return explicit;

  const values = candidates.map((candidate) => valueSortInputFromResult(candidate.value));
  return commonComparableCurrency(values);
}

function rankingValue(
  result: ScholarshipValueResult | null,
  currenciesAreComparable: boolean,
): ScholarshipValueSortInput {
  const value = valueSortInputFromResult(result);
  if (!currenciesAreComparable && value.comparableTotalValue !== null) {
    return { ...value, comparableTotalValue: null, upperBound: null };
  }
  return value;
}

function compareByRelevance(
  left: ScholarshipRankingCandidate,
  right: ScholarshipRankingCandidate,
  currency: string | null,
  currenciesAreComparable: boolean,
): number {
  if (
    left.eligibility === null &&
    left.fit === null &&
    right.eligibility === null &&
    right.fit === null
  ) {
    return compareDeadline(left.deadline, right.deadline) ||
      compareName(left.name, right.name) ||
      compareId(left.id, right.id);
  }

  const fitOrder = fitRank(left) - fitRank(right);
  if (fitOrder !== 0) return fitOrder;

  const leftScore = fitRank(left) === 0 && finite(left.fit?.score) ? left.fit.score : null;
  const rightScore = fitRank(right) === 0 && finite(right.fit?.score) ? right.fit.score : null;
  if (leftScore !== rightScore) {
    if (leftScore === null) return 1;
    if (rightScore === null) return -1;
    return rightScore - leftScore;
  }

  return compareScholarshipValues(
    {
      ...rankingValue(left.value, currenciesAreComparable),
      deadline: left.deadline,
      name: left.name,
      id: left.id,
    },
    {
      ...rankingValue(right.value, currenciesAreComparable),
      deadline: right.deadline,
      name: right.name,
      id: right.id,
    },
    'desc',
    currency,
  );
}

function compareCandidates(
  left: ScholarshipRankingCandidate,
  right: ScholarshipRankingCandidate,
  sort: ScholarshipRankingSort,
  currency: string | null,
  currenciesAreComparable: boolean,
): number {
  if (sort === 'relevance') return compareByRelevance(left, right, currency, currenciesAreComparable);
  if (sort === 'value_desc' || sort === 'value_asc') {
    return compareScholarshipValues(
      {
        ...rankingValue(left.value, currenciesAreComparable),
        deadline: left.deadline,
        name: left.name,
        id: left.id,
      },
      {
        ...rankingValue(right.value, currenciesAreComparable),
        deadline: right.deadline,
        name: right.name,
        id: right.id,
      },
      sort === 'value_desc' ? 'desc' : 'asc',
      currency,
    );
  }
  if (sort === 'deadline') return compareDeadline(left.deadline, right.deadline) || compareName(left.name, right.name) || compareId(left.id, right.id);
  return compareName(left.name, right.name) || compareId(left.id, right.id);
}

/**
 * Sort the complete filtered candidate set. This function never slices or
 * paginates, so callers cannot accidentally reintroduce page-local ranking.
 */
export function rankScholarships<T>(
  candidates: readonly ScholarshipRankingCandidate<T>[],
  sort: ScholarshipRankingSort,
  policy: ScholarshipRankingPolicy,
): ScholarshipRankingCandidate<T>[] {
  if (!policy.version.trim()) throw new Error('Scholarship ranking policy version is required.');

  const values = candidates.map((candidate) => valueSortInputFromResult(candidate.value));
  const explicitCurrency = policy.comparisonCurrency?.trim().toUpperCase() ?? null;
  const currencies = new Set(
    values
      .map((value) => value.comparableTotalValue?.currency.trim().toUpperCase() ?? null)
      .filter((currency): currency is string => currency !== null),
  );
  const currency = explicitCurrency ?? comparableCurrency(candidates, policy);
  // If a caller did not inject a target currency and the candidate set mixes
  // currencies, comparing their raw numbers would be incorrect. They remain
  // visible but their values are treated as unavailable until T2B supplies FX.
  const currenciesAreComparable = explicitCurrency !== null || currencies.size <= 1;

  return [...candidates].sort((left, right) =>
    compareCandidates(left, right, sort, currency, currenciesAreComparable),
  );
}

/** Paginate only after {@link rankScholarships} has produced final ordering. */
export function paginateRanked<T>(
  candidates: readonly T[],
  page: number,
  pageSize: number,
): RankedPage<T> {
  const safePage = Number.isFinite(page) ? Math.max(1, Math.trunc(page)) : 1;
  const safePageSize = Number.isFinite(pageSize) ? Math.max(1, Math.trunc(pageSize)) : 1;
  const start = (safePage - 1) * safePageSize;
  const total = candidates.length;
  return {
    items: [...candidates].slice(start, start + safePageSize),
    total,
    page: safePage,
    pageSize: safePageSize,
    hasMore: safePage * safePageSize < total,
  };
}

function keyPart(value: string | number | null | undefined): string {
  return encodeURIComponent(value == null ? '-' : String(value));
}

/**
 * Build a cache identity that cannot collide between public catalogue pages
 * and user/profile-specific ranking results.
 */
export function scholarshipRankingCacheKey(input: ScholarshipRankingCacheKeyInput): string {
  if (input.scope === 'user' && !input.userId) {
    throw new Error('User ranking cache keys require a user id.');
  }
  if (input.scope === 'public' && (input.userId || input.profileVersion)) {
    throw new Error('Public ranking cache keys cannot contain user identity.');
  }
  return [
    SCHOLARSHIP_RANKING_VERSION,
    input.scope,
    input.scope === 'user' ? keyPart(input.userId) : 'public',
    input.scope === 'user' ? keyPart(input.profileVersion) : '-',
    keyPart(input.queryVersion ?? SCHOLARSHIP_QUERY_VERSION),
    keyPart(input.normalizerVersion ?? SCHOLARSHIP_BENEFIT_NORMALIZER_VERSION),
    keyPart(input.valuationVersion ?? SCHOLARSHIP_VALUATION_VERSION),
    keyPart(input.valueSortVersion ?? SCHOLARSHIP_VALUE_SORT_VERSION),
    keyPart(input.costReferenceVersion),
    keyPart(input.fxVersion),
    keyPart(input.fitPolicyVersion),
    keyPart(input.filtersKey),
    keyPart(input.sort),
    keyPart(input.comparisonCurrency),
  ].join('|');
}
