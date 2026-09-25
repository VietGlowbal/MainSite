import { normalizeScholarshipBenefits } from './benefit-normalization';
import type {
  BenefitAmount,
  BenefitComponent,
  BenefitEvidence,
  BenefitPeriod,
  BenefitType,
  NormalizedScholarshipBenefits,
  ScholarshipBenefitNormalizationInput,
} from './benefit-types';
import {
  calculateScholarshipValue,
  type ScholarshipValueResult,
} from './valuation';
import type {
  ScholarshipValueBreakdownItem,
  ScholarshipValueKind,
  ScholarshipTextTranslator,
  ScholarshipValueViewModel,
} from '@/shared/types/scholarship-value';

export type {
  ScholarshipValueBreakdownItem,
  ScholarshipValueKind,
  ScholarshipValueViewModel,
} from '@/shared/types/scholarship-value';

const identityTranslate: ScholarshipTextTranslator = (source, vars) => {
  if (!vars) return source;
  return source.replace(/\{(\w+)\}/g, (_, key) => (key in vars ? String(vars[key]) : `{${key}}`));
};

export type ScholarshipValueFormattingInput = {
  value?: ScholarshipValueResult | null | undefined;
  benefits?: NormalizedScholarshipBenefits | readonly BenefitComponent[] | null | undefined;
  /** Raw catalogue fields are a display fallback, never a valuation source. */
  raw?: ScholarshipBenefitNormalizationInput | null | undefined;
};

const BENEFIT_LABELS: Readonly<Record<BenefitType, string>> = {
  tuition: 'Tuition',
  living: 'Living allowance',
  accommodation: 'Accommodation',
  stipend: 'Stipend',
  meals: 'Meals',
  travel: 'Travel',
  insurance: 'Insurance',
  'books-materials': 'Books and materials',
  other: 'Other benefit',
};

const PERIOD_LABELS: Readonly<Record<BenefitPeriod, string | null>> = {
  unspecified: null,
  'one-time': 'one-time',
  monthly: '/month',
  annual: '/year',
  term: '/term',
};

function componentsFrom(
  benefits: ScholarshipValueFormattingInput['benefits'],
): readonly BenefitComponent[] {
  if (!benefits) return [];
  if ('components' in benefits) return benefits.components;
  return benefits;
}

function normalizedBenefitsFrom(input: ScholarshipValueFormattingInput): NormalizedScholarshipBenefits {
  if (input.benefits && 'components' in input.benefits) return input.benefits;
  if (input.benefits) {
    return {
      components: [...input.benefits],
      scenarios: [],
      classification: {
        label: 'unknown',
        tuitionCoverage: 'unspecified',
        fullRideStatus: 'not-claimed',
        fullRideClaimed: false,
        fullyFundedClaimed: false,
        nonTuitionTypes: [...new Set(input.benefits.map((component) => component.type).filter((type) => type !== 'tuition'))],
      },
      raw: {
        coverage: null,
        amountMin: null,
        amountMax: null,
        amountCurrency: null,
        fundingType: [],
        sourceUrl: null,
        fields: {},
      },
      warnings: [],
    };
  }
  return normalizeScholarshipBenefits(input.raw ?? {});
}

function knownCurrency(currency: string | null | undefined): currency is string {
  return typeof currency === 'string' && /^[A-Za-z]{3}$/.test(currency.trim());
}

function numberFormatter(locale: string): Intl.NumberFormat {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
  });
}

export function formatMoneyAmount(
  amount: BenefitAmount | null | undefined,
  locale = 'en-US',
  t: ScholarshipTextTranslator = identityTranslate,
): string | null {
  if (!amount || !Number.isFinite(amount.min)) return null;
  const formatter = numberFormatter(locale);
  const min = knownCurrency(amount.currency) && amount.currencyStatus === 'known'
    ? new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: amount.currency.toUpperCase(),
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
      }).format(amount.min)
    : formatter.format(amount.min);
  if (amount.max == null || amount.max === amount.min) {
    return amount.currencyStatus === 'known' && knownCurrency(amount.currency)
      ? min
      : `${min} (${t('currency unavailable')})`;
  }
  const max = knownCurrency(amount.currency) && amount.currencyStatus === 'known'
    ? new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: amount.currency.toUpperCase(),
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
      }).format(amount.max)
    : formatter.format(amount.max);
  const suffix = amount.currencyStatus === 'known' && knownCurrency(amount.currency)
    ? ''
    : ` (${t('currency unavailable')})`;
  return `${min}–${max}${suffix}`;
}

function formatPeriod(period: BenefitPeriod, t: ScholarshipTextTranslator): string | null {
  const label = PERIOD_LABELS[period];
  return label ? t(label) : null;
}

