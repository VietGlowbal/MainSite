import { describe, expect, it } from 'vitest';
import { countriesMatch, normalizeCountryName } from '../country';

describe('normalizeCountryName', () => {
  it('lowercases and trims', () => {
    expect(normalizeCountryName('  United Kingdom  ')).toBe('united kingdom');
  });

  it('expands United States spellings', () => {
    expect(normalizeCountryName('USA')).toBe('united states');
    expect(normalizeCountryName('United States of America')).toBe('united states');
    expect(normalizeCountryName('United States')).toBe('united states');
  });

  /**
   * KNOWN BUG (pre-existing, pinned here rather than fixed).
   *
   * The `u s a` / `u s` replacements run BEFORE punctuation is collapsed to
   * spaces, so a dotted abbreviation never matches them: "U.S.A." is still
   * "u.s.a." at that point, and by the time it becomes "u s a" the relevant
   * replacements have already passed.
   *
   * Fix is to reorder — strip punctuation first, then expand abbreviations.
   * That is a behaviour change (it would start matching rows that previously
   * did not), so it belongs to Track A.
   */
  it('BUG: dotted abbreviations are not expanded', () => {
    expect(normalizeCountryName('U.S.A.')).toBe('u s a');
    expect(normalizeCountryName('U.K.')).toBe('u k');
  });

  it.todo('should expand dotted abbreviations like U.S.A. and U.K.');

  it('expands other common abbreviations', () => {
    expect(normalizeCountryName('UK')).toBe('united kingdom');
    expect(normalizeCountryName('HK')).toBe('hong kong');
    expect(normalizeCountryName('U.A.E.')).toBe('united arab emirates');
  });

  it('normalises punctuation and ampersands', () => {
    expect(normalizeCountryName('Trinidad & Tobago')).toBe('trinidad and tobago');
    expect(normalizeCountryName('Côte-d’Ivoire')).toBe('c te d ivoire');
  });

  it('collapses repeated whitespace', () => {
    expect(normalizeCountryName('South    Korea')).toBe('south korea');
  });

  it('leaves an already-normal name unchanged', () => {
    expect(normalizeCountryName('australia')).toBe('australia');
  });
});

describe('countriesMatch', () => {
  it('matches across spellings', () => {
    expect(countriesMatch('USA', 'United States of America')).toBe(true);
    expect(countriesMatch('uk', 'United Kingdom')).toBe(true);
    expect(countriesMatch('Hong Kong', 'HK')).toBe(true);
  });

  it('does not match different countries', () => {
    expect(countriesMatch('Australia', 'Austria')).toBe(false);
    expect(countriesMatch('United States', 'United Kingdom')).toBe(false);
  });
});
