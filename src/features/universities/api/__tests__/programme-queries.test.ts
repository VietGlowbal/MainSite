import { describe, expect, it } from 'vitest';
import { degreeLabel, durationYears } from '../programme-queries';

/**
 * Both functions exist because `catalog_programmes` is crawler output, not a
 * curated table. The inputs below are the live distribution, read 2026-07-31.
 */

describe('degreeLabel', () => {
  it('folds the two spellings the table actually contains', () => {
    // 205 rows say "bachelor" and 3 say "Bachelor's"; 169 say "master" and 1
    // says "Master's". Printing the raw column would show both.
    expect(degreeLabel('bachelor')).toBe('Bachelor');
    expect(degreeLabel("Bachelor's")).toBe('Bachelor');
    expect(degreeLabel('master')).toBe('Master');
    expect(degreeLabel("Master's")).toBe('Master');
    // Also the typographic apostrophe, which crawled text is full of.
    expect(degreeLabel('Master’s')).toBe('Master');
  });

  it('handles the levels present in smaller numbers', () => {
    expect(degreeLabel('phd')).toBe('PhD');
    expect(degreeLabel('doctorate')).toBe('PhD');
    expect(degreeLabel('diploma')).toBe('Diploma');
  });

  it('is insensitive to case and surrounding space', () => {
    expect(degreeLabel('  BACHELOR  ')).toBe('Bachelor');
  });

  it('returns null rather than echoing an unknown value', () => {
    // The label goes on a line that is translated from a static dictionary, so
    // an unmapped value would render untranslated on a Vietnamese page.
    expect(degreeLabel('foundation')).toBeNull();
    expect(degreeLabel(null)).toBeNull();
    expect(degreeLabel(undefined)).toBeNull();
    expect(degreeLabel('')).toBeNull();
  });
});

describe('durationYears', () => {
  it('parses the shape the column actually uses', () => {
    expect(durationYears('3 years')).toBe(3);
    expect(durationYears('2 years')).toBe(2);
    expect(durationYears('4 years')).toBe(4);
    expect(durationYears('1 year')).toBe(1);
    expect(durationYears(' 5 yrs ')).toBe(5);
  });

  it('returns null for the 400 of 404 rows that say nothing', () => {
    expect(durationYears(null)).toBeNull();
    expect(durationYears(undefined)).toBeNull();
    expect(durationYears('')).toBeNull();
  });

  it('refuses to convert units it was not given', () => {
    // "18 months" is 1.5 years, and rounding it either way states a precision
    // the source did not. The picker shows nothing instead.
    expect(durationYears('18 months')).toBeNull();
    expect(durationYears('4 semesters')).toBeNull();
    expect(durationYears('3-4 years')).toBeNull();
    expect(durationYears('varies')).toBeNull();
  });

  it('rejects implausible values rather than rendering them', () => {
    expect(durationYears('0 years')).toBeNull();
    expect(durationYears('99 years')).toBeNull();
  });
});
