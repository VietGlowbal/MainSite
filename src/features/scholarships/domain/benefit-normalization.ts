import {
  type BenefitAmount,
  type BenefitComponent,
  type BenefitConfidence,
  type BenefitCoverage,
  type BenefitDuration,
  type BenefitEvidence,
  type BenefitEvidenceSourceField,
  type BenefitNormalizationWarning,
  type BenefitPeriod,
  type BenefitScenario,
  type BenefitType,
  type BenefitValueKind,
  type NormalizedScholarshipBenefits,
  type ScholarshipBenefitClassification,
  type ScholarshipBenefitNormalizationInput,
} from './benefit-types';
import { isSupportedCurrency } from './currency';
import { canonicalizeExternalUrl } from '@/shared/lib/external-url';

const CURRENCY_SYMBOLS: Record<string, string> = {
  '$': 'USD',
  '£': 'GBP',
  '€': 'EUR',
  '₫': 'VND',
  '¥': 'JPY',
};

const NUMBER_PATTERN = /\d{1,3}(?:[.,\s]\d{3})+|\d{4,}(?:[.,]\d+)?|\d+(?:[.,]\d+)?/g;
const CURRENCY_PATTERN = /\b(?:USD|GBP|EUR|AUD|NZD|CAD|CHF|VND|JPY|SGD)\b|\b[A-Z]{3}\b|[$£€₫¥₹₽₩¤]/g;

type CanonicalInput = {
  coverage: string | null;
  amountMin: number | null;
  amountMax: number | null;
  amountCurrency: string | null;
  fundingType: string[];
  sourceUrl: string | null;
  fields: Record<string, unknown>;
};

type ParsedCurrency = {
  currency: string | null;
  currencyStatus: 'known' | 'unknown';
};

type ParsedAmount = BenefitAmount;

function firstDefined<T>(first: T | null | undefined, second: T | null | undefined): T | null {
  return first ?? second ?? null;
}

function canonicalInput(input: ScholarshipBenefitNormalizationInput): CanonicalInput {
  return {
    coverage: input.coverage ?? null,
    amountMin: firstDefined(input.amountMin, input.amount_min),
    amountMax: firstDefined(input.amountMax, input.amount_max),
    amountCurrency: firstDefined(input.amountCurrency, input.amount_currency),
    fundingType: [...(input.fundingType ?? input.funding_type ?? [])],
    sourceUrl: canonicalizeExternalUrl(firstDefined(input.sourceUrl, input.source_url)),
    fields: { ...(input.raw ?? {}) },
  };
}

