import type {
  BenefitAmount,
  BenefitConfidence,
  BenefitComponent,
  BenefitEvidence,
  BenefitPeriod,
  BenefitType,
} from './benefit-types';
import {
  periodMultiplier,
  resolveScholarshipDuration,
  type DurationInput,
  type DurationValue,
  type ResolvedDuration,
} from './duration';

export type ValueStatus = 'EXACT' | 'MIXED' | 'ESTIMATED';
export type SourceValueStatus = Exclude<ValueStatus, 'MIXED'>;

export type ValuationPeriod = BenefitPeriod | 'total';

export type ValuationPolicy = {
  /** Required for comparable output; the engine never chooses USD implicitly. */
  comparableCurrency?: string;
  /** Needed only when a term must be converted to years or months. */
  termsPerYear?: number;
  /** Select one mutually-exclusive normalized benefit scenario. */
  scenarioKey?: string | null;
};

export type FxProvider = {
  /** Version of the rates used by convert. */
  version: string;
  convert: (amount: number, fromCurrency: string, toCurrency: string) => number | null;
};

export type TuitionSource = {
  amount: BenefitAmount;
  period: ValuationPeriod;
  duration?: DurationValue | null;
  status: SourceValueStatus;
  sourceType: string;
  sourceVersion?: string;
  confidence?: BenefitConfidence;
  evidence: readonly BenefitEvidence[];
};

/**
 * A T2A seam for T2B. The engine consumes a reference selected by a caller;
 * it does not know how a programme, city, or country dataset is stored.
 */
export type CostSource = {
  id?: string;
  benefitType: BenefitType;
  covers?: readonly BenefitType[];
  amount: BenefitAmount;
  period: ValuationPeriod;
  duration?: DurationValue | null;
  status: SourceValueStatus;
  sourceType: string;
  sourceVersion?: string;
  confidence?: BenefitConfidence;
  evidence: readonly BenefitEvidence[];
};

export type CostSourceResolver =
  | readonly CostSource[]
  | ((component: BenefitComponent) => CostSource | null);

export type MonetaryValue = BenefitAmount;

export type ComparableTotalValue = {
  /** V1 ranking number: the lower bound of the complete award total. */
  amount: number;
  /** Range upper bound in the same currency as amount. */
  upperBound: number;
  currency: string;
  bound: 'lower';
  fxVersion: string;
};

export type ValuedBenefitComponent = {
  type: BenefitType;
  scenarioKey: string | null;
  source: 'explicit' | 'tuition-source' | 'cost-source' | 'none';
  status: ValueStatus;
  included: boolean;
  sourceValue: MonetaryValue | null;
  totalValue: MonetaryValue | null;
  multiplier: number | null;
  sourceType: string | null;
  sourceVersion: string | null;
  confidence: BenefitConfidence | null;
  evidence: BenefitEvidence[];
  reason: string | null;
};

export type ScholarshipValueResult = {
  status: ValueStatus;
  /** Alias kept explicit for callers that use the product term. */
  valueStatus: ValueStatus;
  /** False means at least one selected benefit could not be valued. */
  complete: boolean;
  duration: ResolvedDuration | null;
  scenarioKey: string | null;
  totalValue: MonetaryValue | null;
  comparableTotalValue: ComparableTotalValue | null;
  components: ValuedBenefitComponent[];
  warnings: string[];
};

export type CalculateScholarshipValueInput = {
  benefits: readonly BenefitComponent[];
  duration?: DurationInput | null;
  tuitionSource?: TuitionSource | null;
  costSources?: CostSourceResolver | null;
  fx?: FxProvider | null;
  policy?: ValuationPolicy;
};

type ResolvedAmount = {
  sourceValue: MonetaryValue;
  totalValue: MonetaryValue;
  multiplier: number;
  status: SourceValueStatus;
  source: ValuedBenefitComponent['source'];
  sourceType: string | null;
  sourceVersion: string | null;
  confidence: BenefitConfidence | null;
  evidence: BenefitEvidence[];
};

type CandidateCostSource = CostSource & { key: string };

function isFiniteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function validAmount(amount: BenefitAmount | null): BenefitAmount | null {
  if (!amount || !isFiniteNonNegative(amount.min)) return null;
  if (amount.max !== null && (!isFiniteNonNegative(amount.max) || amount.max < amount.min)) {
    return null;
  }
  return { ...amount };
}

function scaleAmount(amount: BenefitAmount, multiplier: number): BenefitAmount | null {
  if (!Number.isFinite(multiplier) || multiplier < 0) return null;
  return {
    ...amount,
    min: amount.min * multiplier,
    // T1 represents a fixed amount as min with a null max. Once valued, a
    // fixed amount has an exact upper bound equal to its lower bound.
    max: amount.max === null ? amount.min * multiplier : amount.max * multiplier,
  };
}

