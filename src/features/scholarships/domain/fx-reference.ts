import type { FxProvider } from './valuation';

export type FxRateRecord = {
  key: string;
  baseCurrency: string;
  quoteCurrency: string;
  rate: number;
  effectiveDate: string;
  source: string;
  retrievalDate: string;
  version: string;
  validUntil?: string | null;
};

export type FxReferenceCoverage = 'incomplete' | 'partial' | 'complete';

export type FxReferenceDiagnosticCode =
  | 'invalid-dataset'
  | 'invalid-default-age'
  | 'malformed-rate'
  | 'duplicate-rate';

export type FxReferenceDiagnostic = {
  code: FxReferenceDiagnosticCode;
  key: string | null;
  message: string;
};

export type FxReferenceDataset = {
  version: string;
  coverage: FxReferenceCoverage;
  defaultMaxAgeDays: number | null;
  rates: readonly FxRateRecord[];
  diagnostics: readonly FxReferenceDiagnostic[];
};

export type FxRateResolution = {
  status: 'resolved' | 'missing';
  rate: number | null;
  record: FxRateRecord | null;
  direction: 'identity' | 'direct' | 'inverse' | null;
  reason: string;
};

export type FxReferenceProvider = FxProvider & {
  coverage: FxReferenceCoverage;
  diagnostics: readonly FxReferenceDiagnostic[];
  resolve: (baseCurrency: string, quoteCurrency: string) => FxRateResolution;
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return Number.isFinite(Date.parse(`${value}T00:00:00Z`));
}

function currencyCode(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z]{3}$/.test(value.trim().toUpperCase());
}

function finitePositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function asCoverage(value: unknown): FxReferenceCoverage {
  return value === 'complete' || value === 'partial' || value === 'incomplete'
    ? value
    : 'incomplete';
}

function malformed(key: string | null, message: string): {
  rate: null;
  diagnostic: FxReferenceDiagnostic;
} {
  return {
    rate: null,
    diagnostic: { code: 'malformed-rate', key, message },
  };
}

function parseRate(
  value: unknown,
  datasetVersion: string,
): { rate: FxRateRecord | null; diagnostic?: FxReferenceDiagnostic } {
  if (!isRecord(value)) return malformed(null, 'FX rate must be an object.');
  const key = nonEmptyString(value.key) ? value.key : null;
  if (!key || !currencyCode(value.baseCurrency) || !currencyCode(value.quoteCurrency)) {
    return malformed(key, 'FX key and three-letter currencies are required.');
  }
  const baseCurrency = value.baseCurrency.trim().toUpperCase();
  const quoteCurrency = value.quoteCurrency.trim().toUpperCase();
  if (baseCurrency === quoteCurrency) return malformed(key, 'FX base and quote currencies must differ.');
  if (!finitePositive(value.rate)) return malformed(key, 'FX rate must be finite and positive.');
  if (!isDate(value.effectiveDate) || !isDate(value.retrievalDate)) {
    return malformed(key, 'FX effective and retrieval dates must be YYYY-MM-DD.');
  }
  if (value.effectiveDate > value.retrievalDate) {
    return malformed(key, 'FX effectiveDate cannot be later than retrievalDate.');
  }
  if (!nonEmptyString(value.source) || !nonEmptyString(value.version) || value.version !== datasetVersion) {
    return malformed(key, 'FX source and dataset version are required and must match.');
  }
  if (value.validUntil !== undefined && value.validUntil !== null && !isDate(value.validUntil)) {
    return malformed(key, 'FX validUntil must be YYYY-MM-DD when provided.');
  }
  if (value.validUntil !== undefined && value.validUntil !== null && value.validUntil < value.retrievalDate) {
    return malformed(key, 'FX validUntil cannot be earlier than retrievalDate.');
  }

  return {
    rate: {
      key,
      baseCurrency,
      quoteCurrency,
      rate: value.rate,
      effectiveDate: value.effectiveDate,
      source: value.source,
      retrievalDate: value.retrievalDate,
      version: datasetVersion,
      ...(value.validUntil === undefined ? {} : { validUntil: value.validUntil }),
    },
  };
}

function dateAgeDays(retrievalDate: string, asOf: string): number {
  const retrieval = Date.parse(`${retrievalDate}T00:00:00Z`);
  const current = Date.parse(`${asOf}T00:00:00Z`);
  return (current - retrieval) / (24 * 60 * 60 * 1000);
}

function staleReason(rate: FxRateRecord, asOf: string, maxAgeDays: number | null): string | null {
  if (rate.retrievalDate > asOf) return 'rate-retrieval-in-future';
  if (rate.effectiveDate > asOf) return 'rate-not-effective';
  if (rate.validUntil && asOf > rate.validUntil) return 'rate-expired';
  if (maxAgeDays !== null && dateAgeDays(rate.retrievalDate, asOf) > maxAgeDays) {
    return 'rate-retrieval-too-old';
  }
  return null;
}

