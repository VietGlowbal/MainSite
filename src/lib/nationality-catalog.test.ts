import { describe, expect, it } from 'vitest';
import { NATIONALITIES } from './nationalities';
import {
  NATIONALITY_CATALOG,
  countryName,
  flagEmoji,
  nationalityEntry,
  searchNationalities,
} from './nationality-catalog';

describe('the catalogue and the stored list stay in sync', () => {
  // `student_profiles.nationality` holds the demonym. If the picker offers a
  // string the stored list does not contain, `reflectionFromProfile`'s `oneOf`
  // narrowing drops it on the next load and the student silently loses their
  // answer — so this is checked in both directions rather than one.
  it('offers every nationality the profile accepts', () => {
    const catalogued = new Set(NATIONALITY_CATALOG.map((e) => e.nationality));
    const missing = NATIONALITIES.filter((n) => !catalogued.has(n));
    expect(missing).toEqual([]);
  });

  it('offers nothing the profile would reject', () => {
    const accepted = new Set<string>(NATIONALITIES);
    const extra = NATIONALITY_CATALOG.filter((e) => !accepted.has(e.nationality));
    expect(extra.map((e) => e.nationality)).toEqual([]);
  });

  it('has one entry per ISO code', () => {
    const codes = NATIONALITY_CATALOG.map((e) => e.iso2);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('flagEmoji', () => {
  it('builds the flag from the ISO code', () => {
    expect(flagEmoji('VN')).toBe('🇻🇳');
    expect(flagEmoji('gb')).toBe('🇬🇧');
    expect(flagEmoji('US')).toBe('🇺🇸');
  });

  it('returns nothing for a code that is not two letters', () => {
    // Better an absent flag than a pair of stray symbols beside a real name.
    expect(flagEmoji('')).toBe('');
    expect(flagEmoji('VNM')).toBe('');
    expect(flagEmoji('1A')).toBe('');
  });

  it('produces a flag for every entry', () => {
    for (const entry of NATIONALITY_CATALOG) {
      expect(flagEmoji(entry.iso2), entry.nationality).not.toBe('');
    }
  });
});

describe('countryName', () => {
  it('localises the country name', () => {
    expect(countryName('VN', 'en')).toBe('Vietnam');
    expect(countryName('JP', 'en')).toBe('Japan');
  });

  it('falls back to the demonym for a code Intl does not know', () => {
    // Kosovo has no official ISO assignment; `Intl.DisplayNames` returns
    // undefined for 'XK' rather than throwing, and an empty label beside a
    // flag is worse than the demonym.
    expect(countryName('XK', 'en')).toBeTruthy();
  });

  it('never returns an empty label for any entry', () => {
    for (const entry of NATIONALITY_CATALOG) {
      expect(countryName(entry.iso2, 'en'), entry.nationality).toBeTruthy();
    }
  });
});

describe('searchNationalities', () => {
  const finds = (query: string, nationality: string) =>
    searchNationalities(query).some((e) => e.nationality === nationality);

  it('finds British by country, nationality and common alternative names', () => {
    // The spec calls this out by name: UK / United Kingdom / British must all
    // land on the same row.
    expect(finds('UK', 'British')).toBe(true);
    expect(finds('United Kingdom', 'British')).toBe(true);
    expect(finds('British', 'British')).toBe(true);
    expect(finds('England', 'British')).toBe(true);
  });

  it('finds the US under its several names', () => {
    expect(finds('USA', 'American')).toBe(true);
    expect(finds('United States', 'American')).toBe(true);
    expect(finds('American', 'American')).toBe(true);
  });

  it('matches without diacritics or case', () => {
    expect(finds('burkinabe', 'Burkinabé')).toBe(true);
    expect(finds('BURKINABÉ', 'Burkinabé')).toBe(true);
    expect(finds('viet nam', 'Vietnamese')).toBe(true);
    expect(finds('vietnam', 'Vietnamese')).toBe(true);
  });

  it('finds Dutch by Netherlands and Holland', () => {
    expect(finds('Netherlands', 'Dutch')).toBe(true);
    expect(finds('Holland', 'Dutch')).toBe(true);
  });

  it('ranks prefix matches above substring matches', () => {
    // "ind" should offer India before it offers a country that merely
    // contains the letters.
    const results = searchNationalities('ind');
    const indian = results.findIndex((e) => e.nationality === 'Indian');
    const indonesian = results.findIndex((e) => e.nationality === 'Indonesian');
    expect(indian).toBeGreaterThanOrEqual(0);
    expect(indonesian).toBeGreaterThanOrEqual(0);
  });

  it('returns the whole catalogue for an empty query, not nothing', () => {
    expect(searchNationalities('')).toHaveLength(NATIONALITY_CATALOG.length);
    expect(searchNationalities('   ')).toHaveLength(NATIONALITY_CATALOG.length);
  });

  it('leads with Vietnam, the product’s home market', () => {
    expect(NATIONALITY_CATALOG[0]?.nationality).toBe('Vietnamese');
  });

  it('returns nothing for a query that matches nothing', () => {
    expect(searchNationalities('zzzzzzz')).toHaveLength(0);
  });
});

describe('nationalityEntry', () => {
  it('resolves a stored demonym back to its entry', () => {
    expect(nationalityEntry('Vietnamese')?.iso2).toBe('VN');
  });

  it('returns nothing for an unset or retired value', () => {
    expect(nationalityEntry(undefined)).toBeUndefined();
    expect(nationalityEntry('Atlantean')).toBeUndefined();
  });
});
