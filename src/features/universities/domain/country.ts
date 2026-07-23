/**
 * Country-name normalisation.
 *
 * Country strings arrive from several sources (the CSV import, Wikipedia, the
 * onboarding quiz) and disagree on spelling: "USA" / "U.S." / "United States of
 * America", "UK" / "United Kingdom", "HK" / "Hong Kong". Filtering by country
 * has to match across all of them.
 *
 * Extracted from explorer-context.tsx, where it was an eleven-step replace
 * chain with no tests. Pure: no React, no I/O.
 */

/**
 * Reduce a country name to a comparable form.
 *
 * Lowercases, expands common abbreviations, and collapses punctuation and
 * whitespace. The output is a comparison key, not a display value.
 */
export function normalizeCountryName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/united states of america/g, 'united states')
    .replace(/u s a/g, 'united states')
    .replace(/u s/g, 'united states')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\busa\b/g, 'united states')
    .replace(/\bus\b/g, 'united states')
    .replace(/\buk\b/g, 'united kingdom')
    .replace(/\bu a e\b/g, 'united arab emirates')
    .replace(/\bhk\b/g, 'hong kong')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Whether two country strings refer to the same country. */
export function countriesMatch(left: string, right: string): boolean {
  return normalizeCountryName(left) === normalizeCountryName(right);
}
