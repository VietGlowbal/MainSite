/**
 * Every nationality the profile accepts, keyed by its ISO 3166-1 alpha-2 code.
 *
 * ─── WHY THIS EXISTS ALONGSIDE `nationalities.ts` ────────────────────────────
 *
 * `NATIONALITIES` is a flat list of demonyms and is the value actually stored
 * in `student_profiles.nationality`. It cannot carry a flag, a country name or
 * the words a student is likely to type, so the reflection picker needs more
 * than a list of strings — but the stored value must not change, or every
 * existing profile stops matching its own option.
 *
 * So this is a parallel catalogue keyed by ISO code, whose `nationality` field
 * is exactly the string `NATIONALITIES` already holds. `nationality-catalog.test.ts`
 * asserts the two stay in sync in both directions; if someone adds a country to
 * one and not the other, that test fails rather than a student silently losing
 * their answer.
 *
 * ─── FLAGS AND COUNTRY NAMES ARE DERIVED, NOT STORED ─────────────────────────
 *
 * A flag emoji is just the two letters of the ISO code as regional-indicator
 * symbols, so `flagEmoji('VN')` builds 🇻🇳 rather than this file carrying 197
 * emoji literals. Country names come from `Intl.DisplayNames`, which means the
 * Vietnamese half of the picker is translated by the platform instead of by a
 * 197-row addition to the dictionary — and stays correct as names change.
 *
 * ─── ALIASES ARE THE POINT ───────────────────────────────────────────────────
 *
 * A student typing "UK" should find British; so should "United Kingdom",
 * "England" and "Britain". Only the words that are NOT already the demonym or
 * the platform's country name are listed here — searching matches against all
 * three.
 */

export type NationalityEntry = {
  /** ISO 3166-1 alpha-2. Drives the flag and the localised country name. */
  iso2: string;
  /** The persisted value. Must stay identical to the matching `NATIONALITIES` entry. */
  nationality: string;
  /** Extra words a student might search by, beyond the demonym and country name. */
  aliases: readonly string[];
};

/**
 * Ordered for the picker: the markets GlowBal actually serves first (Vietnam
 * leads — it is the product's home market and the mock-up's first tile), then
 * everything else alphabetically. The grid is searchable, so this ordering only
 * decides what a student sees before they type.
 */
