import {
  NATIONALITY_CATALOG,
  countryName,
  flagEmoji,
} from '@/lib/nationality-catalog';
import { normaliseQuery } from './subject-catalog';

/**
 * Where a student would consider studying.
 *
 * ─── IT REUSES THE NATIONALITY CATALOGUE ─────────────────────────────────────
 *
 * Both questions need the same three things — an ISO code, a flag and a
 * localised country name — and the nationality catalogue already carries all
 * of them for every country. Building a second list would mean two files to
 * keep in step and two places for a flag to go missing, so this is a view over
 * that one: same codes, same `Intl.DisplayNames` names, same derived flags.
 *
 * What it adds is ordering and destination-specific aliases. A student
 * choosing where to study is not choosing a nationality, and the useful
 * default order is different: the twenty-odd countries most Vietnamese
 * applicants actually apply to, then everywhere else.
 *
 * ─── ISO CODES ARE STORED, NOT NAMES ─────────────────────────────────────────
 *
 * `GB`, not "United Kingdom" — so the value survives a copy change and means
 * the same thing to the matching engine whichever language the student used.
 *
 * ⚠️ The profile column `preferred_countries` historically stored display
 * names ("United Kingdom", "Japan") written by the older form. Reading is
 * therefore tolerant of both — see `destinationIdsFromStored`.
 */

export type DestinationOption = {
  /** ISO 3166-1 alpha-2. Persisted. */
  id: string;
  /** English country name, for search and for the stored-name fallback. */
  name: string;
  /** Extra words a student may type. */
  aliases: readonly string[];
};

/**
 * The destinations GlowBal's students actually apply to, in the order the
 * mock-up shows them. Everything else follows alphabetically.
 *
 * This is a display default, not a restriction: the grid is searchable and
 * `DESTINATIONS` below contains every country in the catalogue.
 */
const POPULAR_ISO = [
  'GB', 'US', 'CA', 'AU', 'NZ',
  'DE', 'NL', 'FR', 'SE', 'CH',
  'IE', 'SG', 'JP', 'KR', 'CN',
  'HK', 'MY', 'TH', 'IN', 'AE',
] as const;

/**
 * Destination-specific search terms, beyond the country name itself.
 *
 * The nationality catalogue's aliases are demonym-shaped ("British"); a
 * student picking a destination types the place ("Britain", "UK"). The two
 * overlap but are not the same, so the ones that matter here are stated here.
 */
const DESTINATION_ALIASES: Record<string, readonly string[]> = {
  GB: ['UK', 'Britain', 'Great Britain', 'England', 'Scotland', 'Wales', 'British'],
  US: ['USA', 'America', 'United States of America', 'American'],
  AE: ['UAE', 'Dubai', 'Abu Dhabi', 'Emirates'],
  KR: ['Korea', 'South Korea', 'Korean'],
  KP: ['North Korea'],
  NL: ['Holland', 'Dutch'],
  CN: ['PRC', 'Mainland China'],
  HK: ['Hong Kong SAR'],
  CZ: ['Czech Republic', 'Czechia'],
  TR: ['Turkey', 'Turkiye'],
  VN: ['Viet Nam'],
  IE: ['Republic of Ireland', 'Eire'],
  CH: ['Swiss'],
  DE: ['Deutschland'],
};

/**
 * Study destinations that are not nationalities.
 *
 * ⚠️ A DESTINATION IS NOT A NATIONALITY, AND THIS IS WHERE THAT BITES.
 * `NATIONALITY_CATALOG` covers the UN member states plus Palestine, the
 * Vatican, Kosovo and Taiwan — which is right for "what is your nationality?"
 * and wrong for "where would you study?". Hong Kong and Macau are territories
 * rather than members, so deriving destinations purely from that list silently
 * dropped Hong Kong, one of the destinations the spec names explicitly and a
 * major one for Vietnamese applicants. It was only visible because the grid's
 * popular block came back one tile short.
 *
 * These are added on top. Anything here needs a real ISO 3166-1 alpha-2 code,
 * because that is what the flag and the localised name are derived from.
 */