function percentageAmount(
  amount: BenefitAmount,
  percentage: { min: number; max: number | null },
): BenefitAmount | null {
  if (!isFiniteNonNegative(percentage.min) || percentage.min > 100) return null;
  if (
    percentage.max !== null &&
    (!isFiniteNonNegative(percentage.max) || percentage.max < percentage.min || percentage.max > 100)
  ) {
    return null;
  }

  const max = (amount.max ?? amount.min) * ((percentage.max ?? percentage.min) / 100);

  return {
    ...amount,
    min: amount.min * (percentage.min / 100),
    max,
  };
}

function sameCurrency(left: BenefitAmount, right: BenefitAmount): boolean {
  if (left.currencyStatus !== right.currencyStatus) return false;
  if (left.currency === null || right.currency === null) return left.currency === right.currency;
  return left.currency.toUpperCase() === right.currency.toUpperCase();
}

function sumAmounts(amounts: readonly BenefitAmount[]): BenefitAmount | null {
  if (amounts.length === 0) return null;
  const first = amounts[0]!;
  if (!amounts.every((amount) => sameCurrency(first, amount))) return null;

  return {
    min: amounts.reduce((total, amount) => total + amount.min, 0),
    max: amounts.reduce((total, amount) => total + (amount.max ?? amount.min), 0),
    currency: first.currency,
    currencyStatus: first.currencyStatus,
  };
}

function sourceCurrencyKnown(amount: BenefitAmount): amount is BenefitAmount & {
  currency: string;
  currencyStatus: 'known';
} {
  return amount.currencyStatus === 'known' && amount.currency !== null;
}

function durationForComponent(
  component: BenefitComponent,
  resolvedDuration: ResolvedDuration | null,
): DurationValue | null {
  if (component.duration) {
    return copyDuration(component.duration);
  }
  return resolvedDuration;
}

function copyDuration(duration: DurationValue | null | undefined): DurationValue | null {
  if (!duration) return null;
  return {
    count: duration.count,
    unit: duration.unit,
    ...(duration.rawText === undefined ? {} : { rawText: duration.rawText }),
  };
}

function getMultiplier(
  period: ValuationPeriod,
  duration: DurationValue | null,
  policy: ValuationPolicy,
): number | null {
  return periodMultiplier({
    period,
    duration,
    ...(policy.termsPerYear === undefined ? {} : { termsPerYear: policy.termsPerYear }),
  });
}

function resolvePeriodicAmount(args: {
  amount: BenefitAmount;
  period: ValuationPeriod;
  duration: DurationValue | null;
  policy: ValuationPolicy;
}): { totalValue: BenefitAmount; multiplier: number } | null {
  const amount = validAmount(args.amount);
  if (!amount) return null;
  const multiplier = getMultiplier(args.period, args.duration, args.policy);
  if (multiplier === null) return null;
  const totalValue = scaleAmount(amount, multiplier);
  return totalValue ? { totalValue, multiplier } : null;
}

function candidateSources(
  sources: CostSourceResolver | null | undefined,
  component: BenefitComponent,
): CandidateCostSource[] {
  if (!sources) return [];

  if (typeof sources === 'function') {
    const source = sources(component);
    return source ? [{ ...source, key: source.id ?? source.sourceVersion ?? component.type }] : [];
  }

  return sources
    .map((source, index) => ({ ...source, key: source.id ?? source.sourceVersion ?? `${source.benefitType}-${index}` }))
    .filter(
      (source) =>
        source.benefitType === component.type || source.covers?.includes(component.type) === true,
    );
}

function evidenceFrom(...groups: readonly (readonly BenefitEvidence[])[]): BenefitEvidence[] {
  return groups.flatMap((group) => group);
}

function valueStatus(values: readonly ValuedBenefitComponent[]): ValueStatus {
  const included = values.filter((value) => value.included);
  if (included.length === 0) return 'ESTIMATED';
  const hasExact = included.some((value) => value.status === 'EXACT');
  const hasEstimated = included.some((value) => value.status === 'ESTIMATED' || value.totalValue === null);
  if (hasExact && hasEstimated) return 'MIXED';
  if (hasEstimated) return 'ESTIMATED';
  return 'EXACT';
}

