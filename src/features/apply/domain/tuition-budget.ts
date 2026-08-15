/**
 * Annual tuition budget, in whichever currency the student thinks in.
 *
 * ─── WHY THIS REPLACES THE VND SLIDER + USD BAND ─────────────────────────────
 *
 * The previous question asked for a VND range and a USD band, kept in step by
 * a fixed rate. That was right for a Vietnam-only product and wrong the moment
 * the questionnaire is aimed at international applicants: a student budgeting
 * in pounds had to convert into đồng to answer, and the USD band was a
 * five-way enum that could not express "£15,000–£40,000".
 *
 * So the stored answer is now `{ currency, min, max }` — the student's own
 * currency, and a real range. `max: null` is the open-ended top band
 * ("£60,000+"), which a fixed enum could only approximate.
 *
 * ─── THE RATES ARE CONSTANTS, AND THE UI SAYS SO ─────────────────────────────
 *
 * Same call as `VND_PER_USD` before it: a live FX feed would make a saved
 * budget mean something different next week, and this is a band a student
 * chose rather than a price anyone is paying. The conversions exist to help
 * someone sanity-check an unfamiliar currency, so they are labelled
 * approximate wherever they are shown, and never stored — only `currency`,
 * `min` and `max` are persisted, so a rate change can never rewrite an answer.
 */

/**
 * Every currency a budget may be expressed in, in the order "Other" lists
 * them.
 *
 * A `const` tuple rather than a plain array so `CurrencyCode` is derived from
 * it: the rate, symbol and region tables below are keyed by that type, which
 * makes a currency added here a compile error until it has all three, and
 * `z.enum` can read it directly rather than the schema keeping a second copy.
 */
export const ALL_CURRENCIES = [
  'GBP',
  'USD',
  'EUR',
  'CNY',
  'VND',
  'AUD',
  'CAD',
  'SGD',
  'HKD',
  'INR',
  'AED',
  'JPY',
  'KRW',
] as const;

export type CurrencyCode = (typeof ALL_CURRENCIES)[number];

export type CurrencyMeta = {
  code: CurrencyCode;
  /** The currency's name, for the "Other" list where a symbol is not enough. */
  name: string;
  symbol: string;
  /** ISO 3166 code for the flag beside it; `EU` for the euro. */
  region: string;
  /** Rounding step for slider positions, in units of this currency. */
  step: number;
  /** Where the slider starts and where the open-ended band begins. */
  min: number;
  max: number;
};

/**
 * Units of each currency per 1 USD.
 *
 * Approximate, deliberately round, and reviewed rather than fetched. Used only
 * to derive the sliders' scales and the "this is approximately" line.
 */
const PER_USD: Record<CurrencyCode, number> = {
  USD: 1,
  GBP: 0.79,
  EUR: 0.92,
  CNY: 7.1,
  VND: 25_400,
  AUD: 1.52,
  CAD: 1.36,
  SGD: 1.34,
  HKD: 7.8,
  INR: 83,
  AED: 3.67,
  JPY: 157,
  KRW: 1_380,
};

const SYMBOLS: Record<CurrencyCode, string> = {
  USD: '$',
  GBP: '£',
  EUR: '€',
  CNY: '¥',
  VND: '₫',
  AUD: 'A$',
  CAD: 'C$',
  SGD: 'S$',
  HKD: 'HK$',
  INR: '₹',
  AED: 'AED ',
  JPY: '¥',
  KRW: '₩',
};

const NAMES: Record<CurrencyCode, string> = {
  USD: 'US dollar',
  GBP: 'British pound',
  EUR: 'Euro',
  CNY: 'Chinese yuan',
  VND: 'Vietnamese đồng',
  AUD: 'Australian dollar',
  CAD: 'Canadian dollar',
  SGD: 'Singapore dollar',
  HKD: 'Hong Kong dollar',
  INR: 'Indian rupee',
  AED: 'UAE dirham',
  JPY: 'Japanese yen',
  KRW: 'South Korean won',
};

const REGIONS: Record<CurrencyCode, string> = {
  USD: 'US',
  GBP: 'GB',
  EUR: 'EU',
  CNY: 'CN',
  VND: 'VN',
  AUD: 'AU',
  CAD: 'CA',
  SGD: 'SG',
  HKD: 'HK',
  INR: 'IN',
  AED: 'AE',
  JPY: 'JP',
  KRW: 'KR',
};

/** The four shown as pills; everything else lives behind "Other". */
export const PRIMARY_CURRENCIES: readonly CurrencyCode[] = ['GBP', 'USD', 'EUR', 'CNY'];

/**
 * The scale for a currency's slider.
 *
 * Derived from one USD reference range (5,000–60,000 a year, which spans
 * everything from a cheap public programme to an Ivy League sticker price)
 * and then rounded to a figure that reads naturally in the target currency.
 * Deriving rather than listing means adding a currency is one line in
 * `PER_USD`, and no scale can be forgotten.
 */
const USD_MIN = 5_000;
const USD_MAX = 60_000;
const USD_STEP = 1_000;

export function currencyMeta(code: CurrencyCode): CurrencyMeta {
  const rate = PER_USD[code];
  const round = (value: number) => {
    // Round to something that looks deliberate: two significant figures for
    // large numbers (₫127,000,000 not ₫127,000,001), the nearest 500
    // otherwise.
    if (value >= 1_000_000) return Math.round(value / 1_000_000) * 1_000_000;
    if (value >= 10_000) return Math.round(value / 1_000) * 1_000;
    return Math.round(value / 500) * 500;
  };

  return {
    code,
    name: NAMES[code],
    symbol: SYMBOLS[code],
    region: REGIONS[code],
    min: round(USD_MIN * rate),
    max: round(USD_MAX * rate),
    step: Math.max(1, round(USD_STEP * rate)),
  };
}

