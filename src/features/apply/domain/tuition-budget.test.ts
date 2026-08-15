import { describe, expect, it } from 'vitest';
import {
  ALL_CURRENCIES,
  PRIMARY_CURRENCIES,
  convertAmount,
  convertBudget,
  currencyMeta,
  defaultBudget,
  formatAmount,
  formatBudgetRange,
  isCompleteBudget,
  parseBudget,
  reBase,
  serialiseBudget,
  type TuitionBudget,
} from './tuition-budget';

describe('currency scales', () => {
  it('offers the four the design shows as pills', () => {
    expect(PRIMARY_CURRENCIES).toEqual(['GBP', 'USD', 'EUR', 'CNY']);
  });

  it('gives every currency a usable scale', () => {
    for (const code of ALL_CURRENCIES) {
      const meta = currencyMeta(code);
      expect(meta.max, code).toBeGreaterThan(meta.min);
      expect(meta.step, code).toBeGreaterThan(0);
      expect(meta.symbol, code).toBeTruthy();
      expect(meta.region, code).toBeTruthy();
      // The scale must be wide enough for the step to be meaningful.
      expect((meta.max - meta.min) / meta.step, code).toBeGreaterThan(5);
    }
  });

  it('scales each currency to roughly the same real money', () => {
    // Derived from one USD reference range, so a pound scale should be
    // smaller than a dollar one and a đồng scale vastly larger.
    expect(currencyMeta('GBP').max).toBeLessThan(currencyMeta('USD').max);
    expect(currencyMeta('VND').max).toBeGreaterThan(currencyMeta('USD').max * 1000);
  });
});

describe('convertAmount', () => {
  it('is the identity within one currency', () => {
    expect(convertAmount(1234, 'GBP', 'GBP')).toBe(1234);
  });

  it('converts in the right direction', () => {
    // A pound is worth more than a dollar, so the same money is fewer pounds.
    expect(convertAmount(1000, 'GBP', 'USD')).toBeGreaterThan(1000);
    expect(convertAmount(1000, 'USD', 'GBP')).toBeLessThan(1000);
  });

  it('round-trips within rounding error', () => {
    const there = convertAmount(15_000, 'GBP', 'CNY');
    expect(convertAmount(there, 'CNY', 'GBP')).toBeCloseTo(15_000, 6);
  });
});

describe('convertBudget', () => {
  it('keeps an open-ended top open', () => {
    // Converting `null` to a number would invent a ceiling the student never
    // set — "£60,000+" does not become "$76,000 exactly".
    const open: TuitionBudget = { currency: 'GBP', min: 50_000, max: null };
    expect(convertBudget(open, 'USD').max).toBeNull();
  });

  it('converts both bounds of a closed range', () => {
    const budget: TuitionBudget = { currency: 'GBP', min: 15_000, max: 40_000 };
    const usd = convertBudget(budget, 'USD');
    expect(usd.currency).toBe('USD');
    expect(usd.min).toBeGreaterThan(15_000);
    expect(usd.max).toBeGreaterThan(usd.min);
  });
});

describe('formatting', () => {
  it('formats with the currency symbol and grouping', () => {
    expect(formatAmount(15_000, 'GBP')).toBe('£15,000');
    expect(formatAmount(19_100, 'USD')).toBe('$19,100');
  });

  it('rounds a converted figure so it reads as an estimate', () => {
    // "$18,987.34" claims a precision the rate does not have.
    expect(formatAmount(18_987.34, 'USD')).toBe('$19,000');
  });

  it('renders a closed range with both ends', () => {
    expect(formatBudgetRange({ currency: 'GBP', min: 15_000, max: 40_000 })).toBe(
      '£15,000 – £40,000',
    );
  });

  it('renders an open-ended range with a plus', () => {
    expect(formatBudgetRange({ currency: 'GBP', min: 60_000, max: null })).toBe('£60,000+');
  });
});