const EXTRA_DESTINATION_ISO = ['HK', 'MO'] as const;

/** Every country, popular destinations first, then the rest alphabetically. */
export const DESTINATIONS: readonly DestinationOption[] = (() => {
  const build = (iso2: string): DestinationOption => ({
    id: iso2,
    name: countryName(iso2, 'en'),
    aliases: DESTINATION_ALIASES[iso2] ?? [],
  });

  const all = [
    ...NATIONALITY_CATALOG.map((entry) => entry.iso2),
    ...EXTRA_DESTINATION_ISO,
  ];
  const known = new Set(all);

  // A popular code that is not in the catalogue at all is a typo in
  // POPULAR_ISO, not a country to invent — drop it rather than render a tile
  // with no flag and no name.
  const popular = POPULAR_ISO.filter((iso) => known.has(iso)).map(build);

  const popularSet = new Set<string>(POPULAR_ISO);
  const rest = all
    .filter((iso) => !popularSet.has(iso))
    .map(build)
    .sort((a, b) => a.name.localeCompare(b.name));

  return [...popular, ...rest];
})();

export const POPULAR_DESTINATIONS = DESTINATIONS.slice(0, POPULAR_ISO.length);

export function destinationById(id: string): DestinationOption | undefined {
  return DESTINATIONS.find((d) => d.id === id);
}

export function destinationFlag(id: string): string {
  return flagEmoji(id);
}

/** The country's name in the reader's language. */
export function destinationLabel(id: string, locale = 'en'): string {
  return countryName(id, locale);
}

/**
 * Filter destinations by name or alias, prefix matches first.
 *
 * An empty query returns everything in catalogue order, so the grid opens on
 * the popular destinations rather than on Afghanistan.
 */
export function searchDestinations(query: string, locale = 'en'): readonly DestinationOption[] {
  const q = normaliseQuery(query);
  if (!q) return DESTINATIONS;

  const prefix: DestinationOption[] = [];
  const contains: DestinationOption[] = [];

  for (const destination of DESTINATIONS) {
    const haystacks = [
      destination.name,
      countryName(destination.id, locale),
      destination.id,
      ...destination.aliases,
    ].map(normaliseQuery);

    if (haystacks.some((h) => h.startsWith(q))) prefix.push(destination);
    else if (haystacks.some((h) => h.includes(q))) contains.push(destination);
  }

  return [...prefix, ...contains];
}

/**
 * Read `preferred_countries` into ISO ids.
 *
 * ⚠️ THE COLUMN HOLDS TWO GENERATIONS OF VALUE. The form that shipped before
 * this one wrote display names picked from `onboarding-options`' `regions`
 * ("United Kingdom", "Japan"); this one writes ISO codes. A student who
 * answered under the old form must not have their answer silently dropped on
 * the next visit, so anything that is not already a known code is matched back
 * by name. Anything that resolves to neither is discarded rather than kept as
 * a phantom id the grid cannot render.
 */
export function destinationIdsFromStored(stored: readonly string[] | null | undefined): string[] {
  if (!stored) return [];

  const byName = new Map<string, string>();
  for (const destination of DESTINATIONS) {
    byName.set(normaliseQuery(destination.name), destination.id);
  }

  const ids: string[] = [];
  for (const value of stored) {
    const trimmed = value.trim();
    if (!trimmed) continue;

    const upper = trimmed.toUpperCase();
    if (upper.length === 2 && destinationById(upper)) {
      if (!ids.includes(upper)) ids.push(upper);
      continue;
    }

    const matched = byName.get(normaliseQuery(trimmed));
    if (matched && !ids.includes(matched)) ids.push(matched);
  }

  return ids;
}
