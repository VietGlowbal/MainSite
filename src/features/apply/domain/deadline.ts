/**
 * How close a deadline is — the one piece of colour on the tracker row that is
 * derived rather than drawn.
 *
 * 562:15078 prints "14 Jan 2026" on all three rows in the same grey, because a
 * mockup has no clock. On the live page a date on its own makes the student do
 * the arithmetic: nine rows, nine dates, and no answer to "which of these is
 * about to close". Banding it is the tracker's job.
 *
 * The bands mirror `ScoreRing`'s: rose is the alarm, amber is the warning,
 * everything else stays out of the way. They are NOT an invented parallel
 * scale — the same three tier hues carry the same three meanings elsewhere on
 * the page.
 *
 * ⚠️ DAYS ARE COUNTED IN CALENDAR DAYS, NOT 24-HOUR BLOCKS. `deadline` is a
 * date column, so a deadline "today" must read as 0 whatever the local time is;
 * subtracting timestamps would call this afternoon's deadline "-1 days" by
 * teatime. Both sides are floored to local midnight first.
 */

export type DeadlineTone = 'passed' | 'urgent' | 'soon' | 'normal';

export type DeadlineUrgency = {
  /** Whole calendar days from today. Negative once the date is behind us. */
  days: number;
  tone: DeadlineTone;
};

/** Local midnight of the day `d` falls on. */
function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

const DAY_MS = 86_400_000;

/**
 * Null for a missing or unparseable date — `deadline` is a nullable column and
 * roughly three quarters of live rows have nothing in it, so "no band" is the
 * common case and not an error worth surfacing.
 */
export function deadlineUrgency(
  iso: string | null | undefined,
  now: Date = new Date(),
): DeadlineUrgency | null {
  if (!iso) return null;
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return null;

  const days = Math.round((startOfDay(due) - startOfDay(now)) / DAY_MS);

  if (days < 0) return { days, tone: 'passed' };
  if (days <= 14) return { days, tone: 'urgent' };
  if (days <= 30) return { days, tone: 'soon' };
  return { days, tone: 'normal' };
}