export const NATIONALITY_CATALOG: readonly NationalityEntry[] = [
  { iso2: 'VN', nationality: "Vietnamese", aliases: ["Vietnam", "Viet Nam", "Việt Nam"] },
  { iso2: 'GB', nationality: "British", aliases: ["UK", "United Kingdom", "Great Britain", "Britain", "England", "English", "Scotland", "Scottish", "Wales", "Welsh", "Northern Ireland"] },
  { iso2: 'US', nationality: "American", aliases: ["USA", "US", "United States", "United States of America", "America"] },
  { iso2: 'AU', nationality: "Australian", aliases: ["Aussie"] },
  { iso2: 'CA', nationality: "Canadian", aliases: [] },
  { iso2: 'SG', nationality: "Singaporean", aliases: ["Singapore"] },
  { iso2: 'JP', nationality: "Japanese", aliases: ["Japan", "Nippon"] },
  { iso2: 'CN', nationality: "Chinese", aliases: ["PRC", "China"] },
  { iso2: 'IN', nationality: "Indian", aliases: ["India", "Bharat"] },
  { iso2: 'TH', nationality: "Thai", aliases: ["Thailand"] },
  { iso2: 'MY', nationality: "Malaysian", aliases: [] },
  { iso2: 'ID', nationality: "Indonesian", aliases: [] },
  { iso2: 'PH', nationality: "Filipino", aliases: ["Philippines", "Filipina", "Philippine"] },
  { iso2: 'FR', nationality: "French", aliases: ["France"] },
  { iso2: 'DE', nationality: "German", aliases: ["Germany", "Deutschland"] },
  { iso2: 'IT', nationality: "Italian", aliases: ["Italy"] },
  { iso2: 'ES', nationality: "Spanish", aliases: ["Spain"] },
  { iso2: 'BR', nationality: "Brazilian", aliases: [] },
  { iso2: 'MX', nationality: "Mexican", aliases: [] },
  { iso2: 'ZA', nationality: "South African", aliases: ["South Africa"] },
  { iso2: 'AF', nationality: "Afghan", aliases: [] },
  { iso2: 'AL', nationality: "Albanian", aliases: [] },
  { iso2: 'DZ', nationality: "Algerian", aliases: [] },
  { iso2: 'AD', nationality: "Andorran", aliases: [] },
  { iso2: 'AO', nationality: "Angolan", aliases: [] },
  { iso2: 'AG', nationality: "Antiguan and Barbudan", aliases: ["Antigua", "Barbuda"] },
  { iso2: 'AR', nationality: "Argentine", aliases: ["Argentinian", "Argentina"] },
  { iso2: 'AM', nationality: "Armenian", aliases: [] },
  { iso2: 'AT', nationality: "Austrian", aliases: [] },
  { iso2: 'AZ', nationality: "Azerbaijani", aliases: ["Azeri"] },
  { iso2: 'BS', nationality: "Bahamian", aliases: [] },
  { iso2: 'BH', nationality: "Bahraini", aliases: [] },
  { iso2: 'BD', nationality: "Bangladeshi", aliases: [] },
  { iso2: 'BB', nationality: "Barbadian", aliases: ["Bajan"] },
  { iso2: 'LS', nationality: "Basotho", aliases: ["Lesotho", "Mosotho"] },
  { iso2: 'BY', nationality: "Belarusian", aliases: [] },
  { iso2: 'BE', nationality: "Belgian", aliases: [] },
  { iso2: 'BZ', nationality: "Belizean", aliases: [] },
  { iso2: 'BJ', nationality: "Beninese", aliases: [] },
  { iso2: 'BT', nationality: "Bhutanese", aliases: [] },
  { iso2: 'GW', nationality: "Bissau-Guinean", aliases: ["Guinea-Bissau"] },
  { iso2: 'BO', nationality: "Bolivian", aliases: [] },
  { iso2: 'BA', nationality: "Bosnian and Herzegovinian", aliases: ["Bosnia", "Herzegovina", "Bosnian"] },
  { iso2: 'BW', nationality: "Botswanan", aliases: ["Motswana", "Batswana"] },
  { iso2: 'BN', nationality: "Bruneian", aliases: [] },
  { iso2: 'BG', nationality: "Bulgarian", aliases: [] },
  { iso2: 'BF', nationality: "Burkinabé", aliases: ["Burkina Faso", "Burkinabe"] },
  { iso2: 'MM', nationality: "Burmese", aliases: ["Myanmar", "Myanmarese"] },
  { iso2: 'BI', nationality: "Burundian", aliases: [] },
  { iso2: 'CV', nationality: "Cabo Verdean", aliases: ["Cape Verde", "Cape Verdean"] },
  { iso2: 'KH', nationality: "Cambodian", aliases: ["Khmer"] },
  { iso2: 'CM', nationality: "Cameroonian", aliases: [] },
  { iso2: 'CF', nationality: "Central African", aliases: [] },
  { iso2: 'TD', nationality: "Chadian", aliases: [] },
  { iso2: 'CL', nationality: "Chilean", aliases: [] },
  { iso2: 'CO', nationality: "Colombian", aliases: [] },
  { iso2: 'KM', nationality: "Comorian", aliases: [] },
  { iso2: 'CD', nationality: "Congolese (Democratic Republic of the Congo)", aliases: ["DRC", "DR Congo", "Congo-Kinshasa"] },
  { iso2: 'CG', nationality: "Congolese (Republic of the Congo)", aliases: ["Congo-Brazzaville", "Republic of the Congo"] },
  { iso2: 'CR', nationality: "Costa Rican", aliases: [] },
  { iso2: 'HR', nationality: "Croatian", aliases: [] },
  { iso2: 'CU', nationality: "Cuban", aliases: [] },
  { iso2: 'CY', nationality: "Cypriot", aliases: ["Cyprus"] },
  { iso2: 'CZ', nationality: "Czech", aliases: ["Czechia", "Czech Republic"] },
  { iso2: 'DK', nationality: "Danish", aliases: ["Denmark", "Dane"] },
  { iso2: 'DJ', nationality: "Djiboutian", aliases: [] },
  { iso2: 'DM', nationality: "Dominican (Dominica)", aliases: ["Dominica"] },
  { iso2: 'DO', nationality: "Dominican (Dominican Republic)", aliases: ["Dominican Republic"] },
  { iso2: 'NL', nationality: "Dutch", aliases: ["Netherlands", "Holland", "Netherlander"] },
  { iso2: 'TL', nationality: "East Timorese", aliases: ["Timor-Leste", "East Timor"] },
  { iso2: 'EC', nationality: "Ecuadorian", aliases: [] },
  { iso2: 'EG', nationality: "Egyptian", aliases: [] },
  { iso2: 'AE', nationality: "Emirati", aliases: ["UAE", "United Arab Emirates", "Dubai", "Abu Dhabi"] },
  { iso2: 'GQ', nationality: "Equatorial Guinean", aliases: [] },
  { iso2: 'ER', nationality: "Eritrean", aliases: [] },
  { iso2: 'EE', nationality: "Estonian", aliases: [] },
  { iso2: 'SZ', nationality: "Eswatini", aliases: ["Swaziland", "Swazi"] },
  { iso2: 'ET', nationality: "Ethiopian", aliases: [] },
  { iso2: 'FJ', nationality: "Fijian", aliases: [] },
  { iso2: 'FI', nationality: "Finnish", aliases: ["Finland", "Finn"] },
  { iso2: 'GA', nationality: "Gabonese", aliases: [] },
  { iso2: 'GM', nationality: "Gambian", aliases: [] },
  { iso2: 'GE', nationality: "Georgian", aliases: [] },
  { iso2: 'GH', nationality: "Ghanaian", aliases: [] },
  { iso2: 'GR', nationality: "Greek", aliases: ["Greece", "Hellenic"] },
  { iso2: 'GD', nationality: "Grenadian", aliases: [] },
  { iso2: 'GT', nationality: "Guatemalan", aliases: [] },
  { iso2: 'GN', nationality: "Guinean", aliases: ["Guinea"] },
  { iso2: 'GY', nationality: "Guyanese", aliases: [] },
  { iso2: 'HT', nationality: "Haitian", aliases: [] },
  { iso2: 'HN', nationality: "Honduran", aliases: [] },
  { iso2: 'HU', nationality: "Hungarian", aliases: ["Magyar"] },
  { iso2: 'KI', nationality: "I-Kiribati", aliases: ["Kiribati"] },
  { iso2: 'IS', nationality: "Icelandic", aliases: ["Iceland", "Icelander"] },
  { iso2: 'IR', nationality: "Iranian", aliases: ["Persia", "Persian"] },
  { iso2: 'IQ', nationality: "Iraqi", aliases: [] },
  { iso2: 'IE', nationality: "Irish", aliases: ["Ireland", "Eire"] },
  { iso2: 'IL', nationality: "Israeli", aliases: [] },
  { iso2: 'CI', nationality: "Ivorian", aliases: ["Ivory Coast", "Cote d'Ivoire"] },
  { iso2: 'JM', nationality: "Jamaican", aliases: [] },
  { iso2: 'JO', nationality: "Jordanian", aliases: [] },
  { iso2: 'KZ', nationality: "Kazakhstani", aliases: ["Kazakh", "Kazakhstan"] },
  { iso2: 'KE', nationality: "Kenyan", aliases: [] },
  { iso2: 'KN', nationality: "Kittitian and Nevisian", aliases: ["Saint Kitts", "Nevis", "St Kitts"] },
  { iso2: 'XK', nationality: "Kosovar", aliases: ["Kosovo"] },
  { iso2: 'KW', nationality: "Kuwaiti", aliases: [] },
  { iso2: 'KG', nationality: "Kyrgyzstani", aliases: ["Kyrgyz", "Kyrgyzstan"] },
  { iso2: 'LA', nationality: "Lao", aliases: ["Laos", "Laotian"] },
  { iso2: 'LV', nationality: "Latvian", aliases: [] },
  { iso2: 'LB', nationality: "Lebanese", aliases: [] },
  { iso2: 'LR', nationality: "Liberian", aliases: [] },
  { iso2: 'LY', nationality: "Libyan", aliases: [] },
  { iso2: 'LI', nationality: "Liechtensteiner", aliases: ["Liechtenstein"] },
  { iso2: 'LT', nationality: "Lithuanian", aliases: [] },
  { iso2: 'LU', nationality: "Luxembourger", aliases: ["Luxembourg"] },
  { iso2: 'MG', nationality: "Malagasy", aliases: ["Madagascar"] },
  { iso2: 'MW', nationality: "Malawian", aliases: [] },
  { iso2: 'MV', nationality: "Maldivian", aliases: ["Maldives"] },
  { iso2: 'ML', nationality: "Malian", aliases: ["Mali"] },
  { iso2: 'MT', nationality: "Maltese", aliases: ["Malta"] },
  { iso2: 'MH', nationality: "Marshallese", aliases: ["Marshall Islands"] },
  { iso2: 'MR', nationality: "Mauritanian", aliases: [] },
  { iso2: 'MU', nationality: "Mauritian", aliases: [] },
  { iso2: 'FM', nationality: "Micronesian", aliases: ["Micronesia"] },
  { iso2: 'MD', nationality: "Moldovan", aliases: [] },
  { iso2: 'MC', nationality: "Monégasque", aliases: ["Monaco", "Monegasque"] },
  { iso2: 'MN', nationality: "Mongolian", aliases: [] },
  { iso2: 'ME', nationality: "Montenegrin", aliases: [] },
  { iso2: 'MA', nationality: "Moroccan", aliases: [] },
  { iso2: 'MZ', nationality: "Mozambican", aliases: [] },
  { iso2: 'NA', nationality: "Namibian", aliases: [] },
  { iso2: 'NR', nationality: "Nauruan", aliases: [] },
  { iso2: 'NP', nationality: "Nepali", aliases: ["Nepal", "Nepalese"] },
  { iso2: 'NZ', nationality: "New Zealander", aliases: ["New Zealand", "Kiwi"] },
  { iso2: 'NI', nationality: "Nicaraguan", aliases: [] },
  { iso2: 'NG', nationality: "Nigerian", aliases: ["Nigeria"] },
  { iso2: 'NE', nationality: "Nigerien", aliases: ["Niger"] },
  { iso2: 'KP', nationality: "North Korean", aliases: ["DPRK", "North Korea"] },
  { iso2: 'MK', nationality: "North Macedonian", aliases: ["Macedonia", "North Macedonia"] },
  { iso2: 'NO', nationality: "Norwegian", aliases: ["Norway"] },
  { iso2: 'OM', nationality: "Omani", aliases: [] },
  { iso2: 'PK', nationality: "Pakistani", aliases: [] },
  { iso2: 'PW', nationality: "Palauan", aliases: [] },
  { iso2: 'PS', nationality: "Palestinian", aliases: ["Palestine"] },
  { iso2: 'PA', nationality: "Panamanian", aliases: [] },
  { iso2: 'PG', nationality: "Papua New Guinean", aliases: ["Papua New Guinea", "PNG"] },
  { iso2: 'PY', nationality: "Paraguayan", aliases: [] },
  { iso2: 'PE', nationality: "Peruvian", aliases: [] },
  { iso2: 'PL', nationality: "Polish", aliases: ["Poland", "Pole"] },
  { iso2: 'PT', nationality: "Portuguese", aliases: ["Portugal"] },
  { iso2: 'QA', nationality: "Qatari", aliases: [] },
  { iso2: 'RO', nationality: "Romanian", aliases: [] },
  { iso2: 'RU', nationality: "Russian", aliases: ["Russia"] },
  { iso2: 'RW', nationality: "Rwandan", aliases: [] },
  { iso2: 'LC', nationality: "Saint Lucian", aliases: ["St Lucia"] },
  { iso2: 'VC', nationality: "Saint Vincentian", aliases: ["St Vincent", "Grenadines"] },
  { iso2: 'SV', nationality: "Salvadoran", aliases: ["El Salvador"] },
  { iso2: 'SM', nationality: "Sammarinese", aliases: ["San Marino"] },
  { iso2: 'WS', nationality: "Samoan", aliases: [] },
  { iso2: 'ST', nationality: "São Toméan", aliases: ["Sao Tome", "Principe", "Sao Tomean"] },
  { iso2: 'SA', nationality: "Saudi Arabian", aliases: ["Saudi Arabia", "Saudi"] },
  { iso2: 'SN', nationality: "Senegalese", aliases: [] },
  { iso2: 'RS', nationality: "Serbian", aliases: [] },
  { iso2: 'SC', nationality: "Seychellois", aliases: ["Seychelles"] },
  { iso2: 'SL', nationality: "Sierra Leonean", aliases: ["Sierra Leone"] },
  { iso2: 'SK', nationality: "Slovak", aliases: ["Slovakia"] },
  { iso2: 'SI', nationality: "Slovenian", aliases: ["Slovenia"] },
  { iso2: 'SB', nationality: "Solomon Islander", aliases: ["Solomon Islands"] },
  { iso2: 'SO', nationality: "Somali", aliases: ["Somalia"] },
  { iso2: 'KR', nationality: "South Korean", aliases: ["Korea", "Korean", "Republic of Korea", "ROK"] },
  { iso2: 'SS', nationality: "South Sudanese", aliases: ["South Sudan"] },
  { iso2: 'LK', nationality: "Sri Lankan", aliases: ["Sri Lanka", "Ceylon"] },
  { iso2: 'SD', nationality: "Sudanese", aliases: [] },
  { iso2: 'SR', nationality: "Surinamese", aliases: ["Suriname"] },
  { iso2: 'SE', nationality: "Swedish", aliases: ["Sweden", "Swede"] },
  { iso2: 'CH', nationality: "Swiss", aliases: ["Switzerland"] },
  { iso2: 'SY', nationality: "Syrian", aliases: [] },
  { iso2: 'TW', nationality: "Taiwanese", aliases: ["Taiwan", "ROC"] },
  { iso2: 'TJ', nationality: "Tajikistani", aliases: ["Tajik", "Tajikistan"] },
  { iso2: 'TZ', nationality: "Tanzanian", aliases: [] },
  { iso2: 'TG', nationality: "Togolese", aliases: [] },
  { iso2: 'TO', nationality: "Tongan", aliases: [] },
  { iso2: 'TT', nationality: "Trinidadian and Tobagonian", aliases: ["Trinidad", "Tobago", "Trinidad and Tobago"] },
  { iso2: 'TN', nationality: "Tunisian", aliases: [] },
  { iso2: 'TR', nationality: "Turkish", aliases: ["Turkey", "Türkiye"] },
  { iso2: 'TM', nationality: "Turkmen", aliases: ["Turkmenistan"] },
  { iso2: 'TV', nationality: "Tuvaluan", aliases: [] },
  { iso2: 'UG', nationality: "Ugandan", aliases: [] },
  { iso2: 'UA', nationality: "Ukrainian", aliases: ["Ukraine"] },
  { iso2: 'UY', nationality: "Uruguayan", aliases: [] },
  { iso2: 'UZ', nationality: "Uzbekistani", aliases: ["Uzbek", "Uzbekistan"] },
  { iso2: 'VU', nationality: "Vanuatuan", aliases: ["Vanuatu"] },
  { iso2: 'VA', nationality: "Vatican citizen", aliases: ["Vatican", "Holy See"] },
  { iso2: 'VE', nationality: "Venezuelan", aliases: [] },
  { iso2: 'YE', nationality: "Yemeni", aliases: [] },
  { iso2: 'ZM', nationality: "Zambian", aliases: [] },
  { iso2: 'ZW', nationality: "Zimbabwean", aliases: [] },
];

