/** Currencies the scholarship valuation and reference providers can compare. */
export const SUPPORTED_CURRENCIES = [
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
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export function isSupportedCurrency(value: string | null | undefined): value is SupportedCurrency {
  return value != null && SUPPORTED_CURRENCIES.includes(value.trim().toUpperCase() as SupportedCurrency);
}

export function normalizeSupportedCurrency(
  value: string | null | undefined,
): SupportedCurrency | null {
  const normalized = value?.trim().toUpperCase() ?? '';
  return isSupportedCurrency(normalized) ? normalized : null;
}
