import type {
  BenefitComponent,
  BenefitDuration,
  BenefitDurationUnit,
} from './benefit-types';

export type DurationSource = 'scholarship' | 'programme' | 'application' | 'component';

/** A duration that has already been stated by a trusted caller or source. */
export type DurationValue = {
  count: number;
  unit: BenefitDurationUnit;
  rawText?: string;
};

export type DurationContext = {
  /** Explicit award duration. This always wins over programme/application fallbacks. */
  scholarship?: DurationValue | null;
  programme?: DurationValue | null;
  application?: DurationValue | null;
};

export type DurationInput = DurationValue | BenefitDuration | DurationContext;

export type ResolvedDuration = DurationValue & {
  source: DurationSource;
};

const DURATION_UNITS: readonly BenefitDurationUnit[] = ['month', 'year', 'term'];

function isDurationUnit(value: unknown): value is BenefitDurationUnit {
  return typeof value === 'string' && DURATION_UNITS.includes(value as BenefitDurationUnit);
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isDirectDuration(
  value: DurationInput | null | undefined,
): value is DurationValue | BenefitDuration {
  if (!value || typeof value !== 'object') return false;
  return 'count' in value && 'unit' in value;
}

function toResolvedDuration(
  value: DurationValue | BenefitDuration | null | undefined,
  source: DurationSource,
): ResolvedDuration | null {
  if (!value || !isPositiveFiniteNumber(value.count) || !isDurationUnit(value.unit)) return null;

  return {
    count: value.count,
    unit: value.unit,
    source,
    ...(value.rawText ? { rawText: value.rawText } : {}),
  };
}

function sameDuration(left: ResolvedDuration, right: ResolvedDuration): boolean {
  return left.count === right.count && left.unit === right.unit;
}

function explicitComponentDuration(benefits: readonly BenefitComponent[]): ResolvedDuration | null {
  const explicit = benefits
    .map((benefit) => toResolvedDuration(benefit.duration, 'component'))
    .filter((duration): duration is ResolvedDuration => duration !== null);

  if (explicit.length === 0) return null;

  const first = explicit[0]!;
  return explicit.every((duration) => sameDuration(first, duration))
    ? { ...first, source: 'scholarship' }
    : null;
}

/**
 * Resolve only durations supplied by a caller or explicit benefit evidence.
 * Deadline years, slot counts, and other unrelated numbers are intentionally
 * not accepted here, so they cannot become award duration by accident.
 */
export function resolveScholarshipDuration(args: {
  benefits?: readonly BenefitComponent[];
  duration?: DurationInput | null;
}): ResolvedDuration | null {
  const input = args.duration;

  if (isDirectDuration(input)) {
    return toResolvedDuration(input, 'scholarship');
  }

  const context = input ?? {};
  const explicit = toResolvedDuration(context.scholarship, 'scholarship');
  if (explicit) return explicit;

  const componentDuration = explicitComponentDuration(args.benefits ?? []);
  if (componentDuration) return componentDuration;

  const programme = toResolvedDuration(context.programme, 'programme');
  if (programme) return programme;

  return toResolvedDuration(context.application, 'application');
}

/** Convert a duration to months when the unit is unambiguous. */
export function durationInMonths(duration: DurationValue | null | undefined): number | null {
  if (!duration || !isPositiveFiniteNumber(duration.count)) return null;

  if (duration.unit === 'month') return duration.count;
  if (duration.unit === 'year') return duration.count * 12;
  return null;
}

/**
 * Return the number of periods represented by a duration. A term cannot be
 * converted to months or years without an explicit terms-per-year policy.
 */
export function periodMultiplier(args: {
  period: 'unspecified' | 'one-time' | 'monthly' | 'annual' | 'term' | 'total';
  duration: DurationValue | null | undefined;
  termsPerYear?: number;
}): number | null {
  const { period, duration } = args;

  if (period === 'unspecified' || period === 'one-time' || period === 'total') return 1;
  if (!duration || !isPositiveFiniteNumber(duration.count)) return null;

  if (period === 'monthly') {
    if (duration.unit === 'month') return duration.count;
    if (duration.unit === 'year') return duration.count * 12;
    if (duration.unit === 'term' && isPositiveFiniteNumber(args.termsPerYear)) {
      return duration.count * (12 / args.termsPerYear);
    }
    return null;
  }

  if (period === 'annual') {
    if (duration.unit === 'year') return duration.count;
    if (duration.unit === 'month') return duration.count / 12;
    if (duration.unit === 'term' && isPositiveFiniteNumber(args.termsPerYear)) {
      return duration.count / args.termsPerYear;
    }
    return null;
  }

  if (duration.unit === 'term') return duration.count;
  if (isPositiveFiniteNumber(args.termsPerYear)) {
    if (duration.unit === 'year') return duration.count * args.termsPerYear;
    if (duration.unit === 'month') return (duration.count / 12) * args.termsPerYear;
  }

  return null;
}