describe('reBase', () => {
  it('keeps roughly the same money when the currency changes', () => {
    // Switching currency is not changing your mind about the amount.
    const gbp: TuitionBudget = { currency: 'GBP', min: 15_000, max: 40_000 };
    const usd = reBase(gbp, 'USD');

    expect(usd.currency).toBe('USD');
    // ~$19,000 and ~$50,600, allowing for snapping to the USD scale's step.
    expect(usd.min).toBeGreaterThan(17_000);
    expect(usd.min).toBeLessThan(21_000);
    expect(usd.max!).toBeGreaterThan(48_000);
    expect(usd.max!).toBeLessThan(54_000);
  });

  it('snaps onto the new currency’s own scale', () => {
    const meta = currencyMeta('VND');
    const rebased = reBase({ currency: 'GBP', min: 15_000, max: 40_000 }, 'VND');
    expect(rebased.min % meta.step).toBe(0);
    expect(rebased.min).toBeGreaterThanOrEqual(meta.min);
    expect(rebased.max!).toBeLessThanOrEqual(meta.max);
  });

  it('keeps an open-ended range open', () => {
    expect(reBase({ currency: 'GBP', min: 50_000, max: null }, 'USD').max).toBeNull();
  });

  it('never produces a range outside the new scale', () => {
    for (const code of ALL_CURRENCIES) {
      const rebased = reBase({ currency: 'GBP', min: 5_000, max: 60_000 }, code);
      const meta = currencyMeta(code);
      expect(rebased.min, code).toBeGreaterThanOrEqual(meta.min);
      expect(rebased.max!, code).toBeLessThanOrEqual(meta.max);
      expect(rebased.min, code).toBeLessThanOrEqual(rebased.max!);
    }
  });
});

describe('defaultBudget', () => {
  it('starts inside the scale rather than pinned to the ends', () => {
    for (const code of ALL_CURRENCIES) {
      const meta = currencyMeta(code);
      const budget = defaultBudget(code);
      expect(budget.min, code).toBeGreaterThan(meta.min);
      expect(budget.max!, code).toBeLessThan(meta.max);
      expect(budget.min, code).toBeLessThan(budget.max!);
    }
  });
});

describe('isCompleteBudget', () => {
  it('accepts a closed range and an open-ended one', () => {
    expect(isCompleteBudget({ currency: 'GBP', min: 15_000, max: 40_000 })).toBe(true);
    expect(isCompleteBudget({ currency: 'GBP', min: 60_000, max: null })).toBe(true);
  });

  it('rejects nothing, a negative, or an inverted range', () => {
    expect(isCompleteBudget(undefined)).toBe(false);
    expect(isCompleteBudget({ currency: 'GBP', min: -1, max: 100 })).toBe(false);
    expect(isCompleteBudget({ currency: 'GBP', min: 40_000, max: 15_000 })).toBe(false);
  });
});

describe('serialise / parse', () => {
  it('round-trips a closed range', () => {
    const budget: TuitionBudget = { currency: 'GBP', min: 15_000, max: 40_000 };
    expect(parseBudget(serialiseBudget(budget))).toEqual(budget);
  });

  it('round-trips an open-ended range', () => {
    const budget: TuitionBudget = { currency: 'USD', min: 50_000, max: null };
    expect(parseBudget(serialiseBudget(budget))).toEqual(budget);
  });

  it('reads the bare VND range the previous form stored', () => {
    // The column holds two generations; the old one was always VND.
    expect(parseBudget('270000000-500000000')).toEqual({
      currency: 'VND',
      min: 270_000_000,
      max: 500_000_000,
    });
  });

  it('treats an unreadable or unknown-currency value as unanswered', () => {
    expect(parseBudget('ZZZ:100-200')).toBeUndefined();
    expect(parseBudget('lots of money')).toBeUndefined();
    expect(parseBudget('')).toBeUndefined();
    expect(parseBudget(null)).toBeUndefined();
  });
});