function createUnavailable(
  component: BenefitComponent,
  reason: string,
  scenarioKey = component.scenarioKey,
): ValuedBenefitComponent {
  return {
    type: component.type,
    scenarioKey,
    source: 'none',
    status: 'ESTIMATED',
    included: true,
    sourceValue: null,
    totalValue: null,
    multiplier: null,
    sourceType: null,
    sourceVersion: null,
    confidence: null,
    evidence: [...component.evidence],
    reason,
  };
}

function createExcluded(
  component: BenefitComponent,
  reason: string,
): ValuedBenefitComponent {
  return {
    type: component.type,
    scenarioKey: component.scenarioKey,
    source: 'none',
    status: 'EXACT',
    included: false,
    sourceValue: null,
    totalValue: null,
    multiplier: null,
    sourceType: null,
    sourceVersion: null,
    confidence: null,
    evidence: [...component.evidence],
    reason,
  };
}

function createResolved(
  component: BenefitComponent,
  resolved: ResolvedAmount,
): ValuedBenefitComponent {
  return {
    type: component.type,
    scenarioKey: component.scenarioKey,
    source: resolved.source,
    status: resolved.status,
    included: true,
    sourceValue: resolved.sourceValue,
    totalValue: resolved.totalValue,
    multiplier: resolved.multiplier,
    sourceType: resolved.sourceType,
    sourceVersion: resolved.sourceVersion,
    confidence: resolved.confidence,
    evidence: resolved.evidence,
    reason: null,
  };
}

function resolveExplicitComponent(args: {
  component: BenefitComponent;
  resolvedDuration: ResolvedDuration | null;
  tuitionSource: TuitionSource | null | undefined;
  policy: ValuationPolicy;
}): ResolvedAmount | null {
  const { component } = args;

  if (component.valueKind === 'percentage' && component.percentage && component.type === 'tuition') {
    const tuition = args.tuitionSource;
    if (!tuition) return null;

    const tuitionDuration = copyDuration(tuition.duration) ?? durationForComponent(component, args.resolvedDuration);
    const tuitionAmount = resolvePeriodicAmount({
      amount: tuition.amount,
      period: tuition.period,
      duration: tuitionDuration,
      policy: args.policy,
    });
    if (!tuitionAmount) return null;

    const derived = percentageAmount(tuitionAmount.totalValue, component.percentage);
    if (!derived) return null;

    return {
      sourceValue: tuition.amount,
      totalValue: derived,
      multiplier: tuitionAmount.multiplier,
      status: tuition.status,
      source: 'tuition-source',
      sourceType: tuition.sourceType,
      sourceVersion: tuition.sourceVersion ?? null,
      confidence: tuition.confidence ?? null,
      evidence: evidenceFrom(component.evidence, tuition.evidence),
    };
  }

  const coverageMeansFullTuition =
    component.type === 'tuition' && component.coverage === 'full' && component.valueKind === 'coverage';
  if (coverageMeansFullTuition && args.tuitionSource) {
    const tuition = args.tuitionSource;
    const tuitionDuration = copyDuration(tuition.duration) ?? durationForComponent(component, args.resolvedDuration);
    const tuitionAmount = resolvePeriodicAmount({
      amount: tuition.amount,
      period: tuition.period,
      duration: tuitionDuration,
      policy: args.policy,
    });
    if (!tuitionAmount) return null;
    return {
      sourceValue: tuition.amount,
      totalValue: tuitionAmount.totalValue,
      multiplier: tuitionAmount.multiplier,
      status: tuition.status,
      source: 'tuition-source',
      sourceType: tuition.sourceType,
      sourceVersion: tuition.sourceVersion ?? null,
      confidence: tuition.confidence ?? null,
      evidence: evidenceFrom(component.evidence, tuition.evidence),
    };
  }

  if (!component.amount) return null;
  const sourceValue = validAmount(component.amount);
  if (!sourceValue) return null;
  const period = component.period;
  const multiplier = getMultiplier(period, durationForComponent(component, args.resolvedDuration), args.policy);
  if (multiplier === null) return null;
  const totalValue = scaleAmount(sourceValue, multiplier);
  if (!totalValue) return null;

  return {
    sourceValue,
    totalValue,
    multiplier,
    status: 'EXACT',
    source: 'explicit',
    sourceType: 'catalogue-field',
    sourceVersion: null,
    confidence: component.confidence,
    evidence: [...component.evidence],
  };
}

