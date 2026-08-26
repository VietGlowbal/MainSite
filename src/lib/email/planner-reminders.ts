/**
 * Reminder policy for the Planner: which application-deadline reminder
 * (30 / 7 / 1 day), which same-day batch, and which weekly strategy digest a
 * cron run should attempt — plus the stable event key each send is claimed
 * under.
 *
 * Grounded in docs/email-system.md: the weekly digest is preferred over
 * per-task mail ("Planner and deadlines"), automated mail needs a stable
 * logical event key ("Idempotency and delivery logging"), and the daily cron
 * runs at 02:00 UTC ("Scheduler"). The cron processor owns every side effect
 * — querying applications, reading `email_preferences`, claiming keys through
 * `beginEmailDelivery` — this module only decides.
 *
 * PURE BY CONSTRUCTION: no process.env, no Date.now(), no fetch, no Supabase,
 * not even an import. `now`, the user's timezone and the deadline all arrive
 * as inputs, so tests pin exact instants and reruns are reproducible. (The
 * module is server-only by usage contract; a runtime `import 'server-only'`
 * guard is deliberately omitted because vitest cannot resolve it outside
 * Next's bundler.)
 *
 * ALL CALENDAR MATH RUNS IN THE USER'S TIMEZONE. A deadline is a day in a
 * student's life, not an instant on the server: at 2026-09-01T17:30Z it is
 * already Sep 2 in Ho Chi Minh City, so a Sep 3 deadline is one day away
 * there even though UTC still counts two. Local dates are read through Intl
 * with an explicit IANA zone, and distances compare calendar dates anchored
 * at UTC midnight, so DST transitions — including the half-hour kind such as
 * Australia/Lord_Howe — can never bend a distance by an hour.
 */

export type ReminderSlot = '30d' | '7d' | '1d';

export type ReminderDecision =
  | { kind: 'none'; reason: string }
  | { kind: 'deadline'; slot: ReminderSlot; applicationId: string }
  | { kind: 'same_day_batch'; applicationId: string };

export type DeadlineReminderInput = {
  applicationId: string;
  /** ISO date (YYYY-MM-DD) or ISO datetime of the application deadline. */
  deadline: string;
  authority: 'official' | 'user_set' | 'derived' | 'unknown';
  /** IANA timezone of the user, e.g. 'Asia/Ho_Chi_Minh'. */
  timeZone: string;
  /** The cron run instant. */
  now: Date;
};

/**
 * Reminder windows as (slot, whole local days before the deadline), in
 * precedence order.
 *
 * The windows are single exact days, so they cannot overlap in any given run
 * — but the scan is ordered anyway (30d first, same-day last) so precedence
 * holds by construction if a window ever widens into a range: a run landing
 * inside two windows then still returns the earlier-listed, tighter reminder
 * instead of two emails for one deadline.
 */
const REMINDER_SLOTS: readonly (readonly [ReminderSlot, number])[] = [
  ['30d', 30],
  ['7d', 7],
  ['1d', 1],
];

const ISO_CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_WEEK_KEY = /^\d{4}-W\d{2}$/;
const MS_PER_DAY = 86_400_000;

/**
 * Decide whether this cron run should attempt a reminder for one application
 * deadline, and if so which slot.
 *
 * The caller maps `deadline_source` → `authority` per
 * fetch-planning-context-sources.ts ('official'/'university_page'/
 * 'course_page' → official, 'user_set'/'manual' → user_set,
 * 'extracted_from_page'/'ai_extracted' → derived) and owns the filtering this
 * module must not repeat: completed tasks, missing deadlines, and the
 * `deadline_reminders` preference all stay caller-side.
 */
