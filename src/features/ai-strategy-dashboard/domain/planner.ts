import type { ProgressStatus, Recommendation } from './recommendation';

/**
 * Application Planner — the pure logic behind the three views of a student's
 * improvement plan (list, calendar, kanban). No React, no dates-from-now
 * baked in: every function that needs "today" takes it as an argument so the
 * tests are not time-of-day dependent.
 *
 * ─── WHAT THE DESIGN ASKS FOR THAT THE DATA DOES NOT HAVE ────────────────────
 *
 * The supplied mockups carry two columns with no field behind them, and
 * inventing either would put made-up information in front of a student:
 *
 *   - "Cấp độ" (Phase / Step / Micro Step). There is no task hierarchy in
 *     `application_recommendations` — recommendations are a flat list grouped
 *     by `category` (Academics, Activities, Personal Statement, Impact,
 *     Personal). The list view uses `category` in that column instead, which
 *     is real and is the grouping the rest of the Strategy already uses. A
 *     genuine Phase/Step/Micro-Step hierarchy is a schema change and a
 *     generator change, not a UI change.
 *   - "Ngày bắt đầu" (start date). Nothing records when a student began a
 *     task. `created_at` — when the recommendation was generated — is the
 *     honest nearest thing, and the column is labelled "Added" rather than
 *     "Started" so it does not claim to be something it isn't.
 *
 * ─── WHERE DEADLINES COME FROM ───────────────────────────────────────────────
 *
 * `application_recommendations.deadline` has existed since
 * supabase-strategy-dashboard.sql but nothing has ever written to it — the
 * generator sets it to null (see `recommendationFromImprovementAction`), so
 * every task has always been undated. The calendar answers that: the STUDENT
 * sets deadlines, by dragging a task out of the unscheduled tray onto a day.
 * That is deliberate rather than a fallback — an AI-guessed deadline is a
 * date a student did not agree to and cannot be held to, and deriving one
 * from the application deadline would give every task in a category the same
 * day. Dragging makes the commitment theirs.
 */

export const PLANNER_VIEWS = ['list', 'calendar', 'kanban'] as const;
export type PlannerView = (typeof PLANNER_VIEWS)[number];

export const PLANNER_VIEW_LABEL: Record<PlannerView, string> = {
  list: 'List',
  calendar: 'Calendar',
  kanban: 'Board',
};

/**
 * The board's columns, left to right.
 *
 * FIVE, NOT THE MOCKUP'S FOUR. The design draws Todo / Inprocess / Review /
 * Done, but `ProgressStatus` has a fifth value — `blocked` — and dropping it
 * would mean a blocked task simply vanished from the board rather than being
 * the thing most in need of attention. It sits last, after Done, because it
 * is an exception rather than a stage of progress.
 */
export const KANBAN_COLUMNS: readonly ProgressStatus[] = [
  'not_started',
  'in_progress',
  'needs_review',
  'completed',
  'blocked',
];

/** Board headings. Shorter than `PROGRESS_STATUS_LABEL` where a column header
    needs to be scannable at a glance; identical where it doesn't. */
export const KANBAN_COLUMN_LABEL: Record<ProgressStatus, string> = {
  not_started: 'To do',
  in_progress: 'In progress',
  needs_review: 'Review',
  completed: 'Done',
  blocked: 'Blocked',
};

export function groupByStatus(
  recommendations: readonly Recommendation[],
): Record<ProgressStatus, Recommendation[]> {
  const groups = {
    not_started: [] as Recommendation[],
    in_progress: [] as Recommendation[],
    completed: [] as Recommendation[],
    needs_review: [] as Recommendation[],
    blocked: [] as Recommendation[],
  } satisfies Record<ProgressStatus, Recommendation[]>;
  for (const rec of recommendations) groups[rec.status].push(rec);
  return groups;
}

/* ── Dates ───────────────────────────────────────────────────────────────── */

/**
 * `YYYY-MM-DD` for a Date, read in UTC.
 *
 * UTC ON PURPOSE, THROUGHOUT. `deadline` is a Postgres `DATE` — a calendar
 * day with no time and no zone. Reading it with local getters puts a student
 * in UTC+7 one day off whenever the browser's local midnight and UTC midnight
 * disagree, which is every evening in Vietnam. Every function here converts
 * through UTC so a day is the same day everywhere.
 */