export type TuitionBudget = {
  currency: CurrencyCode;
  min: number;
  /** `null` is the open-ended top band — "£60,000+". */
  max: number | null;
};

/** Convert an amount between currencies, via USD. */
export function convertAmount(amount: number, from: CurrencyCode, to: CurrencyCode): number {
  if (from === to) return amount;
  const usd = amount / PER_USD[from];
  return usd * PER_USD[to];
}

/**
 * Convert a whole budget, keeping the open-ended top open.
 *
 * A `null` max means "and above"; converting it to a number would invent a
 * ceiling the student never set.
 */
export function convertBudget(budget: TuitionBudget, to: CurrencyCode): TuitionBudget {
  return {
    currency: to,
    min: convertAmount(budget.min, budget.currency, to),
    max: budget.max === null ? null : convertAmount(budget.max, budget.currency, to),
  };
}

/**
 * Format an amount for display — no decimals, grouped, with the symbol.
 *
 * Rounded to the nearest hundred above 1,000 so a converted figure reads as
 * the estimate it is: "$19,100", not "$18,987.34".
 */
export function formatAmount(amount: number, code: CurrencyCode): string {
  const rounded =
    amount >= 1_000_000
      ? Math.round(amount / 100_000) * 100_000
      : amount >= 1_000
        ? Math.round(amount / 100) * 100
        : Math.round(amount);

  const symbol = SYMBOLS[code];
  const grouped = rounded.toLocaleString('en-US');
  // A trailing space in the symbol (AED) means it is a prefix word.
  return symbol.endsWith(' ') ? `${symbol}${grouped}` : `${symbol}${grouped}`;
}

/** "£15,000 – £40,000" or "£60,000+" for the open-ended band. */
export function formatBudgetRange(budget: TuitionBudget): string {
  const min = formatAmount(budget.min, budget.currency);
  if (budget.max === null) return `${min}+`;
  return `${min} – ${formatAmount(budget.max, budget.currency)}`;
}

/**
 * The default budget for a currency — the middle of its own scale.
 *
 * Used when a student picks a currency before touching the slider, so the
 * handles start somewhere plausible rather than pinned to the ends.
 */
export function defaultBudget(currency: CurrencyCode): TuitionBudget {
  const meta = currencyMeta(currency);
  const span = meta.max - meta.min;
  return {
    currency,
    min: meta.min + Math.round(span * 0.2),
    max: meta.min + Math.round(span * 0.6),
  };
}

/**
 * Re-express a budget in a new currency, snapped to the new scale.
 *
 * Switching from pounds to đồng should keep roughly the same money, not reset
 * the answer — a student who has set their range and then realises they think
 * in another currency has not changed their mind about the amount.
 */
export function reBase(budget: TuitionBudget, to: CurrencyCode): TuitionBudget {
  const converted = convertBudget(budget, to);
  const meta = currencyMeta(to);
  const snap = (value: number) =>
    Math.min(Math.max(Math.round(value / meta.step) * meta.step, meta.min), meta.max);

  return {
    currency: to,
    min: snap(converted.min),
    // A range that was open-ended stays open-ended.
    max: converted.max === null ? null : snap(converted.max),
  };
}

/** Is this a usable answer? */
export function isCompleteBudget(budget: TuitionBudget | undefined): budget is TuitionBudget {
  if (!budget) return false;
  if (!Number.isFinite(budget.min) || budget.min < 0) return false;
  if (budget.max === null) return true;
  return Number.isFinite(budget.max) && budget.max >= budget.min;
}

/* ─────────────────────────────────────────────────────────────────────────
   Storage

   `student_profiles.budget_range` is a TEXT column already holding
   "min-max" in VND from the previous form. The structured budget serialises
   into the same column with the currency prefixed, and the reader
   understands both.
   ───────────────────────────────────────────────────────────────────────── */

/** `{GBP, 15000, 40000}` → `"GBP:15000-40000"`; an open top → `"GBP:50000-"`. */
export function serialiseBudget(budget: TuitionBudget): string {
  return `${budget.currency}:${Math.round(budget.min)}-${budget.max === null ? '' : Math.round(budget.max)}`;
}

/**
 * A stored value → the structured budget.
 *
 * Understands the token above, and the bare `"min-max"` the previous form
 * wrote — which was always VND, so it is read as such rather than guessed at.
 */
export function parseBudget(stored: string | null | undefined): TuitionBudget | undefined {
  const value = stored?.trim();
  if (!value) return undefined;

  const tagged = /^([A-Z]{3}):(\d+)-(\d*)$/.exec(value);
  if (tagged?.[1] && tagged[2] !== undefined) {
    const code = tagged[1] as CurrencyCode;
    if (!ALL_CURRENCIES.includes(code)) return undefined;
    return {
      currency: code,
      min: Number(tagged[2]),
      max: tagged[3] ? Number(tagged[3]) : null,
    };
  }

  // The previous form's shape: bare VND figures.
  const legacy = /^(\d+)-(\d+)$/.exec(value);
  if (legacy?.[1] && legacy[2]) {
    return { currency: 'VND', min: Number(legacy[1]), max: Number(legacy[2]) };
  }

  return undefined;
}
