import type {
  BenefitConfidence,
  BenefitCurrencyStatus,
  BenefitDurationUnit,
  BenefitType,
} from './benefit-types';
import type {
  CostSource,
  SourceValueStatus,
  ValuationPeriod,
} from './valuation';
import type { DurationValue } from './duration';

export const COST_REFERENCE_LEVELS = [
  'programme',
  'university',
  'city',
  'country',
  'global',
] as const;

export type CostReferenceLevel = (typeof COST_REFERENCE_LEVELS)[number];

export type CostReferenceCoverage = 'incomplete' | 'partial' | 'complete';

export type CostReferenceRecord = {
  level: CostReferenceLevel;
  /** Stable record identifier, not a display label. */
  key: string;
  /** Stable identifier used to match the lookup context at this level. */
  scopeKey: string;
  benefitType: BenefitType;
  min: number;
  max: number | null;
  currency: string | null;
  currencyStatus: BenefitCurrencyStatus;
  period: ValuationPeriod;
  duration?: DurationValue | null;
  sourceUrl: string;
  sourceDate: string;
  effectiveDate: string;
  retrievalDate: string;
  validUntil?: string | null;
  datasetVersion: string;
  methodology: string;
  evidenceExcerpt: string;
  confidence: BenefitConfidence;
  valueStatus: SourceValueStatus;
  /** Categories represented by the amount, including bundled categories. */
  includedCategories: readonly BenefitType[];
  /** Categories explicitly not represented by this amount. */
  excludedCategories: readonly BenefitType[];
};

export type CostReferenceDiagnosticCode =
  | 'invalid-dataset'
  | 'invalid-default-age'
  | 'malformed-record'
  | 'duplicate-record';

export type CostReferenceDiagnostic = {
  code: CostReferenceDiagnosticCode;
  key: string | null;
  message: string;
};

export type CostReferenceDataset = {
  version: string;
  coverage: CostReferenceCoverage;
  defaultMaxAgeDays: number | null;
  records: readonly CostReferenceRecord[];
  diagnostics: readonly CostReferenceDiagnostic[];
};

export type CostReferenceAttempt = {
  level: CostReferenceLevel;
  scopeKey: string;
  recordKey: string | null;
  outcome: 'missing' | 'rejected' | 'selected';
  reason: string;
};

export type CostReferenceContext = {
  programmeKey?: string | null;
  universityKey?: string | null;
  cityKey?: string | null;
  countryKey?: string | null;
  globalKey?: string | null;
};

export type CostReferenceLookup = {
  benefitType: BenefitType;
  context: CostReferenceContext;
  /** Required to make freshness decisions deterministic. */
  asOf: string;
  maxAgeDays?: number | null;
};

export type CostReferenceResolution = {
  record: CostReferenceRecord | null;
  source: CostSource | null;
  level: CostReferenceLevel | null;
  attempts: CostReferenceAttempt[];
};

export type CostReferenceProvider = {
  version: string;
  coverage: CostReferenceCoverage;
  diagnostics: readonly CostReferenceDiagnostic[];
  resolve: (lookup: CostReferenceLookup) => CostReferenceResolution;
};

const BENEFIT_TYPES: readonly BenefitType[] = [
  'tuition',
  'living',
  'accommodation',
  'stipend',
  'meals',
  'travel',
  'insurance',
  'books-materials',
  'other',
];
const BENEFIT_PERIODS: readonly ValuationPeriod[] = [
  'unspecified',
  'one-time',
  'monthly',
  'annual',
  'term',
  'total',
];
const DURATION_UNITS: readonly BenefitDurationUnit[] = ['month', 'year', 'term'];
const CONFIDENCE_VALUES: readonly BenefitConfidence[] = ['high', 'medium', 'low'];
const SOURCE_STATUS_VALUES: readonly SourceValueStatus[] = ['EXACT', 'ESTIMATED'];
const SUPPORTED_CURRENCIES = new Set([
  'USD',
  'GBP',
  'EUR',
  'AUD',
  'NZD',
  'CAD',
  'CHF',
  'VND',
  'JPY',
  'SGD',
]);

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed);
}