export function toIsoDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** `YYYY-MM-DD` → a Date at UTC midnight. Invalid input gives an Invalid Date,
    which every caller here guards with `Number.isNaN`. */
export function parseIsoDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

/**
 * Whole days from `today` to `deadline`. Negative when overdue, 0 on the day.
 * Null when the task has no deadline — which, until a student drags one onto
 * the calendar, is every task.
 */
export function daysRemaining(deadline: string | null, today: Date): number | null {
  if (deadline === null) return null;
  const due = parseIsoDate(deadline);
  if (Number.isNaN(due.getTime())) return null;
  const start = parseIsoDate(toIsoDate(today));
  return Math.round((due.getTime() - start.getTime()) / 86_400_000);
}

/** How the "Còn lại" cell should read, and how urgently it should be styled. */
export type DueTone = 'overdue' | 'today' | 'soon' | 'later' | 'none';

export function dueTone(days: number | null): DueTone {
  if (days === null) return 'none';
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days <= 7) return 'soon';
  return 'later';
}

export function dueLabel(days: number | null): string {
  if (days === null) return 'Not scheduled';
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  return `${days}d left`;
}

/* ── Calendar grid ───────────────────────────────────────────────────────── */

export type CalendarDay = {
  readonly iso: string;
  readonly dayOfMonth: number;
  /** False for the leading/trailing days that pad the grid to whole weeks. */
  readonly inMonth: boolean;
};

/**
 * Six weeks of days covering `month`, padded with the surrounding month's days
 * so every row is a full week.
 *
 * MONDAY-FIRST, and always six rows. A month needs between four and six weeks
 * depending on where its first day falls; returning a variable number of rows
 * makes the calendar change height as a student pages through it, which is
 * the same jumping problem the guide page had. Six is the maximum, so a fixed
 * six always fits and never resizes.
 */
export function calendarMonthGrid(year: number, month: number): CalendarDay[][] {
  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  // getUTCDay is 0=Sunday; shift so 0=Monday.
  const leadingBlanks = (firstOfMonth.getUTCDay() + 6) % 7;

  const gridStart = new Date(firstOfMonth);
  gridStart.setUTCDate(gridStart.getUTCDate() - leadingBlanks);

  const weeks: CalendarDay[][] = [];
  const cursor = new Date(gridStart);
  for (let week = 0; week < 6; week += 1) {
    const days: CalendarDay[] = [];
    for (let day = 0; day < 7; day += 1) {
      days.push({
        iso: toIsoDate(cursor),
        dayOfMonth: cursor.getUTCDate(),
        inMonth: cursor.getUTCMonth() === month && cursor.getUTCFullYear() === year,
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(days);
  }
  return weeks;
}

/** Tasks that have a deadline, keyed by that day. */
export function scheduledByDay(
  recommendations: readonly Recommendation[],
): Map<string, Recommendation[]> {
  const byDay = new Map<string, Recommendation[]>();
  for (const rec of recommendations) {
    if (rec.deadline === null) continue;
    const existing = byDay.get(rec.deadline);
    if (existing) existing.push(rec);
    else byDay.set(rec.deadline, [rec]);
  }
  return byDay;
}

/** Tasks with no deadline — the tray a student drags out of. */
export function unscheduled(recommendations: readonly Recommendation[]): Recommendation[] {
  return recommendations.filter((rec) => rec.deadline === null);
}

/** "August 2026" — the calendar's own heading. */
export function monthLabel(year: number, month: number): string {
  return new Date(Date.UTC(year, month, 1)).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Move `month` by `delta`, rolling the year over. */
export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const shifted = new Date(Date.UTC(year, month + delta, 1));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() };
}

/* ── List filtering ──────────────────────────────────────────────────────── */

/**
 * The list view's search box. Matches title, reason and category so a student
 * can find "personal statement" whether that is the task's name or its group.
 * Case- and accent-insensitive: the roster and the UI are bilingual, and a
 * Vietnamese student typing "ho so" should still find "Hồ sơ".
 */
export function matchesQuery(rec: Recommendation, query: string): boolean {
  const needle = normalise(query);
  if (needle === '') return true;
  return [rec.title, rec.reason ?? '', rec.category ?? ''].some((field) =>
    normalise(field).includes(needle),
  );
}

function normalise(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    // Strip combining marks so "Hồ sơ" and "ho so" compare equal. Đ/đ do not
    // decompose, so they are mapped explicitly.
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd');
}
