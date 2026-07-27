import { describe, expect, it } from 'vitest';
import {
  formatAcceptanceForCard,
  formatDeadlineLabel,
  formatTuitionForCard,
  formatUsdCompact,
  parseAcceptanceRate,
  parseDeadline,
  parseTuition,
  parseTuitionRange,
} from '../formatting';

describe('parseAcceptanceRate', () => {
  it('takes the first number', () => {
    expect(parseAcceptanceRate('14–18% overall')).toBe(14);
    expect(parseAcceptanceRate('4.5%')).toBe(4.5);
  });

  it('returns null for empty or non-numeric input', () => {
    expect(parseAcceptanceRate(null)).toBeNull();
    expect(parseAcceptanceRate(undefined)).toBeNull();
    expect(parseAcceptanceRate('')).toBeNull();
    expect(parseAcceptanceRate('highly competitive')).toBeNull();
  });
});

describe('parseTuition', () => {
  it('parses a single value', () => {
    expect(parseTuition('$62,000')).toBe(62000);
  });

  it('fuses a range — which is why parseTuitionRange exists', () => {
    // Documents the known lossiness rather than pretending it handles ranges.
    expect(parseTuition('42,000-65,000')).toBe(4200065000);
  });
});

describe('formatAcceptanceForCard', () => {
  it('keeps a range', () => {
    expect(formatAcceptanceForCard('14–18% overall; Engineering competitive')).toBe('14–18%');
    expect(formatAcceptanceForCard('4-5%')).toBe('4–5%');
  });

  it('keeps a single percentage', () => {
    expect(formatAcceptanceForCard('5% overall')).toBe('5%');
    expect(formatAcceptanceForCard('4.5%')).toBe('4.5%');
  });

  it('truncates long non-numeric text to 11 chars plus an ellipsis', () => {
    expect(formatAcceptanceForCard('extremely competitive indeed')).toBe('extremely c…');
  });

  it('renders an em dash for missing values', () => {
    expect(formatAcceptanceForCard(null)).toBe('—');
    expect(formatAcceptanceForCard('—')).toBe('—');
    expect(formatAcceptanceForCard('   ')).toBe('—');
  });
});

describe('parseTuitionRange', () => {
  it('parses a range and strips thousands separators', () => {
    expect(parseTuitionRange('42,000-65,000 USD')).toEqual({ lo: 42000, hi: 65000 });
    expect(parseTuitionRange('41000–45000')).toEqual({ lo: 41000, hi: 45000 });
  });

  it('parses a single value as a degenerate range', () => {
    expect(parseTuitionRange('59,320 (UG)')).toEqual({ lo: 59320, hi: 59320 });
  });

  it('recognises free tuition regardless of case', () => {
    expect(parseTuitionRange('Free')).toBe('free');
    expect(parseTuitionRange('free (EU students)')).toBe('free');
  });

  it('returns null when nothing parses', () => {
    expect(parseTuitionRange(null)).toBeNull();
    expect(parseTuitionRange('—')).toBeNull();
    expect(parseTuitionRange('varies by programme')).toBeNull();
  });

  it('ignores numbers shorter than three digits', () => {
    // Guards against picking up "(UG)" style noise or a stray year fragment.
    expect(parseTuitionRange('12 credits')).toBeNull();
  });
});

describe('formatUsdCompact', () => {
  it('formats a single amount', () => {
    expect(formatUsdCompact(62000)).toBe('$62,000');
  });

  it('formats a range', () => {
    expect(formatUsdCompact(41000, 45000)).toBe('$41,000–45,000');
  });

  it('collapses an equal range to a single amount', () => {
    expect(formatUsdCompact(343, 343)).toBe('$343');
  });

  it('handles zero', () => {
    expect(formatUsdCompact(0)).toBe('$0');
  });
});

