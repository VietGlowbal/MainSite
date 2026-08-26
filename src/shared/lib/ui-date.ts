/**
 * Date formatting that follows the UI language instead of a hardcoded
 * locale tag. The report-family views previously mixed `'en-US'`,
 * `'en-GB'` and `'vi-VN'` literals, so Vietnamese readers saw English
 * month names on some screens and English readers saw Vietnamese ones on
 * others. Client components format through these helpers, passing the
 * `lang` value from `useLanguage()`.
 *
 * Kept free of React/Next imports (see the note at the top of
 * `shared/lib/index.ts`).
 */

export type UiLang = 'en' | 'vi';

/**
 * Intl locale tag matching the UI language. English keeps the long-form
 * `en-GB` style the rest of the product already uses.
 */
export function uiLocaleTag(lang: UiLang): 'en-GB' | 'vi-VN' {
  return lang === 'vi' ? 'vi-VN' : 'en-GB';
}

export function formatUiDate(
  value: Date | string | number,
  lang: UiLang,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Date(value).toLocaleDateString(uiLocaleTag(lang), options);
}

export function formatUiDateTime(
  value: Date | string | number,
  lang: UiLang,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Date(value).toLocaleString(uiLocaleTag(lang), options);
}