function formatDuration(
  duration: { count: number; unit: string } | null | undefined,
  t: ScholarshipTextTranslator,
): string | null {
  if (!duration || !Number.isFinite(duration.count)) return null;
  const count = Number.isInteger(duration.count) ? String(duration.count) : String(duration.count);
  const unit = duration.unit === 'month' ? 'month' : duration.unit === 'term' ? 'term' : 'year';
  return t(`{count} ${unit}${duration.count === 1 ? '' : 's'}`, { count });
}

function tuitionPercentage(component: BenefitComponent): string | null {
  if (!component.percentage) return null;
  const min = component.percentage.min;
  const max = component.percentage.max;
  return max != null && max !== min ? `${min}%–${max}%` : `${min}%`;
}

function coverageLabel(
  normalized: NormalizedScholarshipBenefits,
  components: readonly BenefitComponent[],
  t: ScholarshipTextTranslator,
): string | null {
  const tuition = components.find((component) => component.type === 'tuition');
  const fullRide = normalized.classification.fullRideStatus === 'supported';
  if (tuition) {
    const percentage = tuitionPercentage(tuition);
    if (fullRide) return t('{percentage} Full-ride', { percentage: percentage ?? '100%' });
    if (percentage) return t('{percentage} Tuition', { percentage });
    if (tuition.coverage === 'full') return t('100% Tuition');
  }
  if (fullRide) return t('Full-ride');
  if (normalized.classification.fullyFundedClaimed) return t('Fully funded — details incomplete');
  if (components.some((component) => component.type !== 'tuition')) {
    return t('Benefits included');
  }
  return null;
}

function sourceLabel(
  source: ScholarshipValueBreakdownItem['status'],
  sourceType: string | null,
  t: ScholarshipTextTranslator,
): string | null {
  if (sourceType === 'cost-reference' || sourceType?.endsWith('-cost-reference')) {
    return t('Estimated reference');
  }
  if (sourceType === 'programme' || sourceType === 'programme-tuition') {
    return t('Programme tuition reference');
  }
  if (sourceType === 'catalogue-field') return t('Published scholarship field');
  if (sourceType) return t(sourceType);
  if (source === 'EXACT') return t('Published scholarship field');
  if (source === 'ESTIMATED') return t('Estimated reference');
  return null;
}

function originalAmountFor(
  component: BenefitComponent,
  locale: string,
  t: ScholarshipTextTranslator,
): string | null {
  // Percentage coverage is already represented by coverageLabel. Repeating
  // the bare percentage as an "award amount" makes 50% Tuition read as two
  // competing values in compact cards.
  if (component.valueKind === 'percentage') return null;
  return formatMoneyAmount(component.amount, locale, t);
}

function valueForDisplay(
  value: ScholarshipValueResult | null | undefined,
  t: ScholarshipTextTranslator,
): { amount: BenefitAmount; kind: ScholarshipValueKind; statusLabel: string } | null {
  const totalValue = value?.totalValue;
  const comparableValue = value?.comparableTotalValue;
  if (!totalValue && !comparableValue) return null;
  const kind: ScholarshipValueKind = value?.status === 'EXACT'
    ? 'exact'
    : value?.status === 'MIXED'
      ? 'mixed'
      : 'estimated';
  return {
    amount: {
      min: totalValue?.min ?? comparableValue!.amount,
      max: totalValue?.max ?? (totalValue ? null : comparableValue!.amount),
      currency: totalValue?.currency ?? comparableValue!.currency,
      currencyStatus: totalValue?.currencyStatus ?? 'known',
    },
    kind,
    statusLabel: t(kind === 'exact' ? 'Exact' : kind === 'mixed' ? 'Mixed estimate' : 'Estimated'),
  };
}

function collectEvidence(
  normalized: NormalizedScholarshipBenefits,
  value: ScholarshipValueResult | null | undefined,
): BenefitEvidence[] {
  const all = [
    ...normalized.components.flatMap((component) => component.evidence),
    ...(value?.components ?? []).flatMap((component) => component.evidence),
  ];
  return all.filter((item, index) => all.findIndex((candidate) =>
    candidate.sourceField === item.sourceField && candidate.excerpt === item.excerpt && candidate.sourceUrl === item.sourceUrl,
  ) === index);
}

function valueWarningLabel(warning: string): string {
  const labels: Readonly<Record<string, string>> = {
    'scenario-selection-required': 'A benefit scenario must be selected before a total can be calculated.',
    'complete-total-unavailable': 'The available evidence is not sufficient to calculate a defensible total.',
    'unknown-currency-comparable-unavailable': 'An amount was preserved with an unknown currency; no USD default was applied.',
    'comparable-value-unavailable': 'No defensible comparable monetary value is available for ranking.',
  };
  return labels[warning] ?? warning;
}