function resolveCostComponent(args: {
  component: BenefitComponent;
  resolvedDuration: ResolvedDuration | null;
  costSources: CostSourceResolver | null | undefined;
  policy: ValuationPolicy;
  usedSources: Set<string>;
  usedSourceObjects: Set<CostSource>;
  coveredByBundle: Map<BenefitType, { source: CostSource; status: SourceValueStatus }>;
  explicitTypes: ReadonlySet<BenefitType>;
}): ValuedBenefitComponent | null {
  const { component } = args;
  const bundled = args.coveredByBundle.get(component.type);
  if (bundled) {
    return {
      type: component.type,
      scenarioKey: component.scenarioKey,
      source: 'cost-source',
      status: bundled.status,
      included: true,
      sourceValue: null,
      totalValue: null,
      multiplier: null,
      sourceType: bundled.source.sourceType,
      sourceVersion: bundled.source.sourceVersion ?? null,
      confidence: bundled.source.confidence ?? null,
      evidence: [...component.evidence, ...bundled.source.evidence],
      reason: 'included-in-bundled-cost-source',
    };
  }

  const candidates = candidateSources(args.costSources, component);
  for (const source of candidates) {
    if (args.usedSources.has(source.key) || args.usedSourceObjects.has(source)) continue;

    const coveredTypes = new Set<BenefitType>([source.benefitType, ...(source.covers ?? [])]);
    const anotherExplicitType = [...coveredTypes].some(
      (type) => type !== component.type && args.explicitTypes.has(type),
    );
    if (anotherExplicitType) continue;

    const periodic = resolvePeriodicAmount({
      amount: source.amount,
      period: source.period,
      duration: copyDuration(source.duration) ?? durationForComponent(component, args.resolvedDuration),
      policy: args.policy,
    });
    if (!periodic) continue;

    args.usedSources.add(source.key);
    args.usedSourceObjects.add(source);
    for (const type of coveredTypes) {
      args.coveredByBundle.set(type, { source, status: source.status });
    }

    return {
      ...createResolved(component, {
        sourceValue: source.amount,
        totalValue: periodic.totalValue,
        multiplier: periodic.multiplier,
        status: source.status,
        source: 'cost-source',
        sourceType: source.sourceType,
        sourceVersion: source.sourceVersion ?? null,
        confidence: source.confidence ?? null,
        evidence: evidenceFrom(component.evidence, source.evidence),
      }),
    };
  }

  return null;
}

function convertAmount(
  amount: BenefitAmount,
  targetCurrency: string,
  fx: FxProvider | null | undefined,
): BenefitAmount | null {
  if (!sourceCurrencyKnown(amount)) return null;
  if (amount.currency.toUpperCase() === targetCurrency.toUpperCase()) {
    return { ...amount, currency: targetCurrency, currencyStatus: 'known' };
  }
  if (!fx) return null;

  const min = fx.convert(amount.min, amount.currency, targetCurrency);
  const sourceMax = amount.max ?? amount.min;
  const max = fx.convert(sourceMax, amount.currency, targetCurrency);
  if (min === null || max === null) return null;
  return {
    min,
    max,
    currency: targetCurrency,
    currencyStatus: 'known',
  };
}

function aggregateComparable(args: {
  values: readonly ValuedBenefitComponent[];
  currency: string;
  fx?: FxProvider | null;
}): ComparableTotalValue | null {
  const monetary = args.values
    .filter((value) => value.included && value.totalValue !== null)
    .map((value) => value.totalValue!);
  if (monetary.length === 0 || monetary.some((amount) => !sourceCurrencyKnown(amount))) return null;

  let lower = 0;
  let upper = 0;
  for (const amount of monetary) {
    const converted = convertAmount(amount, args.currency, args.fx);
    if (!converted) return null;
    lower += converted.min;
    upper += converted.max ?? converted.min;
  }

  return {
    amount: lower,
    upperBound: upper,
    currency: args.currency,
    bound: 'lower',
    fxVersion: args.fx?.version ?? 'identity',
  };
}

function aggregateTotal(args: {
  values: readonly ValuedBenefitComponent[];
  comparableCurrency?: string;
  fx?: FxProvider | null;
}): MonetaryValue | null {
  const monetary = args.values
    .filter((value) => value.included && value.totalValue !== null)
    .map((value) => value.totalValue!);
  if (monetary.length === 0) return null;

  const local = sumAmounts(monetary);
  if (local) return local;

  if (!args.comparableCurrency) return null;
  const converted = monetary.map((amount) =>
    convertAmount(amount, args.comparableCurrency!, args.fx),
  );
  if (converted.some((amount) => amount === null)) return null;
  return sumAmounts(converted.filter((amount): amount is MonetaryValue => amount !== null));
}

function scenarioDecision(
  component: BenefitComponent,
  selectedScenario: string | null,
): 'include' | 'exclude' | 'unavailable' {
  if (!component.mutuallyExclusive && component.scenarioKey === null) return 'include';
  if (component.scenarioKey === null) return 'unavailable';
  if (selectedScenario === null) return 'unavailable';
  return component.scenarioKey === selectedScenario ? 'include' : 'exclude';
}

