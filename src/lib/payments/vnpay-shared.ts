export const VNPAY_FX_RATES: Record<'USD' | 'GBP' | 'EUR' | 'CNY' | 'VND', number> = {
  USD: 25400,
  GBP: 32200,
  EUR: 27600,
  CNY: 3500,
  VND: 1,
};

/** Convert the existing mentor price units to the fixed Sandbox VND policy. */
export function convertToVnd(
  amountInSmallestUnits: number,
  currency: 'USD' | 'GBP' | 'VND',
): number {
  if (!Number.isSafeInteger(amountInSmallestUnits) || amountInSmallestUnits < 0) {
    throw new Error('Invalid source currency amount');
  }
  const major = currency === 'VND' ? amountInSmallestUnits : amountInSmallestUnits / 100;
  return Math.round(major * VNPAY_FX_RATES[currency]);
}
