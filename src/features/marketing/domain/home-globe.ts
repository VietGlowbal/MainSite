/**
 * The hero globe's data side: which countries light up, and what the tooltip
 * calls them.
 *
 * The list is NOT the design prototype's illustrative ten. It is every country
 * the scholarship catalogue can place a scholarship in — the scholarship's own
 * `country`, or failing that its linked university's — counted by
 * `ScholarshipQueries.countryCounts()`. Measured 2026-09-27: 17 countries, from
 * the United Kingdom (89) down to Hungary (4). 2,485 of 2,877 published
 * scholarships have no country at all, which is why the counts are modest next
 * to the "3,000+" in the caption: that line is about the whole library.
 */

export type GlobeCountry = {
  /** English name, matching `universities.country` and the country mask. */
  readonly name: string;
  readonly count: number;
};

/**
 * Vietnamese names for the tooltip. Only destinations the catalogue can
 * plausibly cover; anything else falls back to the English name, which is what
 * the rest of the site does for untranslated place names.
 */
const COUNTRY_NAMES_VI: Readonly<Record<string, string>> = {
  'United Kingdom': 'Vương quốc Anh',
  'United States': 'Hoa Kỳ',
  Australia: 'Úc',
  Canada: 'Canada',
  China: 'Trung Quốc',
  'New Zealand': 'New Zealand',
  Ireland: 'Ireland',
  Germany: 'Đức',
  Singapore: 'Singapore',
  'South Korea': 'Hàn Quốc',
  'Hong Kong': 'Hồng Kông',
  Japan: 'Nhật Bản',
  France: 'Pháp',
  Netherlands: 'Hà Lan',
  Italy: 'Ý',
  'Czech Republic': 'Cộng hòa Séc',
  Hungary: 'Hungary',
  Switzerland: 'Thụy Sĩ',
  Sweden: 'Thụy Điển',
  Finland: 'Phần Lan',
  Denmark: 'Đan Mạch',
  Norway: 'Na Uy',
  Belgium: 'Bỉ',
  Spain: 'Tây Ban Nha',
  Austria: 'Áo',
  Taiwan: 'Đài Loan',
  Malaysia: 'Malaysia',
  Thailand: 'Thái Lan',
};

export function globeCountryName(name: string, vi: boolean): string {
  return vi ? (COUNTRY_NAMES_VI[name] ?? name) : name;
}