export function parseFxReferenceDataset(input: unknown): FxReferenceDataset {
  const diagnostics: FxReferenceDiagnostic[] = [];
  if (!isRecord(input)) {
    return {
      version: 'invalid',
      coverage: 'incomplete',
      defaultMaxAgeDays: null,
      rates: [],
      diagnostics: [{ code: 'invalid-dataset', key: null, message: 'FX dataset must be an object.' }],
    };
  }

  const version = nonEmptyString(input.version) ? input.version : 'invalid';
  if (version === 'invalid') {
    diagnostics.push({ code: 'invalid-dataset', key: null, message: 'FX dataset version is required.' });
  }
  const rawAge = input.defaultMaxAgeDays;
  const defaultMaxAgeDays =
    rawAge === null
      ? null
      : finitePositive(rawAge)
        ? rawAge
        : null;
  if (rawAge !== null && rawAge !== undefined && defaultMaxAgeDays === null) {
    diagnostics.push({ code: 'invalid-default-age', key: null, message: 'defaultMaxAgeDays must be positive or null.' });
  }

  const rates: FxRateRecord[] = [];
  const keys = new Set<string>();
  const rawRates = Array.isArray(input.rates) ? input.rates : [];
  if (!Array.isArray(input.rates)) {
    diagnostics.push({ code: 'invalid-dataset', key: null, message: 'FX rates must be an array.' });
  }
  for (const rawRate of rawRates) {
    const parsed = parseRate(rawRate, version);
    if (!parsed.rate) {
      diagnostics.push(parsed.diagnostic!);
      continue;
    }
    if (keys.has(parsed.rate.key)) {
      diagnostics.push({
        code: 'duplicate-rate',
        key: parsed.rate.key,
        message: 'Duplicate FX key; later rate was ignored.',
      });
      continue;
    }
    keys.add(parsed.rate.key);
    rates.push(parsed.rate);
  }

  return {
    version,
    coverage: asCoverage(input.coverage),
    defaultMaxAgeDays,
    rates,
    diagnostics,
  };
}

export function createFxReferenceProvider(
  dataset: FxReferenceDataset,
  options: { asOf: string; maxAgeDays?: number | null },
): FxReferenceProvider {
  const maxAgeDays = options.maxAgeDays === undefined
    ? dataset.defaultMaxAgeDays
    : options.maxAgeDays;

  function resolve(baseInput: string, quoteInput: string): FxRateResolution {
    const baseCurrency = baseInput.trim().toUpperCase();
    const quoteCurrency = quoteInput.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(baseCurrency) || !/^[A-Z]{3}$/.test(quoteCurrency)) {
      return { status: 'missing', rate: null, record: null, direction: null, reason: 'invalid-currency-code' };
    }
    if (!isDate(options.asOf)) {
      return { status: 'missing', rate: null, record: null, direction: null, reason: 'invalid-as-of-date' };
    }
    if (baseCurrency === quoteCurrency) {
      return { status: 'resolved', rate: 1, record: null, direction: 'identity', reason: 'identity-rate' };
    }

    const matching = dataset.rates.filter(
      (record) =>
        (record.baseCurrency === baseCurrency && record.quoteCurrency === quoteCurrency) ||
        (record.baseCurrency === quoteCurrency && record.quoteCurrency === baseCurrency),
    );
    const rejectedReasons = matching
      .map((record) => staleReason(record, options.asOf, maxAgeDays))
      .filter((reason): reason is string => reason !== null);
    const candidates = matching
      .map((record) => {
        const direct = record.baseCurrency === baseCurrency && record.quoteCurrency === quoteCurrency;
        const stale = staleReason(record, options.asOf, maxAgeDays);
        if (stale) return null;
        return {
          record,
          direction: direct ? ('direct' as const) : ('inverse' as const),
          rate: direct ? record.rate : 1 / record.rate,
        };
      })
      .filter((candidate): candidate is {
        record: FxRateRecord;
        direction: 'direct' | 'inverse';
        rate: number;
      } => candidate !== null)
      .sort(
        (left, right) =>
          right.record.effectiveDate.localeCompare(left.record.effectiveDate) ||
          left.record.key.localeCompare(right.record.key),
      );
    const selected = candidates[0];
    if (!selected) {
      return {
        status: 'missing',
        rate: null,
        record: null,
        direction: null,
        reason: rejectedReasons[0] ?? 'missing-rate',
      };
    }
    return {
      status: 'resolved',
      rate: selected.rate,
      record: selected.record,
      direction: selected.direction,
      reason: 'versioned-rate-selected',
    };
  }

  return {
    version: dataset.version,
    coverage: dataset.coverage,
    diagnostics: dataset.diagnostics,
    resolve,
    convert: (amount, fromCurrency, toCurrency) => {
      if (!Number.isFinite(amount)) return null;
      const resolution = resolve(fromCurrency, toCurrency);
      return resolution.rate === null ? null : amount * resolution.rate;
    },
  };
}