/**
 * Calculate a duration-aware award value without doing I/O or inventing cost
 * data. All external references (tuition, cost, and FX) are explicit inputs.
 */
export function calculateScholarshipValue(
  input: CalculateScholarshipValueInput,
): ScholarshipValueResult {
  const policy = input.policy ?? {};
  const resolvedDuration = resolveScholarshipDuration({
    benefits: input.benefits,
    ...(input.duration === undefined ? {} : { duration: input.duration }),
  });
  const selectedScenario = policy.scenarioKey ?? null;
  const hasScenarios = input.benefits.some(
    (component) => component.mutuallyExclusive || component.scenarioKey !== null,
  );
  const warnings: string[] = [];

  if (hasScenarios && selectedScenario === null) {
    warnings.push('scenario-selection-required');
  }

  const explicitTypes = new Set<BenefitType>(
    input.benefits
      .filter(
        (component) =>
          component.amount !== null ||
          component.percentage !== null ||
          (component.type === 'tuition' && component.coverage === 'full'),
      )
      .map((component) => component.type),
  );
  const usedSources = new Set<string>();
  const usedSourceObjects = new Set<CostSource>();
  const coveredByBundle = new Map<BenefitType, { source: CostSource; status: SourceValueStatus }>();
  const values: ValuedBenefitComponent[] = [];

  for (const component of input.benefits) {
    const decision = scenarioDecision(component, selectedScenario);
    if (decision === 'exclude') {
      values.push(createExcluded(component, 'mutually-exclusive-scenario'));
      continue;
    }
    if (decision === 'unavailable') {
      values.push(createUnavailable(component, 'scenario-selection-required'));
      continue;
    }

    const explicit = resolveExplicitComponent({
      component,
      resolvedDuration,
      tuitionSource: input.tuitionSource,
      policy,
    });
    if (explicit) {
      values.push(createResolved(component, explicit));
      continue;
    }

    // An explicit amount or percentage is authoritative. If it cannot be
    // expanded (for example, a monthly amount has no duration), do not replace
    // it with a less-specific cost reference.
    const hasExplicitMonetaryBasis =
      component.amount !== null ||
      component.percentage !== null ||
      (component.type === 'tuition' && component.coverage === 'full');
    if (hasExplicitMonetaryBasis) {
      const reason =
        component.percentage !== null
          ? 'percentage-tuition-source-missing-or-unusable'
          : 'explicit-amount-duration-unavailable';
      values.push(createUnavailable(component, reason));
      continue;
    }

    const cost = resolveCostComponent({
      component,
      resolvedDuration,
      costSources: input.costSources,
      policy,
      usedSources,
      usedSourceObjects,
      coveredByBundle,
      explicitTypes,
    });
    if (cost) {
      values.push(cost);
      continue;
    }

    const reason =
      component.period === 'monthly' || component.period === 'annual' || component.period === 'term'
        ? 'periodic-amount-duration-unavailable-or-source-missing'
        : component.valueKind === 'percentage'
          ? 'percentage-tuition-source-missing'
          : 'monetary-basis-missing';
    values.push(createUnavailable(component, reason));
  }

  const includedValues = values.filter((value) => value.included);
  const unresolved = includedValues.some(
    (value) => value.totalValue === null && value.reason !== 'included-in-bundled-cost-source',
  );
  const complete = !unresolved && includedValues.length > 0;
  const status = valueStatus(values);
  const totalValue = complete
    ? aggregateTotal({
        values,
        ...(policy.comparableCurrency === undefined
          ? {}
          : { comparableCurrency: policy.comparableCurrency }),
        ...(input.fx === undefined ? {} : { fx: input.fx }),
      })
    : null;
  const comparableTotalValue =
    complete && policy.comparableCurrency
      ? aggregateComparable({
          values,
          currency: policy.comparableCurrency,
          ...(input.fx === undefined ? {} : { fx: input.fx }),
        })
      : null;

  if (!complete) warnings.push('complete-total-unavailable');
  if (includedValues.some((value) => value.totalValue?.currencyStatus === 'unknown')) {
    warnings.push('unknown-currency-comparable-unavailable');
  }
  if (policy.comparableCurrency && !comparableTotalValue && complete) {
    warnings.push('comparable-value-unavailable');
  }

  return {
    status,
    valueStatus: status,
    complete,
    duration: resolvedDuration,
    scenarioKey: selectedScenario,
    totalValue,
    comparableTotalValue,
    components: values,
    warnings,
  };
}