/** ISO 3166-1 alpha-2 → its flag emoji, via regional-indicator symbols. */
export function flagEmoji(iso2: string): string {
  const code = iso2.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return '';
  return String.fromCodePoint(
    ...[...code].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65),
  );
}

/**
 * The country's name in the reader's language.
 *
 * `Intl.DisplayNames` is in every browser this app supports and in Node, but
 * it throws on an unknown locale and returns `undefined` for a code it does
 * not recognise — Kosovo ('XK') is the real case here, since it has no
 * official ISO assignment. Both fall back to the demonym, which is never
 * empty.
 */
export function countryName(iso2: string, locale = 'en'): string {
  try {
    const display = new Intl.DisplayNames([locale], { type: 'region' });
    return display.of(iso2.toUpperCase()) ?? fallbackName(iso2);
  } catch {
    return fallbackName(iso2);
  }
}

function fallbackName(iso2: string): string {
  return NATIONALITY_CATALOG.find((e) => e.iso2 === iso2)?.nationality ?? iso2;
}

/**
 * Search the catalogue by country, nationality or alias.
 *
 * Prefix matches rank above substring matches, and within each the catalogue's
 * own order is preserved — so typing "un" offers United Kingdom and United
 * States before it offers Cameroon, and an empty query returns the whole list
 * in the order above rather than nothing.
 *
 * Matching is accent- and case-insensitive: a student typing "burkinabe" must
 * find "Burkinabé", and one typing "viet nam" must find Vietnamese.
 */
export function searchNationalities(
  query: string,
  locale = 'en',
): readonly NationalityEntry[] {
  const q = normalise(query);
  if (!q) return NATIONALITY_CATALOG;

  const prefix: NationalityEntry[] = [];
  const contains: NationalityEntry[] = [];

  for (const entry of NATIONALITY_CATALOG) {
    const haystacks = [
      entry.nationality,
      countryName(entry.iso2, locale),
      entry.iso2,
      ...entry.aliases,
    ].map(normalise);

    if (haystacks.some((h) => h.startsWith(q))) prefix.push(entry);
    else if (haystacks.some((h) => h.includes(q))) contains.push(entry);
  }

  return [...prefix, ...contains];
}

/** Lower-cased and stripped of diacritics, so "burkinabe" matches "Burkinabé". */
function normalise(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** The catalogue entry for a stored demonym, if it is still a known one. */
export function nationalityEntry(nationality: string | undefined): NationalityEntry | undefined {
  if (!nationality) return undefined;
  return NATIONALITY_CATALOG.find((e) => e.nationality === nationality);
}