export function decideDeadlineReminder(input: DeadlineReminderInput): ReminderDecision {
  // Authority gates before anything else, cheaply: an unattributable date
  // never earns an email, however well-formed it is.
  if (input.authority === 'unknown') {
    return { kind: 'none', reason: 'authority_unknown' };
  }

  if (Number.isNaN(input.now.getTime())) {
    return { kind: 'none', reason: 'invalid_now' };
  }

  const todayIso = zonedLocalDate(input.now, input.timeZone);
  if (todayIso === null) {
    // One corrupt stored timezone must not crash a batch run over many users;
    // skipping quietly mirrors the unknown-authority stance above.
    return { kind: 'none', reason: 'invalid_time_zone' };
  }

  const deadlineIso = resolveDeadlineLocalDate(input.deadline, input.timeZone);
  if (deadlineIso === null) return { kind: 'none', reason: 'invalid_deadline' };

  const distance = calendarDayDistance(todayIso, deadlineIso);
  if (distance < 0) return { kind: 'none', reason: 'deadline_past' };
  if (distance === 0) {
    return { kind: 'same_day_batch', applicationId: input.applicationId };
  }

  for (const [slot, days] of REMINDER_SLOTS) {
    if (distance === days) {
      return { kind: 'deadline', slot, applicationId: input.applicationId };
    }
  }
  return { kind: 'none', reason: 'outside_reminder_windows' };
}

/**
 * The user-local `YYYY-MM-DD` a deadline falls on — the exact reduction
 * `decideDeadlineReminder` uses internally. Callers MUST build the event key
 * from this value (not from the raw stored deadline) so a datetime edit that
 * only moves the time of day can never rotate the key, and so the key always
 * names the same calendar day the decision was computed against. Null means
 * the deadline or zone is unparseable; the decision for that row will already
 * have been `none`.
 */
export function deadlineLocalDate(deadline: string, timeZone: string): string | null {
  return resolveDeadlineLocalDate(deadline, timeZone);
}

export type WeeklyDigestInput = {
  userId: string;
  now: Date;
  timeZone: string;
  /** Tasks that are overdue or due within the next 7 days, already filtered by the caller. */
  actionableTasks: number;
};

/**
 * Whether this run should attempt the weekly strategy digest for one user.
 *
 * The caller still owns the `weekly_strategy_digest` preference and the
 * completed-task filtering; this only refuses an EMPTY digest, because a
 * "you have nothing to do" email trains students to ignore the next one. The
 * week key is returned even when skipping so a skipped run can be logged
 * against the same identity a real send would have used.
 */
export function decideWeeklyDigest(input: WeeklyDigestInput): {
  send: boolean;
  reason: string;
  weekKey: string;
} {
  const todayIso = zonedLocalDate(input.now, input.timeZone);
  if (todayIso === null) return { send: false, reason: 'invalid_time_zone', weekKey: '' };

  const weekKey = isoWeekKey(todayIso);
  if (input.actionableTasks <= 0) {
    return { send: false, reason: 'no_actionable_tasks', weekKey };
  }
  return { send: true, reason: 'actionable_tasks', weekKey };
}

/**
 * Stable idempotency key for one deadline reminder, e.g.
 * `deadline-7d:app-9:2026-10-15`.
 *
 * The deadline DATE is part of the key on purpose: when a deadline changes,
 * the old date's claim must not swallow the new date's reminder. Pass the
 * user-local calendar date `decideDeadlineReminder` computed — a raw datetime
 * here would rotate the key whenever someone edits a time of day.
 */
export function deadlineReminderEventKey(
  applicationId: string,
  slot: ReminderSlot,
  deadlineIsoDate: string,
): string {
  return `deadline-${slot}:${applicationId}:${requireIsoCalendarDate(deadlineIsoDate, 'deadlineIsoDate')}`;
}

/** One same-day-batch claim per application per day, e.g.
    `same-day:app-9:2026-10-15`. Low-priority items are combined into one
    digest email upstream; each application still claims its own key so a
    partial retry cannot re-send another application's item. */
export function sameDayBatchEventKey(applicationId: string, dateIso: string): string {
  return `same-day:${applicationId}:${requireIsoCalendarDate(dateIso, 'dateIso')}`;
}

/** One digest per user per ISO week, e.g. `strategy-digest:user-1:2026-W38`. */
export function weeklyDigestEventKey(userId: string, weekKey: string): string {
  return `strategy-digest:${userId}:${requireWeekKey(weekKey)}`;
}

/* ── Calendar helpers ─────────────────────────────────────────────────────── */