function isHttpUrl(value: unknown): value is string {
  if (!nonEmptyString(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isBenefitType(value: unknown): value is BenefitType {
  return typeof value === 'string' && BENEFIT_TYPES.includes(value as BenefitType);
}

function isLevel(value: unknown): value is CostReferenceLevel {
  return typeof value === 'string' && COST_REFERENCE_LEVELS.includes(value as CostReferenceLevel);
}

function isPeriod(value: unknown): value is ValuationPeriod {
  return typeof value === 'string' && BENEFIT_PERIODS.includes(value as ValuationPeriod);
}

function isDurationUnit(value: unknown): value is BenefitDurationUnit {
  return typeof value === 'string' && DURATION_UNITS.includes(value as BenefitDurationUnit);
}

function isConfidence(value: unknown): value is BenefitConfidence {
  return typeof value === 'string' && CONFIDENCE_VALUES.includes(value as BenefitConfidence);
}

function isSourceStatus(value: unknown): value is SourceValueStatus {
  return typeof value === 'string' && SOURCE_STATUS_VALUES.includes(value as SourceValueStatus);
}

function isCurrencyStatus(value: unknown): value is BenefitCurrencyStatus {
  return value === 'known' || value === 'unknown';
}

function finiteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function parseDuration(value: unknown): DurationValue | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!isRecord(value) || !finiteNonNegative(value.count) || value.count <= 0 || !isDurationUnit(value.unit)) {
    return undefined;
  }
  if (value.rawText !== undefined && !nonEmptyString(value.rawText)) return undefined;
  return {
    count: value.count,
    unit: value.unit,
    ...(value.rawText === undefined ? {} : { rawText: value.rawText }),
  };
}

function parseCategories(value: unknown): BenefitType[] | null {
  if (!Array.isArray(value) || !value.every(isBenefitType)) return null;
  return [...new Set(value)];
}

function parseCurrency(value: unknown, status: unknown): {
  currency: string | null;
  currencyStatus: BenefitCurrencyStatus;
} | null {
  if (value === null && status === 'unknown') {
    return { currency: null, currencyStatus: 'unknown' };
  }
  if (!nonEmptyString(value) || !isCurrencyStatus(status)) return null;
  const currency = value.trim().toUpperCase();
  if (status === 'known' && !SUPPORTED_CURRENCIES.has(currency)) return null;
  return { currency, currencyStatus: status };
}

function malformed(key: string | null, message: string): {
  record: null;
  diagnostic: CostReferenceDiagnostic;
} {
  return {
    record: null,
    diagnostic: { code: 'malformed-record', key, message },
  };
}

function parseRecord(
  value: unknown,
  datasetVersion: string,
): { record: CostReferenceRecord | null; diagnostic?: CostReferenceDiagnostic } {
  if (!isRecord(value)) return malformed(null, 'Cost reference must be an object.');
  const key = nonEmptyString(value.key) ? value.key : null;
  if (!isLevel(value.level)) return malformed(key, 'Cost reference level is invalid.');
  if (!key || !nonEmptyString(value.scopeKey)) return malformed(key, 'Stable key and scopeKey are required.');
  if (!isBenefitType(value.benefitType)) return malformed(key, 'Benefit category is invalid.');
  if (!finiteNonNegative(value.min) || (value.max !== null && !finiteNonNegative(value.max))) {
    return malformed(key, 'Cost bounds must be finite non-negative numbers.');
  }
  if (value.max !== null && value.max < value.min) {
    return malformed(key, 'Cost max cannot be lower than min.');
  }
  if (!isPeriod(value.period)) return malformed(key, 'Cost period is invalid.');
  const currency = parseCurrency(value.currency, value.currencyStatus);
  if (!currency) return malformed(key, 'Currency and currencyStatus are invalid.');
  if (!isHttpUrl(value.sourceUrl)) return malformed(key, 'A valid source URL is required.');
  if (!isDate(value.sourceDate) || !isDate(value.effectiveDate) || !isDate(value.retrievalDate)) {
    return malformed(key, 'Source, effective, and retrieval dates must be YYYY-MM-DD.');
  }
  if (value.sourceDate > value.retrievalDate || value.effectiveDate > value.retrievalDate) {
    return malformed(key, 'Source and effective dates cannot be later than retrievalDate.');
  }
  if (value.validUntil !== undefined && value.validUntil !== null && !isDate(value.validUntil)) {
    return malformed(key, 'validUntil must be YYYY-MM-DD when provided.');
  }
  if (value.validUntil !== undefined && value.validUntil !== null && value.validUntil < value.retrievalDate) {
    return malformed(key, 'validUntil cannot be earlier than retrievalDate.');
  }
  if (value.datasetVersion !== datasetVersion || !nonEmptyString(value.methodology)) {
    return malformed(key, 'datasetVersion and methodology are required and must be versioned.');
  }
  if (!nonEmptyString(value.evidenceExcerpt)) return malformed(key, 'evidenceExcerpt is required.');
  if (!isConfidence(value.confidence) || !isSourceStatus(value.valueStatus)) {
    return malformed(key, 'Confidence and valueStatus are invalid.');
  }
  const includedCategories = parseCategories(value.includedCategories);
  const excludedCategories = parseCategories(value.excludedCategories);
  if (!includedCategories || !excludedCategories || !includedCategories.includes(value.benefitType)) {
    return malformed(key, 'Included/excluded categories must be valid and include the primary category.');
  }
  if (includedCategories.some((category) => excludedCategories.includes(category))) {
    return malformed(key, 'A category cannot be both included and excluded.');
  }
  const duration = parseDuration(value.duration);
  if (value.duration !== undefined && duration === undefined) {
    return malformed(key, 'Duration is malformed.');
  }

  return {
    record: {
      level: value.level,
      key,
      scopeKey: value.scopeKey,
      benefitType: value.benefitType,
      min: value.min,
      max: value.max,
      currency: currency.currency,
      currencyStatus: currency.currencyStatus,
      period: value.period,
      ...(duration === undefined ? {} : { duration }),
      sourceUrl: value.sourceUrl,
      sourceDate: value.sourceDate,
      effectiveDate: value.effectiveDate,
      retrievalDate: value.retrievalDate,
      ...(value.validUntil === undefined ? {} : { validUntil: value.validUntil }),
      datasetVersion,
      methodology: value.methodology,
      evidenceExcerpt: value.evidenceExcerpt,
      confidence: value.confidence,
      valueStatus: value.valueStatus,
      includedCategories,
      excludedCategories,
    },
  };
}

function asCoverage(value: unknown): CostReferenceCoverage {
  return value === 'complete' || value === 'partial' || value === 'incomplete'
    ? value
    : 'incomplete';
}

function contextKey(context: CostReferenceContext, level: CostReferenceLevel): string | null {
  if (level === 'programme') return context.programmeKey ?? null;
  if (level === 'university') return context.universityKey ?? null;
  if (level === 'city') return context.cityKey ?? null;
  if (level === 'country') return context.countryKey ?? null;
  return context.globalKey ?? 'global';
}

function dateAgeDays(retrievalDate: string, asOf: string): number {
  const retrieval = Date.parse(`${retrievalDate}T00:00:00Z`);
  const current = Date.parse(`${asOf}T00:00:00Z`);
  return (current - retrieval) / (24 * 60 * 60 * 1000);
}

function staleReason(
  record: CostReferenceRecord,
  asOf: string,
  maxAgeDays: number | null,
): string | null {
  if (record.retrievalDate > asOf) return 'reference-retrieval-in-future';
  if (record.sourceDate > asOf) return 'reference-source-in-future';
  if (record.effectiveDate > asOf) return 'reference-not-effective';
  if (record.validUntil && asOf > record.validUntil) return 'reference-expired';
  if (maxAgeDays !== null && dateAgeDays(record.retrievalDate, asOf) > maxAgeDays) {
    return 'reference-retrieval-too-old';
  }
  return null;
}

function toCostSource(record: CostReferenceRecord): CostSource {
  const evidence = {
    sourceType: 'catalogue-field' as const,
    sourceField: 'raw' as const,
    excerpt: record.evidenceExcerpt,
    sourceUrl: record.sourceUrl,
  };
  return {
    id: record.key,
    benefitType: record.benefitType,
    covers: record.includedCategories,
    amount: {
      min: record.min,
      max: record.max,
      currency: record.currency,
      currencyStatus: record.currencyStatus,
    },
    period: record.period,
    ...(record.duration === undefined ? {} : { duration: record.duration }),
    status: record.valueStatus,
    sourceType: 'cost-reference',
    sourceVersion: record.datasetVersion,
    confidence: record.confidence,
    evidence: [evidence],
  };
}

export function parseCostReferenceDataset(input: unknown): CostReferenceDataset {
  const diagnostics: CostReferenceDiagnostic[] = [];
  if (!isRecord(input)) {
    return {
      version: 'invalid',
      coverage: 'incomplete',
      defaultMaxAgeDays: null,
      records: [],
      diagnostics: [{ code: 'invalid-dataset', key: null, message: 'Cost reference dataset must be an object.' }],
    };
  }

  const version = nonEmptyString(input.version) ? input.version : 'invalid';
  if (version === 'invalid') {
    diagnostics.push({ code: 'invalid-dataset', key: null, message: 'Dataset version is required.' });
  }
  const rawAge = input.defaultMaxAgeDays;
  const defaultMaxAgeDays =
    rawAge === null
      ? null
      : finiteNonNegative(rawAge) && rawAge > 0
        ? rawAge
        : null;
  if (rawAge !== null && rawAge !== undefined && defaultMaxAgeDays === null) {
    diagnostics.push({ code: 'invalid-default-age', key: null, message: 'defaultMaxAgeDays must be positive or null.' });
  }

  const records: CostReferenceRecord[] = [];
  const identities = new Set<string>();
  const rawRecords = Array.isArray(input.records) ? input.records : [];
  if (!Array.isArray(input.records)) {
    diagnostics.push({ code: 'invalid-dataset', key: null, message: 'Dataset records must be an array.' });
  }
  for (const rawRecord of rawRecords) {
    const parsed = parseRecord(rawRecord, version);
    if (!parsed.record) {
      diagnostics.push(parsed.diagnostic!);
      continue;
    }
    const identity = `${parsed.record.level}|${parsed.record.scopeKey}|${parsed.record.benefitType}`;
    if (identities.has(identity)) {
      diagnostics.push({
        code: 'duplicate-record',
        key: parsed.record.key,
        message: `Duplicate cost reference for ${identity}; later record was ignored.`,
      });
      continue;
    }
    identities.add(identity);
    records.push(parsed.record);
  }

  return {
    version,
    coverage: asCoverage(input.coverage),
    defaultMaxAgeDays,
    records,
    diagnostics,
  };
}

export function createCostReferenceProvider(dataset: CostReferenceDataset): CostReferenceProvider {
  return {
    version: dataset.version,
    coverage: dataset.coverage,
    diagnostics: dataset.diagnostics,
    resolve: (lookup) => {
      const attempts: CostReferenceAttempt[] = [];
      const maxAgeDays = lookup.maxAgeDays === undefined
        ? dataset.defaultMaxAgeDays
        : lookup.maxAgeDays;
      if (!isDate(lookup.asOf)) {
        attempts.push({
          level: 'global',
          scopeKey: 'global',
          recordKey: null,
          outcome: 'rejected',
          reason: 'invalid-as-of-date',
        });
        return { record: null, source: null, level: null, attempts };
      }

      for (const level of COST_REFERENCE_LEVELS) {
        const scopeKey = contextKey(lookup.context, level);
        if (!scopeKey) {
          attempts.push({ level, scopeKey: '', recordKey: null, outcome: 'missing', reason: 'context-key-missing' });
          continue;
        }
        const record = dataset.records.find(
          (candidate) =>
            candidate.level === level &&
            candidate.scopeKey === scopeKey &&
            candidate.includedCategories.includes(lookup.benefitType) &&
            !candidate.excludedCategories.includes(lookup.benefitType),
        );
        if (!record) {
          attempts.push({ level, scopeKey, recordKey: null, outcome: 'missing', reason: 'reference-missing' });
          continue;
        }
        const stale = staleReason(record, lookup.asOf, maxAgeDays);
        if (stale) {
          attempts.push({ level, scopeKey, recordKey: record.key, outcome: 'rejected', reason: stale });
          continue;
        }
        attempts.push({ level, scopeKey, recordKey: record.key, outcome: 'selected', reason: 'first-defensible-reference' });
        return {
          record,
          source: toCostSource(record),
          level,
          attempts,
        };
      }

      return { record: null, source: null, level: null, attempts };
    },
  };
}
