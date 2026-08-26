'use client';

import type { Recommendation } from '../domain';
import { parseIsoDate } from '../domain';
import { useT } from '@/lib/i18n';
import { TaskCard } from './planner-shared';

/**
 * The mobile Planner calendar's DAY AGENDA — what the compact month grid taps
 * into.
 *
 * Part 5.4's mobile pattern is "compact grid + day agenda": a phone cannot
 * show a task card inside every cell, so cells shrink to tappable day numbers
 * (see `planner-calendar.tsx`) and the selected day's tasks live HERE, in one
 * full-width panel under the grid. Selecting a different day re-renders this
 * panel; the grid never carries the tasks itself.
 *
 * Everything shown is honest: the heading names the selected date, the count
 * line says how many tasks that day holds, and an empty day says so in plain
 * text rather than rendering nothing. Tasks render as compact `TaskCard`s in
 * the order they arrive — the same order the desktop grid and the list use,
 * so no view silently reorders a student's plan.
 *
 * The date label goes through the same UTC discipline as `monthLabel`
 * (`timeZone: 'UTC'`): `deadline` is a Postgres DATE, and reading it with
 * local getters puts a student in UTC+7 a day off whenever local midnight and
 * UTC midnight disagree — which is every evening in Vietnam.
 */
function dayAgendaLabel(iso: string): string {
  const date = parseIsoDate(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function CalendarDayAgenda({
  dateIso,
  tasks,
  applicationId,
  onDragStart,
}: {
  /** The selected day, `YYYY-MM-DD`. */
  dateIso: string;
  /** That day's scheduled tasks, already filtered by the caller, in display order. */
  tasks: readonly Recommendation[];
  applicationId: string;
  onDragStart: (id: string) => void;
}) {
  const t = useT();

  return (
    <section
      aria-label={t('Day agenda')}
      className="flex flex-col gap-gb-md rounded-gb-xl border border-line bg-surface p-gb-lg"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-gb-sm">
        <h3 className="text-gb-md font-semibold text-fg">{dayAgendaLabel(dateIso)}</h3>
        {tasks.length > 0 ? (
          <span className="text-gb-xs font-semibold uppercase tracking-wide text-fg-tertiary">
            {tasks.length === 1
              ? t('{count} task', { count: tasks.length })
              : t('{count} tasks', { count: tasks.length })}
          </span>
        ) : null}
      </div>

      {tasks.length === 0 ? (
        <p className="rounded-gb-lg border border-dashed border-line px-gb-lg py-gb-xl text-center text-gb-sm text-fg-muted">
          {t('No tasks on this day')}
        </p>
      ) : (
        <ul className="flex list-none flex-col gap-gb-md p-0">
          {tasks.map((rec) => (
            <li key={rec.id}>
              <TaskCard recommendation={rec} applicationId={applicationId} onDragStart={onDragStart} compact />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