describe('formatTuitionForCard', () => {
  it('formats parseable tuition', () => {
    expect(formatTuitionForCard('42,000-65,000 USD')).toBe('$42,000–65,000');
    expect(formatTuitionForCard('59,320 (UG); ~$65,000')).toBe('$59,320');
  });

  it('passes Free through', () => {
    expect(formatTuitionForCard('Free')).toBe('Free');
  });

  it('falls back to an em dash or truncated text', () => {
    expect(formatTuitionForCard(null)).toBe('—');
    expect(formatTuitionForCard('varies widely by course')).toBe('varies wi…');
  });
});

describe('parseDeadline', () => {
  const now = new Date(2026, 5, 15); // 15 June 2026

  it('parses a full date', () => {
    const d = parseDeadline('January 15, 2027', now);
    expect(d?.getFullYear()).toBe(2027);
    expect(d?.getMonth()).toBe(0);
  });

  /**
   * KNOWN BUG (pre-existing, pinned here rather than fixed).
   *
   * `Date.parse('Jan 15')` succeeds in V8 and yields 15 Jan **2001**, so the
   * direct-parse branch wins and the "roll forward to the next occurrence"
   * fallback below it is unreachable for any "Mon DD" string. Deadlines
   * therefore resolve into the past, which breaks sorting and any
   * "days remaining" display.
   *
   * The fallback only runs for month-only strings ("December"), which is the
   * one case that behaves correctly.
   *
   * Fixing it means trying the month fallback before `Date.parse`, or
   * rejecting a parsed year that is implausibly far in the past. That is a
   * behaviour change, so it belongs to Track A, not to Phase 0. These tests
   * pin today's behaviour so the fix is a visible, deliberate diff.
   */
  it('BUG: a month+day string resolves to 2001, not the next occurrence', () => {
    expect(parseDeadline('Jan 15', now)?.getFullYear()).toBe(2001);
    expect(parseDeadline('Oct 1', now)?.getFullYear()).toBe(2001);
  });

  it.todo('should roll a past month+day forward to the next occurrence');

  it('defaults to the 15th when no day is given', () => {
    const d = parseDeadline('December', now);
    expect(d?.getMonth()).toBe(11);
    expect(d?.getDate()).toBe(15);
  });

  it('returns null for unusable input', () => {
    expect(parseDeadline(null, now)).toBeNull();
    expect(parseDeadline('—', now)).toBeNull();
    expect(parseDeadline('rolling admissions', now)).toBeNull();
  });
});

describe('formatDeadlineLabel', () => {
  const now = new Date(2026, 5, 15); // 15 June 2026

  it('formats a full date', () => {
    expect(formatDeadlineLabel('January 15, 2027', now)).toBe('15 Jan 2027');
  });

  it('keeps prose that carries no date at all', () => {
    expect(formatDeadlineLabel('Rolling admissions', now)).toBe('Rolling admissions');
    expect(formatDeadlineLabel('Varies by programme', now)).toBe('Varies by programme');
  });

  /**
   * The guard on the pinned parseDeadline bug above: "Jan 15" parses to 2001, and
   * printing "15 Jan 2001" would assert a year the data never gave. The prose is
   * shown instead.
   */
  it('falls back to prose when the parse lands implausibly in the past', () => {
    expect(formatDeadlineLabel('Jan 15', now)).toBe('Jan 15');
    expect(formatDeadlineLabel('Oct 1', now)).toBe('Oct 1');
  });

  it('still formats a genuinely recent past deadline', () => {
    expect(formatDeadlineLabel('March 1, 2026', now)).toBe('1 Mar 2026');
  });

  it('formats a month-only string, which parseDeadline rolls forward', () => {
    expect(formatDeadlineLabel('December', now)).toBe('15 Dec 2026');
  });

  it('returns null when there is nothing to show', () => {
    expect(formatDeadlineLabel(null, now)).toBeNull();
    expect(formatDeadlineLabel('   ', now)).toBeNull();
    expect(formatDeadlineLabel('—', now)).toBeNull();
  });
});