function normalizeWords(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

function cleanExcerpt(value: string): string {
  return value.replace(/\s+/g, ' ').replace(/^\s*[-+;,]+\s*|\s*[-+;,]+\s*$/g, '').trim();
}

function parseCurrency(value: string | null | undefined): ParsedCurrency {
  if (!value) return { currency: null, currencyStatus: 'unknown' };
  const trimmed = value.trim();
  const symbolCurrency = CURRENCY_SYMBOLS[trimmed];
  if (symbolCurrency) return { currency: symbolCurrency, currencyStatus: 'known' };
  const code = trimmed.toUpperCase();
  return {
    currency: code,
    currencyStatus: isSupportedCurrency(code) ? 'known' : 'unknown',
  };
}

function parseCurrencyFromText(text: string, fallback: string | null): ParsedCurrency {
  const match = text.match(CURRENCY_PATTERN);
  return parseCurrency(match?.[0] ?? fallback);
}

function parseNumber(value: string): number | null {
  const compact = value.replace(/\s/g, '');
  const hasThousandsSeparators = /^\d{1,3}(?:[.,]\d{3})+$/.test(compact);
  const normalized = hasThousandsSeparators ? compact.replace(/[.,]/g, '') : compact.replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function numericTokens(text: string): Array<{ value: number; start: number; end: number }> {
  const tokens: Array<{ value: number; start: number; end: number }> = [];
  for (const match of text.matchAll(NUMBER_PATTERN)) {
    const value = parseNumber(match[0]);
    if (value == null || value < 0) continue;
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const suffix = text.slice(end, end + 2);
    if (suffix.trimStart().startsWith('%')) continue;
    tokens.push({ value, start, end });
  }
  return tokens;
}

function isRangeSeparator(value: string): boolean {
  return /^(?:\s*(?:-|–|—|to)\s*(?:[A-Z]{3}|[$£€₫¥₹₽₩¤])?\s*)$/i.test(value);
}

function parseAmount(text: string, fallbackCurrency: string | null): ParsedAmount | null {
  const currencyMatch = CURRENCY_PATTERN.exec(text);
  CURRENCY_PATTERN.lastIndex = 0;
  if (!currencyMatch) return null;

  const currencyStart = currencyMatch.index;
  const currencyEnd = currencyStart + currencyMatch[0].length;
  const tokens = numericTokens(text);
  const following = tokens.find((token) => token.start >= currencyEnd && token.start - currencyEnd <= 32);
  const preceding = [...tokens].reverse().find((token) => token.end <= currencyStart && currencyStart - token.end <= 32);
  const primary = following ?? preceding;
  if (!primary) return null;

  const values = [primary.value];
  if (following) {
    const next = tokens.find((token) => token.start > primary.end);
    if (next && isRangeSeparator(text.slice(primary.end, next.start))) values.push(next.value);
  } else {
    const previous = [...tokens].reverse().find((token) => token.end < primary.start);
    if (previous && isRangeSeparator(text.slice(previous.end, primary.start))) values.push(previous.value);
  }

  const parsedCurrency = parseCurrencyFromText(text, fallbackCurrency);
  const min = Math.min(...values);
  const maxValue = Math.max(...values);
  return {
    min,
    max: maxValue === min ? null : maxValue,
    currency: parsedCurrency.currency,
    currencyStatus: parsedCurrency.currencyStatus,
  };
}

function fallbackAmount(input: CanonicalInput): BenefitAmount | null {
  if (input.amountMin == null && input.amountMax == null) return null;
  const min = input.amountMin ?? input.amountMax;
  if (min == null || !Number.isFinite(min)) return null;
  const max = input.amountMax != null && input.amountMax !== min ? input.amountMax : null;
  const parsedCurrency = parseCurrency(input.amountCurrency);
  return {
    min,
    max,
    currency: parsedCurrency.currency,
    currencyStatus: parsedCurrency.currencyStatus,
  };
}

function parsePercentage(text: string): { min: number; max: number | null } | null {
  const match = text.match(/\b(\d{1,3})(?:\s*(?:-|–|—|to)\s*(\d{1,3}))?\s*%/i);
  if (!match) return null;
  const min = Number(match[1]);
  const max = match[2] == null ? null : Number(match[2]);
  if (!Number.isFinite(min) || min < 0 || min > 100 || (max != null && (max < min || max > 100))) {
    return null;
  }
  return { min, max };
}

function parsePeriod(text: string): BenefitPeriod {
  const words = normalizeWords(text);
  if (/\bone[- ]?time\b|\blump sum\b|\bsingle payment\b|\bonce\b/.test(words)) return 'one-time';
  if (/\/\s*months?\b|\bper\s+months?\b|\beach\s+months?\b|\bmonthly\b/.test(words)) {
    return 'monthly';
  }
  if (/\/\s*years?\b|\bper\s+years?\b|\beach\s+years?\b|\bannual(?:ly)?\b|\byearly\b/.test(words)) {
    return 'annual';
  }
  if (/\/\s*terms?\b|\bper\s+terms?\b|\beach\s+terms?\b|\btermly\b/.test(words)) {
    return 'term';
  }
  return 'unspecified';
}

function durationUnit(value: string): BenefitDuration['unit'] {
  const words = normalizeWords(value);
  if (words.startsWith('month')) return 'month';
  if (words.startsWith('term')) return 'term';
  return 'year';
}

function parseDuration(text: string): BenefitDuration | null {
  const explicit = text.match(
    /(?:[x×*]|\bfor\b|\bover\b|\bacross\b|\blast(?:s|ing)?\b|\b(?:duration|period)\s*(?:of|:)?)\s*(\d+(?:\.\d+)?)\s*(months?|years?|terms?)\b/i,
  );
  const compact = text.match(/\b(\d+(?:\.\d+)?)\s*-\s*(months?|years?|terms?)\b/i);
  const match = explicit ?? compact;
  if (!match) return null;
  const rawUnit = match[2];
  if (!rawUnit) return null;
  const count = Number(match[1]);
  if (!Number.isFinite(count) || count <= 0) return null;
  return {
    count,
    unit: durationUnit(rawUnit),
    basis: 'explicit',
    rawText: cleanExcerpt(match[0]),
  };
}

function hasWord(text: string, pattern: RegExp): boolean {
  return pattern.test(normalizeWords(text));
}

function detectBenefitType(text: string): BenefitType | null {
  const words = normalizeWords(text);
  if (/full\s*[- ]?ride/.test(words)) return 'tuition';
  if (/accommodation|housing|hostel|residence|room|rent|cho\s*o/.test(words)) return 'accommodation';
  if (/living\s+stipend/.test(words)) return 'stipend';
  if (/living|maintenance|cost\s*of\s*living|sinh\s*hoat/.test(words)) return 'living';
  if (/stipend|allowance|grant|tro\s*cap/.test(words) && !/living\s+allowance/.test(words)) return 'stipend';
  if (/meal|food|board|catering|an\s*uong/.test(words)) return 'meals';
  if (/travel|flight|airfare|transport|mobility|di\s*chuyen|ve\s*may\s*bay/.test(words)) return 'travel';
  if (/insurance|health\s+cover|bao\s*hiem/.test(words)) return 'insurance';
  if (/book|material|textbook|study\s+suppl|sach|tai\s*lieu/.test(words)) return 'books-materials';
  if (/tuition|school\s+fee|study\s+fee|hoc\s+phi/.test(words)) return 'tuition';
  return null;
}

function isFullTuition(text: string, percentage: { min: number; max: number | null } | null): boolean {
  const words = normalizeWords(text);
  return (
    percentage?.min === 100 ||
    /full\s*[- ]?ride/.test(words) ||
    /\bfull(?:ly)?\s+(?:covered\s+)?tuition\b/.test(words) ||
    /\btuition\s+(?:is\s+)?fully\s+covered\b/.test(words)
  );
}

function isPartialTuition(text: string, percentage: { min: number; max: number | null } | null): boolean {
  const words = normalizeWords(text);
  return (
    (percentage != null && percentage.min < 100) ||
    /\bpartial(?:ly)?\s+(?:covered\s+)?tuition\b|\btuition\s+waiver\b|\btuition\s+support\b/.test(words)
  );
}

function coverageFor(
  type: BenefitType,
  text: string,
  percentage: { min: number; max: number | null } | null,
  amount: BenefitAmount | null,
): BenefitCoverage {
  if (type === 'tuition') {
    if (isFullTuition(text, percentage)) return 'full';
    if (isPartialTuition(text, percentage)) return 'partial';
  }
  if (percentage != null) return percentage.min === 100 ? 'full' : 'partial';
  if (hasWord(text, /\bprovided\b|\bcovered\b|\bincluded\b|\ballowance\b|\bstipend\b|\bsupport\b/)) {
    return amount == null ? 'included' : 'unspecified';
  }
  return amount == null ? 'unspecified' : 'unspecified';
}

function valueKind(
  amount: BenefitAmount | null,
  percentage: { min: number; max: number | null } | null,
  coverage: BenefitCoverage,
): BenefitValueKind {
  if (percentage != null) return 'percentage';
  if (amount != null) return amount.max == null ? 'fixed' : 'range';
  if (coverage !== 'unspecified') return 'coverage';
  return 'unknown';
}

function evidence(
  sourceField: BenefitEvidenceSourceField,
  excerpt: string,
  sourceUrl: string | null,
): BenefitEvidence {
  return {
    sourceType: 'catalogue-field',
    sourceField,
    excerpt: cleanExcerpt(excerpt),
    sourceUrl,
  };
}

function confidenceFor(
  text: string,
  amount: BenefitAmount | null,
  sourceField: BenefitEvidenceSourceField,
): BenefitConfidence {
  if (amount?.currencyStatus === 'unknown') return 'low';
  if (sourceField === 'amount' || !text.trim()) return 'medium';
  if (hasWord(text, /tuition|living|accommodation|housing|stipend|meal|travel|insurance|book|material|full\s*[- ]?ride/)) {
    return 'high';
  }
  return 'medium';
}

function splitScenarios(text: string): string[] {
  const parts = text
    .split(/\s+(?:\/\s*)?or\s+/i)
    .map((part) => part.replace(/^\s*either\s+/i, '').trim())
    .filter(Boolean);
  if (parts.length < 2) return [text];
  const meaningful = parts.every((part) => {
    const words = normalizeWords(part);
    return /tuition|living|accommodation|housing|stipend|meal|travel|insurance|book|material|full\s*[- ]?ride|%|[$£€₫¥₹₽₩¤]|\b[A-Z]{3}\b/i.test(words);
  });
  return meaningful ? parts : [text];
}

function splitClauses(text: string): string[] {
  const clauses = text.split(/\s*(?:\+|;|\bplus\b|\band\b)\s*/i);
  return clauses.flatMap((clause) =>
    clause.split(/,\s*(?=(?:full|partial|tuition|living|accommodation|housing|stipend|meal|travel|insurance|book|material|[$£€₫¥₹₽₩¤]|\d+\s*%))/i),
  ).map((clause) => clause.trim()).filter(Boolean);
}

function componentFromClause(
  clause: string,
  scenarioKey: string | null,
  mutuallyExclusive: boolean,
  input: CanonicalInput,
): BenefitComponent | null {
  const percentage = parsePercentage(clause);
  const parsedAmount = parseAmount(clause, input.amountCurrency);
  const type = detectBenefitType(clause) ?? (parsedAmount || percentage ? 'other' : null);
  if (!type) return null;

  const amount = parsedAmount
    ? {
        min: parsedAmount.min,
        max: parsedAmount.max,
        currency: parsedAmount.currency,
        currencyStatus: parsedAmount.currencyStatus,
      }
    : null;
  const coverage = coverageFor(type, clause, percentage, amount);
  const sourceField: BenefitEvidenceSourceField = 'coverage';
  return {
    type,
    coverage,
    valueKind: valueKind(amount, percentage, coverage),
    amount,
    percentage,
    period: parsePeriod(clause),
    duration: parseDuration(clause),
    scenarioKey,
    mutuallyExclusive,
    evidence: [evidence(sourceField, clause, input.sourceUrl)],
    confidence: confidenceFor(clause, amount, sourceField),
  };
}

function uniqueTypes(components: BenefitComponent[]): BenefitType[] {
  return [...new Set(components.map((component) => component.type))];
}

function hasTuitionOnlyEvidence(components: BenefitComponent[]): boolean {
  return components.length > 0 && components.every((component) => component.type === 'tuition');
}

function classificationFor(
  coverage: string,
  fundingType: string[],
  components: BenefitComponent[],
): ScholarshipBenefitClassification {
  const words = normalizeWords(`${coverage} ${fundingType.join(' ')}`);
  const fullRidePhrase = /full\s*[- ]?ride/.test(normalizeWords(coverage));
  const legacyFullRide = fundingType.some((value) => /full\s*[- ]?ride/i.test(value));
  const fullyFundedClaimed = /fully\s*funded|fully-funded/.test(words);
  const tuition = components.find((component) => component.type === 'tuition');
  const nonTuitionTypes = uniqueTypes(components).filter((type) => type !== 'tuition');
  const meaningfulNonTuition = nonTuitionTypes.some((type) =>
    ['living', 'accommodation', 'stipend', 'meals'].includes(type),
  );
  const tuitionIsFull = tuition?.coverage === 'full';
  const tuitionOnly = tuitionIsFull && hasTuitionOnlyEvidence(components);

  // A stale legacy full-ride token must not override an explicit tuition-only
  // statement. This is the exact data shape produced by the old cleaner for
  // “100% tuition”.
  const fullRideClaimed = fullRidePhrase || (legacyFullRide && !tuitionOnly);
  const fullRideSupported =
    fullRidePhrase || (tuitionIsFull && meaningfulNonTuition);
  const fullRideStatus = fullRideSupported
    ? 'supported'
    : fullRideClaimed
      ? 'claimed-unverified'
      : 'not-claimed';

  let label: ScholarshipBenefitClassification['label'] = 'unknown';
  if (fullRideSupported) label = 'full-ride';
  else if (fullRideClaimed) label = 'full-ride-claim';
  else if (tuitionOnly) label = 'tuition-only';
  else if (fullyFundedClaimed) label = 'fully-funded';
  else if (tuition?.coverage === 'partial') label = 'partial';
  else if (components.length > 0) label = 'mixed';

  const tuitionCoverage = tuition?.coverage === 'full'
    ? 'full'
    : tuition?.coverage === 'partial'
      ? 'partial'
      : tuition
        ? 'unspecified'
        : 'none';

  return {
    label,
    tuitionCoverage,
    fullRideStatus,
    fullRideClaimed,
    fullyFundedClaimed,
    nonTuitionTypes,
  };
}

function warningsFor(
  classification: ScholarshipBenefitClassification,
  components: BenefitComponent[],
  scenarios: BenefitScenario[],
  ambiguousAmount: boolean,
): BenefitNormalizationWarning[] {
  const warnings: BenefitNormalizationWarning[] = [];
  if (classification.fullRideStatus === 'claimed-unverified') {
    warnings.push({
      code: 'full-ride-unverified',
      message: 'A full-ride claim was present without enough component evidence to verify its scope.',
    });
  }
  if (classification.fullyFundedClaimed && classification.fullRideStatus !== 'supported') {
    warnings.push({
      code: 'fully-funded-ambiguous',
      message: '“Fully funded” is retained as a claim and is not treated as full ride without support.',
    });
  }
  if (components.some((component) => component.amount?.currencyStatus === 'unknown')) {
    warnings.push({
      code: 'unknown-currency',
      message: 'An amount was preserved with an unknown currency; no USD default was applied.',
    });
  }
  if (ambiguousAmount) {
    warnings.push({
      code: 'ambiguous-amount',
      message: 'A catalogue amount could not be assigned to one benefit component without risking duplication.',
    });
  }
  if (scenarios.length > 1) {
    warnings.push({
      code: 'mutually-exclusive-scenarios',
      message: 'Alternative benefit branches were kept in separate mutually exclusive scenarios.',
    });
  }
  return warnings;
}

function makeScenarioEvidence(scenario: string, sourceUrl: string | null): BenefitEvidence[] {
  return [evidence('coverage', scenario, sourceUrl)];
}

/**
 * Normalize the existing scholarship coverage/amount fields into typed
 * evidence-bearing components. This function performs no valuation: it does
 * not multiply periods, convert currencies, estimate costs, or sum scenarios.
 */
export function normalizeScholarshipBenefits(
  input: ScholarshipBenefitNormalizationInput,
): NormalizedScholarshipBenefits {
  const canonical = canonicalInput(input);
  const coverageText = canonical.coverage ?? '';
  const scenarioTexts = splitScenarios(coverageText);
  const scenarios: BenefitScenario[] = scenarioTexts.length > 1
    ? scenarioTexts.map((label, index) => ({
        key: `scenario-${index + 1}`,
        label: cleanExcerpt(label),
        mutuallyExclusive: true,
        evidence: makeScenarioEvidence(label, canonical.sourceUrl),
      }))
    : [];
  const components: BenefitComponent[] = [];

  scenarioTexts.forEach((scenarioText, scenarioIndex) => {
    const scenarioKey = scenarios[scenarioIndex]?.key ?? null;
    for (const clause of splitClauses(scenarioText)) {
      const component = componentFromClause(
        clause,
        scenarioKey,
        scenarios.length > 1,
        canonical,
      );
      if (component) components.push(component);
    }
  });

  const amountFromFields = fallbackAmount(canonical);
  const hasComponentAmount = components.some((component) => component.amount != null);
  let ambiguousAmount = false;
  if (amountFromFields && !hasComponentAmount) {
    if (components.length === 1 && scenarios.length <= 1) {
      const component = components[0]!;
      component.amount = amountFromFields;
      component.valueKind = valueKind(component.amount, component.percentage, component.coverage);
      component.confidence = confidenceFor('', amountFromFields, 'amount');
      component.evidence = [
        ...component.evidence,
        evidence('amount', formatAmountExcerpt(amountFromFields), canonical.sourceUrl),
      ];
    } else if (components.length === 0) {
      components.push({
        type: 'other',
        coverage: 'unspecified',
        valueKind: valueKind(amountFromFields, null, 'unspecified'),
        amount: amountFromFields,
        percentage: null,
        period: 'unspecified',
        duration: null,
        scenarioKey: null,
        mutuallyExclusive: false,
        evidence: [evidence('amount', formatAmountExcerpt(amountFromFields), canonical.sourceUrl)],
        confidence: confidenceFor('', amountFromFields, 'amount'),
      });
    } else {
      ambiguousAmount = true;
    }
  }

  const classification = classificationFor(coverageText, canonical.fundingType, components);
  return {
    components,
    scenarios,
    classification,
    raw: {
      coverage: canonical.coverage,
      amountMin: canonical.amountMin,
      amountMax: canonical.amountMax,
      amountCurrency: canonical.amountCurrency,
      fundingType: [...canonical.fundingType],
      sourceUrl: canonical.sourceUrl,
      fields: { ...canonical.fields },
    },
    warnings: warningsFor(classification, components, scenarios, ambiguousAmount),
  };
}

function formatAmountExcerpt(amount: BenefitAmount): string {
  const range = amount.max == null ? String(amount.min) : `${amount.min}–${amount.max}`;
  return `${range}${amount.currency ? ` ${amount.currency}` : ''}`;
}