/**
 * Reduce a deadline to the user-local `YYYY-MM-DD` it falls on, or null when
 * it is unparseable.
 *
 * A bare calendar date is zone-free — the day means the same day in every
 * zone — so it is validated rather than converted, and impossible dates
 * (2026-02-30) fail instead of silently rolling over into March. A datetime
 * IS converted into the user's zone: reducing to the local calendar day is
 * what keeps both the reminder schedule and the event key stable across a
 * time-of-day edit. The timezone is validated by the caller before this runs.
 */
function resolveDeadlineLocalDate(deadline: string, timeZone: string): string | null {
  if (ISO_CALENDAR_DATE.test(deadline)) {
    return isRealCalendarDate(deadline) ? deadline : null;
  }
  const instant = new Date(deadline);
  if (Number.isNaN(instant.getTime())) return null;
  return zonedLocalDate(instant, timeZone);
}

/**
 * The `YYYY-MM-DD` an instant falls on in `timeZone`, or null when the zone
 * is not a known IANA identifier (Intl throws RangeError at construction).
 *
 * en-CA renders year-month-day numerically, but formatToParts is read and
 * reassembled explicitly so no locale's presentation habits are trusted.
 */
function zonedLocalDate(instant: Date, timeZone: string): string | null {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(instant);
    const segment = (type: Intl.DateTimeFormatPartTypes): string | undefined =>
      parts.find((part) => part.type === type)?.value;
    const iso = `${segment('year')}-${segment('month')}-${segment('day')}`;
    return ISO_CALENDAR_DATE.test(iso) ? iso : null;
  } catch {
    return null;
  }
}

/** Whole calendar days from `fromIso` to `toIso` (deadline day minus today). */
function calendarDayDistance(fromIso: string, toIso: string): number {
  return Math.round((utcMidnight(toIso) - utcMidnight(fromIso)) / MS_PER_DAY);
}

/**
 * Epoch millis of a `YYYY-MM-DD` at UTC midnight — the anchor that makes day
 * arithmetic immune to DST: both ends sit exactly N×24h apart regardless of
 * what the user's wall clock did in between.
 */
function utcMidnight(iso: string): number {
  const match = ISO_CALENDAR_DATE.exec(iso);
  if (!match) return Number.NaN;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** Rejects rollover dates (2026-02-30) by round-tripping back through UTC. */
function isRealCalendarDate(iso: string): boolean {
  const match = ISO_CALENDAR_DATE.exec(iso);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

/**
 * ISO-8601 week key (`2026-W34`) for a local calendar date, Monday-start.
 *
 * Week 1 of a year is the week containing that year's first Thursday, so the
 * year label comes from the week's THURSDAY rather than the date itself:
 * Monday 2024-12-30 reads `2025-W01`, while late December of a 53-week year
 * such as 2026 (Jan 1 falls on a Thursday) correctly stays inside
 * `2026-W53`.
 */
function isoWeekKey(localDateIso: string): string {
  const date = new Date(utcMidnight(localDateIso));
  const mondayIndex = (date.getUTCDay() + 6) % 7; // 0 = Monday … 6 = Sunday
  const thursday = new Date(date);
  thursday.setUTCDate(thursday.getUTCDate() + (3 - mondayIndex));
  const weekYear = thursday.getUTCFullYear();
  const daysSinceJan1 = Math.round((thursday.getTime() - Date.UTC(weekYear, 0, 1)) / MS_PER_DAY);
  const week = Math.floor(daysSinceJan1 / 7) + 1;
  return `${weekYear}-W${String(week).padStart(2, '0')}`;
}

/* ── Key guards ───────────────────────────────────────────────────────────── */

/**
 * Event keys drive `email_deliveries.event_key` uniqueness, and an
 * unparseable date would mint a plausible-looking but wrong identity that
 * defeats deduplication invisibly. Fail loudly at integration time instead.
 */
function requireIsoCalendarDate(value: string, label: string): string {
  if (!ISO_CALENDAR_DATE.test(value)) {
    throw new TypeError(`${label} must be a YYYY-MM-DD calendar date, received "${value}"`);
  }
  return value;
}

function requireWeekKey(value: string): string {
  if (!ISO_WEEK_KEY.test(value)) {
    throw new TypeError(`weekKey must be a YYYY-Www ISO week key, received "${value}"`);
  }
  return value;
}
