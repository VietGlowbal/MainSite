import type { Currency } from '@/types/mentorship';

// ── Currency formatting helpers ────────────────────────────────────────────

const ZERO_DECIMAL_CURRENCIES: Currency[] = ['VND'];

/**
 * The smallest unit of the currency. Stripe and our DB store all amounts in
 * the smallest unit (cents/pence for USD/GBP, đồng for VND).
 */
export function isZeroDecimal(currency: Currency): boolean {
  return ZERO_DECIMAL_CURRENCIES.includes(currency);
}

/**
 * Convert a smallest-unit amount to a major-unit number (e.g. 2500 cents → 25).
 */
export function toMajorUnits(amount: number, currency: Currency): number {
  if (isZeroDecimal(currency)) return amount;
  return amount / 100;
}

/**
 * Convert a major-unit number (e.g. 25.00) to the smallest unit (e.g. 2500).
 * VND has no decimals so we just round to the nearest integer.
 */
export function toSmallestUnits(amount: number, currency: Currency): number {
  if (isZeroDecimal(currency)) return Math.round(amount);
  return Math.round(amount * 100);
}

const SYMBOLS: Record<Currency, string> = {
  USD: '$',
  GBP: '£',
  VND: '₫',
};

/**
 * Pretty-print a smallest-unit amount with the right symbol & locale.
 */
export function formatMoney(amount: number, currency: Currency): string {
  const major = toMajorUnits(amount, currency);
  if (currency === 'VND') {
    return `${new Intl.NumberFormat('vi-VN').format(Math.round(major))} ₫`;
  }
  return new Intl.NumberFormat(currency === 'GBP' ? 'en-GB' : 'en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: major % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(major);
}

export function currencySymbol(currency: Currency): string {
  return SYMBOLS[currency];
}

/**
 * Service fee added to every booking (10% of mentor's hourly rate).
 * Returned in the same smallest-unit currency.
 */
export const SERVICE_FEE_PERCENT = 10;

export function computeServiceFee(mentorAmount: number): number {
  return Math.round(mentorAmount * (SERVICE_FEE_PERCENT / 100));
}

export function computeTotal(mentorAmount: number): number {
  return mentorAmount + computeServiceFee(mentorAmount);
}

/**
 * Stripe-compatible minimum charge per currency. Stripe rejects very small
 * amounts; we surface that error early in the form.
 */
const STRIPE_MIN_AMOUNT: Record<Currency, number> = {
  USD: 50, // $0.50
  GBP: 30, // £0.30
  VND: 12000, // 12,000 ₫ (~$0.50)
};

export function meetsStripeMinimum(amount: number, currency: Currency): boolean {
  return amount >= STRIPE_MIN_AMOUNT[currency];
}
