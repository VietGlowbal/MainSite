import { describe, expect, it } from 'vitest';
import { leadFragment, splitList } from '../highlights';

describe('splitList', () => {
  it('splits a comma-separated field', () => {
    expect(splitList('Engineering, CS, Physics')).toEqual(['Engineering', 'CS', 'Physics']);
  });

  it('returns an empty array for nullish or blank input', () => {
    expect(splitList(null)).toEqual([]);
    expect(splitList(undefined)).toEqual([]);
    expect(splitList('')).toEqual([]);
    expect(splitList('   ,  , ')).toEqual([]);
  });

  /*
   * The two real rows that a smarter splitter would shred. Both are single
   * items on a live record (NUS id 71).
   */
  it('does not split on "and", "&" or brackets', () => {
    expect(splitList('Arts & Social Sciences')).toEqual(['Arts & Social Sciences']);
    expect(splitList('Business (NUS Business School), Law')).toEqual([
      'Business (NUS Business School)',
      'Law',
    ]);
    expect(splitList('Government and Economics')).toEqual(['Government and Economics']);
  });

  it('dedupes case-insensitively, keeping the first spelling', () => {
    expect(splitList('Law, law, LAW, Medicine')).toEqual(['Law', 'Medicine']);
  });

  it('caps at `max` without altering the earlier items', () => {
    expect(splitList('a, b, c, d', 2)).toEqual(['a', 'b']);
    expect(splitList('a, b', 5)).toEqual(['a', 'b']);
  });

  it('handles a real strengths value', () => {
    expect(
      splitList('Engineering, CS, Physics, Economics, Management, Architecture, Neuroscience'),
    ).toHaveLength(7);
  });
});

describe('leadFragment', () => {
  it('returns null when there is nothing to show', () => {
    expect(leadFragment(null)).toBeNull();
    expect(leadFragment(undefined)).toBeNull();
    expect(leadFragment('   ')).toBeNull();
    expect(leadFragment('—')).toBeNull();
  });

  it('passes a short value through untouched', () => {
    expect(leadFragment('3.50%')).toBe('3.50%');
    expect(leadFragment('4–5%')).toBe('4–5%');
  });

  it('cuts at the first clause separator', () => {
    expect(leadFragment('~17% overall; Medicine/Law more selective')).toBe('~17% overall');
    expect(leadFragment('61,990 (UG tuition ~$61,990)')).toBe('61,990');
    expect(leadFragment('UG: Jan 1 (EA: Nov 1) | PG: Dec–Jan varies by dept')).toBe('UG: Jan 1');
  });

  it('strips punctuation the cut exposes', () => {
    expect(leadFragment('3.9+ GPA (unweighted); top of class')).toBe('3.9+ GPA');
    expect(leadFragment('Early: Jan; Regular: May')).toBe('Early: Jan');
  });

  /* VinUni (id 97) — the row that motivated the ceiling. */
  it('truncates a long first clause on a word boundary', () => {
    const result = leadFragment(
      'Competitive applicants generally 3.5+/4.0 equivalent; estimated minimum admission ~3.2+',
    );
    expect(result).toBe('Competitive applicants generally…');
    expect(result?.endsWith('…')).toBe(true);
  });

  it('never returns more than a prefix of its input', () => {
    const input = 'Estimated ~60–65% (not officially published; third-party estimate only)';
    const result = leadFragment(input);
    expect(result).not.toBeNull();
    expect(input.startsWith(result!.replace(/…$/, ''))).toBe(true);
  });

  it('respects an explicit maxChars', () => {
    expect(leadFragment('abcdefghij klmnopqrst', 12)).toBe('abcdefghij…');
  });

  /*
   * A single token longer than the ceiling has no space to break on. It must
   * still come back clipped rather than empty.
   */
  it('hard-cuts a single very long token', () => {
    const result = leadFragment('Supercalifragilisticexpialidocious', 10);
    expect(result).toBe('Supercalif…');
  });

  it('falls back to the whole string when the first clause is empty', () => {
    expect(leadFragment('(estimated only)')).toBe('(estimated only)');
  });
});
