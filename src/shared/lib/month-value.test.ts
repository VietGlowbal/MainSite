import { describe, expect, it } from 'vitest';
import {
  clampMonthValue,
  currentMonthValue,
  formatMonthValue,
  monthLabels,
  monthValue,
  parseMonthValue,
  shiftMonthValue,
  toMonthValue,
} from './month-value';

describe('monthValue / parseMonthValue', () => {
  it('zero-pads so the token sorts as the months do', () => {
    expect(monthValue(2027, 9)).toBe('2027-09');
    expect(monthValue(2027, 9) < monthValue(2027, 10)).toBe(true);
    expect(monthValue(2027, 12) < monthValue(2028, 1)).toBe(true);
  });

  it('rejects a month outside the calendar rather than emitting a bad token', () => {
    expect(monthValue(2027, 0)).toBe('');
    expect(monthValue(2027, 13)).toBe('');
    expect(parseMonthValue('2027-13')).toBeNull();
    expect(parseMonthValue('2027-00')).toBeNull();
  });

  it('only accepts the canonical shape', () => {
    expect(parseMonthValue('2027-09')).toEqual({ year: 2027, month: 9 });
    expect(parseMonthValue('2027-9')).toBeNull();
    expect(parseMonthValue('Sep 2027')).toBeNull();
    expect(parseMonthValue(null)).toBeNull();
  });
});

describe('toMonthValue', () => {
  it('reads back what the old free-text box collected', () => {
    expect(toMonthValue('Sep 2027')).toBe('2027-09');
    expect(toMonthValue('September 2027')).toBe('2027-09');
    expect(toMonthValue('Sept 2027')).toBe('2027-09');
    expect(toMonthValue('  january 2028 ')).toBe('2028-01');
    expect(toMonthValue('2027 Oct')).toBe('2027-10');
  });

  it('reads the numeric forms, whichever side the year is on', () => {
    expect(toMonthValue('09/2027')).toBe('2027-09');
    expect(toMonthValue('9-2027')).toBe('2027-09');
    expect(toMonthValue('2027/9')).toBe('2027-09');
    // The Vietnamese form carries no digits of its own, so the numeric
    // fallback is what catches it.
    expect(toMonthValue('Tháng 9/2027')).toBe('2027-09');
  });

  it('passes a canonical token straight through', () => {
    expect(toMonthValue('2027-09')).toBe('2027-09');
  });

  it('is empty for a value that names no month', () => {
    expect(toMonthValue('')).toBe('');
    expect(toMonthValue(null)).toBe('');
    expect(toMonthValue('2027')).toBe('');
    expect(toMonthValue('Autumn / Fall 2027')).toBe('');
  });

  it('does not read December out of "Not decided yet"', () => {
    // The reflection flow writes this string. A prefix match on /dec/ turns a
    // student who has not decided into a December intake.
    expect(toMonthValue('Not decided yet')).toBe('');
    expect(toMonthValue('undecided')).toBe('');
  });

  it('refuses an impossible month rather than guessing', () => {
    expect(toMonthValue('19/2027')).toBe('');
  });
});

describe('formatMonthValue', () => {
  it('prints the month, short or long', () => {
    expect(formatMonthValue('2027-09')).toBe('Sep 2027');
    expect(formatMonthValue('2027-09', 'long')).toBe('September 2027');
  });

  it('is empty for anything that is not a token, so callers can fall back', () => {
    expect(formatMonthValue('autumn-2027')).toBe('');
    expect(formatMonthValue(null)).toBe('');
  });

  it('writes the Vietnamese form, joiner and all', () => {
    // This cannot be left to the page translator: /profile and /ai-strategy
    // are PII routes, where it substitutes exact dictionary keys only, and a
    // string built at render is never one.
    expect(formatMonthValue('2027-09', 'short', 'vi')).toBe('Tháng 9/2027');
    expect(formatMonthValue('2027-09', 'long', 'vi')).toBe('Tháng 9 năm 2027');
    // Not "Tháng 9 2027" — the year is not joined the way English joins it.
    expect(formatMonthValue('2027-09', 'short', 'vi')).not.toContain('9 2027');
  });
});

describe('monthLabels', () => {
  it('gives twelve names in either language', () => {
    for (const lang of ['en', 'vi'] as const) {
      const { abbreviations, names } = monthLabels(lang);
      expect(abbreviations).toHaveLength(12);
      expect(names).toHaveLength(12);
    }
  });

  it('keeps the grid labels short enough to sit three to a row', () => {
    expect(monthLabels('vi').abbreviations[8]).toBe('Th9');
    expect(monthLabels('vi').names[8]).toBe('Tháng 9');
    expect(monthLabels('en').abbreviations[8]).toBe('Sep');
  });

  it('defaults to English', () => {
    expect(monthLabels().abbreviations[0]).toBe('Jan');
  });
});

describe('currentMonthValue', () => {
  it('reads UTC, so the server and the browser agree', () => {
    // 07:00 ICT on 1 January is still 31 December in UTC. Reading the local
    // calendar here is what makes a server render and a client render
    // disagree, and React report a hydration error.
    expect(currentMonthValue(new Date('2027-01-01T00:30:00Z'))).toBe('2027-01');
    expect(currentMonthValue(new Date('2026-12-31T23:30:00Z'))).toBe('2026-12');
  });
});

describe('shiftMonthValue', () => {
  it('carries across the year boundary in both directions', () => {
    expect(shiftMonthValue('2027-12', 1)).toBe('2028-01');
    expect(shiftMonthValue('2027-01', -1)).toBe('2026-12');
    expect(shiftMonthValue('2027-06', 12)).toBe('2028-06');
    expect(shiftMonthValue('2027-06', -12)).toBe('2026-06');
  });

  it('is empty for a value it cannot parse', () => {
    expect(shiftMonthValue('undecided', 1)).toBe('');
  });
});

describe('clampMonthValue', () => {
  it('holds a value inside the offered window', () => {
    expect(clampMonthValue('2025-01', '2026-08', '2034-12')).toBe('2026-08');
    expect(clampMonthValue('2040-01', '2026-08', '2034-12')).toBe('2034-12');
    expect(clampMonthValue('2027-09', '2026-08', '2034-12')).toBe('2027-09');
  });
});
