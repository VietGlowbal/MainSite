import type { BenefitConfidence } from './benefit-types';
import type {
  ScholarshipValueResult,
  ValueStatus,
} from './valuation';

/** The ordering policy is deliberately versioned so cached pages can be invalidated. */
export const SCHOLARSHIP_VALUE_SORT_VERSION = 'scholarship-value-sort-v1';

export type ValueSortDirection = 'asc' | 'desc';

export type ScholarshipValueSortInput = {
  /** T2A's lower-bound comparable value. */
  comparableTotalValue: ScholarshipValueResult['comparableTotalValue'];
  /** Used only as the range tie-break after the lower bound. */
  upperBound: number | null;
  status: ValueStatus | null;
  evidenceQuality: BenefitConfidence | null;
};

export type ValueSortCandidate = ScholarshipValueSortInput & {
  deadline: string | number | null;
  name: string;
  id: string | number;
};

const STATUS_QUALITY: Readonly<Record<ValueStatus, number>> = {
  EXACT: 3,
  MIXED: 2,
  ESTIMATED: 1,
};

const EVIDENCE_QUALITY: Readonly<Record<BenefitConfidence, number>> = {
  high: 3,
  medium: 2,
  low: 1,
};

function finite(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value);
}

function normalizedCurrency(value: string | null | undefined): string | null {
  const normalized = value?.trim().toUpperCase() ?? '';
  return normalized.length > 0 ? normalized : null;
}

function comparableAmount(
  value: ScholarshipValueSortInput,
  comparisonCurrency: string | null,
): number | null {
  const comparable = value.comparableTotalValue;
  if (!comparable || !finite(comparable.amount)) return null;
  const currency = normalizedCurrency(comparable.currency);
  if (!currency) return null;
  if (comparisonCurrency !== null && currency !== comparisonCurrency) return null;
  return comparable.amount;
}

function compareNumber(
  left: number | null,
  right: number | null,
  direction: ValueSortDirection,
): number {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return direction === 'desc' ? right - left : left - right;
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

function compareId(left: string | number, right: string | number): number {
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return String(left).localeCompare(String(right), undefined, { numeric: true }) ||
    String(left).localeCompare(String(right));
}

/**
 * Derive the range/status metadata used by the v1 value comparator.
 *
 * T2A exposes the lower bound as the only comparable number. The upper bound
 * is taken from the already-normalized total only when it is in the same
 * comparable currency; no independent FX or USD fallback is introduced here.
 */
export function valueSortInputFromResult(
  result: ScholarshipValueResult | null | undefined,
): ScholarshipValueSortInput {
  const comparable = result?.comparableTotalValue ?? null;
  const comparableCurrency = normalizedCurrency(comparable?.currency);
  const total = result?.totalValue ?? null;
  const totalCurrency = normalizedCurrency(total?.currency);
  const upperBound =
    comparableCurrency !== null && comparableCurrency === totalCurrency && total !== null
      ? (finite(total.max) ? total.max : total.min)
      : null;
  const included = result?.components.filter((component) => component.included) ?? [];
  const evidenceQuality = included.length === 0
    ? null
    : included.reduce<BenefitConfidence | null>((lowest, component) => {
        if (component.confidence === null) return lowest;
        if (lowest === null) return component.confidence;
        return EVIDENCE_QUALITY[component.confidence] < EVIDENCE_QUALITY[lowest]
          ? component.confidence
          : lowest;
      }, null);

  return {
    comparableTotalValue: comparable,
    upperBound,
    status: result?.status ?? null,
    evidenceQuality,
  };
}

/**
 * Compare two complete value candidates. Missing/undefensible values always
 * sort after comparable values, including for ascending (lowest-value) sort.
 */
export function compareScholarshipValues(
  left: ValueSortCandidate,
  right: ValueSortCandidate,
  direction: ValueSortDirection,
  comparisonCurrency: string | null = null,
): number {
  const currency = normalizedCurrency(comparisonCurrency);
  const lower = compareNumber(
    comparableAmount(left, currency),
    comparableAmount(right, currency),
    direction,
  );
  if (lower !== 0) return lower;

  const leftComparable = comparableAmount(left, currency);
  const rightComparable = comparableAmount(right, currency);
  const leftAvailable = leftComparable !== null;
  const rightAvailable = rightComparable !== null;
  if (leftAvailable !== rightAvailable) return leftAvailable ? -1 : 1;

  if (leftAvailable && rightAvailable) {
    const upper = compareNumber(left.upperBound, right.upperBound, direction);
    if (upper !== 0) return upper;
  }

  const status = (STATUS_QUALITY[right.status ?? 'ESTIMATED'] ?? 0) -
    (STATUS_QUALITY[left.status ?? 'ESTIMATED'] ?? 0);
  if (status !== 0) return status;

  const evidence = (EVIDENCE_QUALITY[right.evidenceQuality ?? 'low'] ?? 0) -
    (EVIDENCE_QUALITY[left.evidenceQuality ?? 'low'] ?? 0);
  if (evidence !== 0) return evidence;

  return compareDeadline(left.deadline, right.deadline) ||
    compareName(left.name, right.name) ||
    compareId(left.id, right.id);
}

/** Return the one currency shared by all available values, or null. */
export function commonComparableCurrency(
  values: readonly ScholarshipValueSortInput[],
): string | null {
  let currency: string | null = null;
  for (const value of values) {
    const candidate = normalizedCurrency(value.comparableTotalValue?.currency);
    if (candidate === null) continue;
    if (currency === null) currency = candidate;
    else if (currency !== candidate) return null;
  }
  return currency;
}
