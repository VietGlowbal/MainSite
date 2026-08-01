import { describe, expect, it } from 'vitest';
import { deadlineUrgency } from './deadline';

/** A fixed "today" so the bands are asserted against a date, not the clock. */
const NOW = new Date(2026, 0, 14, 15, 30); // 14 Jan 2026, mid-afternoon.

describe('deadlineUrgency', () => {
  it('returns null when there is no deadline', () => {
    expect(deadlineUrgency(null, NOW)).toBeNull();
  });

  it('returns null rather than NaN for an unparseable column', () => {
    expect(deadlineUrgency('rolling admission', NOW)).toBeNull();
  });

  it('counts today as 0 days whatever the time of day', () => {
    // The alternative — subtracting timestamps — makes this -1 by teatime.
    expect(deadlineUrgency('2026-01-14', NOW)).toEqual({ days: 0, tone: 'urgent' });
  });

  it('bands a date already behind us as passed', () => {
    expect(deadlineUrgency('2026-01-13', NOW)).toEqual({ days: -1, tone: 'passed' });
  });

  it('bands the fortnight ahead as urgent, inclusive of the boundary', () => {
    expect(deadlineUrgency('2026-01-28', NOW)).toEqual({ days: 14, tone: 'urgent' });
  });

  it('bands the month ahead as soon, inclusive of the boundary', () => {
    expect(deadlineUrgency('2026-01-29', NOW)).toEqual({ days: 15, tone: 'soon' });
    expect(deadlineUrgency('2026-02-13', NOW)).toEqual({ days: 30, tone: 'soon' });
  });

  it('leaves anything further out unbanded', () => {
    expect(deadlineUrgency('2026-02-14', NOW)).toEqual({ days: 31, tone: 'normal' });
  });
});