export function createScholarshipValueViewModel(
  input: ScholarshipValueFormattingInput,
  locale = 'en-US',
  t: ScholarshipTextTranslator = identityTranslate,
): ScholarshipValueViewModel {
  const normalized = normalizedBenefitsFrom(input);
  const benefits = componentsFrom(normalized);
  const value = input.value ?? null;
  const displayValue = valueForDisplay(value, t);
  const components = benefits.map((component, index): ScholarshipValueBreakdownItem => {
    const valuation = value?.components[index] ?? null;
    const status = valuation?.totalValue
      ? valuation.status
      : 'UNAVAILABLE';
    const total = valuation?.totalValue ? formatMoneyAmount(valuation.totalValue, locale, t) : null;
    return {
      type: component.type,
      label: t(BENEFIT_LABELS[component.type]),
      amountLabel: originalAmountFor(component, locale, t),
      totalLabel: total,
      periodLabel: formatPeriod(component.period, t),
      durationLabel: formatDuration(component.duration ?? value?.duration, t),
      status,
      sourceLabel: sourceLabel(status, valuation?.sourceType ?? null, t),
      included: valuation?.included ?? true,
      reason: valuation?.reason ?? null,
      evidence: valuation?.evidence ?? component.evidence,
    };
  });
  const originalAmounts = components
    .filter((component) => component.included && component.amountLabel)
    .map((component) => component.amountLabel!);
  const totalValueLabel = displayValue
    ? displayValue.kind === 'estimated'
      ? t('≈ {amount} estimated total value', {
          amount: formatMoneyAmount(displayValue.amount, locale, t) ?? '',
        })
      : t('{amount} total value — {status}', {
          amount: formatMoneyAmount(displayValue.amount, locale, t) ?? '',
          status: displayValue.statusLabel,
        })
    : t('Total value unavailable');
  const rawSourceUrl = normalized.raw.sourceUrl;
  return {
    coverageLabel: coverageLabel(normalized, benefits, t),
    originalAwardLabel: originalAmounts.length > 0 ? [...new Set(originalAmounts)].join(' + ') : null,
    totalValueLabel,
    totalValueKind: displayValue?.kind ?? 'unavailable',
    totalValueStatusLabel: displayValue?.statusLabel ?? null,
    durationLabel: formatDuration(value?.duration, t),
    components,
    evidence: collectEvidence(normalized, value),
    sourceUrl: rawSourceUrl,
    warnings: [...new Set([
      ...normalized.warnings.map((warning) => t(warning.message)),
      ...(value?.warnings ?? []).map((warning) => t(valueWarningLabel(warning))),
    ])],
    hasComparableValue: value?.comparableTotalValue != null,
  };
}

/**
 * Safe explicit-benefit valuation for surfaces that do not have a matching
 * programme/cost context. It deliberately leaves full coverage and periodic
 * benefits unavailable when the required context is absent.
 */
export function calculateDisplayScholarshipValue(
  benefits: NormalizedScholarshipBenefits | readonly BenefitComponent[],
): ScholarshipValueResult {
  const components: readonly BenefitComponent[] = 'components' in benefits ? benefits.components : benefits;
  const currencies = [...new Set(
    components
      .map((component) => component.amount)
      .filter((amount): amount is BenefitAmount => amount != null && amount.currencyStatus === 'known' && amount.currency != null)
      .map((amount) => amount.currency!.toUpperCase()),
  )];
  const policy = currencies.length === 1 && currencies[0]
    ? { comparableCurrency: currencies[0] }
    : undefined;
  return policy
    ? calculateScholarshipValue({ benefits: components, policy })
    : calculateScholarshipValue({ benefits: components });
}

export function recommendationReasonLabel(code: string): string {
  const labels: Record<string, string> = {
    'target-country-match': 'Target country match',
    'target-university-match': 'Target university match',
    'programme-match': 'Selected programme match',
    'subject-match': 'Subject or major match',
    'study-level-match': 'Study-level match',
    'intake-match': 'Target intake match',
    'funding-preference-match': 'Funding preference match',
    'budget-aligned': 'Budget aligned',
    'study-mode-match': 'Study mode match',
    'personal-fit-match': 'Strong personal fit',
    'strong-financial-value': 'Strong financial value',
    'full-tuition': '100% tuition coverage',
    'exact-award-value': 'Exact award value',
    'mixed-award-value': 'Mixed award value',
    'estimated-award-value': 'Estimated award value',
    'incomplete-eligibility': 'Eligibility needs verification',
    'incomplete-evidence': 'Some evidence is incomplete',
    'no-comparable-value': 'Comparable value unavailable',
    'hard-ineligible': 'Eligibility requirements not met',
  };
  return labels[code] ?? code.replace(/-/g, ' ');
}
