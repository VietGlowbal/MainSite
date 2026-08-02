'use client';

import { useState } from 'react';
import type { Recommendation } from '../domain';
import {
  calendarMonthGrid,
  monthLabel,
  scheduledByDay,
  shiftMonth,
  toIsoDate,
  unscheduled,
} from '../domain';
import { TaskCard } from './planner-shared';
import { ICONS, KitIcon } from '@/shared/ui';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Application Planner — calendar view.
 *
 * ─── THIS IS WHERE DEADLINES COME FROM ───────────────────────────────────────
 *
 * `application_recommendations.deadline` has existed since the first Strategy
 * migration and nothing has ever written to it: the generator sets it to null,
 * so every task has always been undated and the column has never rendered as
 * anything but a dash. This view is the answer — the STUDENT schedules work by
 * dragging a task out of the unscheduled tray onto a day.
 *
 * That is a deliberate product choice, not a shortcut. An AI-guessed deadline
 * is a date the student never agreed to; deriving one from the application
 * deadline would stamp every task in a category with the same day. Dragging
 * makes the commitment theirs, which is the only version of a deadline that
 * means anything.
 *
 * Dragging a task back to the tray clears its deadline — which is why the
 * PATCH schema accepts `deadline: null` explicitly rather than treating an
 * omitted field as "clear it" (see `recommendationPatchSchema`).
 *
 * ─── OPTIMISTIC, WITH A VISIBLE UNDO ─────────────────────────────────────────
 *
 * Same contract as the board: the card moves immediately, the PATCH follows,
 * and a failure puts it back where the server still has it with an error
 * rather than silently pretending. See planner-board.tsx's header.
 *
 * ─── SIX FIXED WEEKS ─────────────────────────────────────────────────────────
 *
 * `calendarMonthGrid` always returns six rows even when a month needs four or
 * five, so the grid does not change height as a student pages through months.
 */
export function PlannerCalendar({
  applicationId,
  recommendations,
  today,
}: {
  applicationId: string;
  recommendations: readonly Recommendation[];
  today: Date;
}) {
  const [cursor, setCursor] = useState(() => ({
    year: today.getUTCFullYear(),
    month: today.getUTCMonth(),
  }));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overDay, setOverDay] = useState<string | null>(null);
  /** Optimistic deadline overrides, by id. `null` means "cleared". */
  const [pending, setPending] = useState<Record<string, string | null>>({});
  const [error, setError] = useState<string | null>(null);

  const withPending = recommendations.map((rec) =>
    rec.id in pending ? { ...rec, deadline: pending[rec.id] ?? null } : rec,
  );

  const weeks = calendarMonthGrid(cursor.year, cursor.month);
  const byDay = scheduledByDay(withPending);
  const tray = unscheduled(withPending);
  const todayIso = toIsoDate(today);

  async function schedule(id: string, deadline: string | null) {
    const original = recommendations.find((rec) => rec.id === id);
    if (!original || original.deadline === deadline) return;

    setPending((current) => ({ ...current, [id]: deadline }));
    setError(null);

    try {
      const response = await fetch(
        `/api/applications/${applicationId}/strategy/recommendations/${id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deadline }),
        },
      );
      if (!response.ok) throw new Error('save failed');
    } catch {
      setPending((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      setError('That date did not save. Please try again.');
    }
  }

  function dropHandlers(target: string | null) {
    return {
      onDragOver: (event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setOverDay(target);
      },
      onDragLeave: () => setOverDay((current) => (current === target ? null : current)),
      onDrop: (event: React.DragEvent) => {
        event.preventDefault();
        const id = draggingId ?? event.dataTransfer.getData('text/plain');
        setOverDay(null);
        setDraggingId(null);
        if (id) void schedule(id, target);
      },
    };
  }

  return (
    <div className="flex flex-col gap-gb-lg p-gb-xl">
      {error ? (
        <p role="alert" className="text-gb-sm text-fg-error">
          {error}
        </p>
      ) : null}

      <div className="grid gap-gb-2xl xl:grid-cols-[minmax(0,1fr)_18rem]">
        {/* The month */}
        <div className="flex flex-col gap-gb-lg">
          <div className="flex items-center justify-between gap-gb-lg">
            <h3 className="text-gb-lg font-semibold text-fg">
              {monthLabel(cursor.year, cursor.month)}
            </h3>
            <div className="flex items-center gap-gb-xs">
              <button
                type="button"
                onClick={() => setCursor((c) => shiftMonth(c.year, c.month, -1))}
                aria-label="Previous month"
                className="inline-flex size-gb-5xl items-center justify-center rounded-gb-md text-fg-secondary transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <KitIcon art={ICONS.arrowLeft} frame={20} />
              </button>
              <button
                type="button"
                onClick={() =>
                  setCursor({ year: today.getUTCFullYear(), month: today.getUTCMonth() })
                }
                className="rounded-gb-md px-gb-lg py-gb-sm text-gb-sm font-semibold text-fg-secondary transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setCursor((c) => shiftMonth(c.year, c.month, 1))}
                aria-label="Next month"
                className="inline-flex size-gb-5xl items-center justify-center rounded-gb-md text-fg-secondary transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <KitIcon art={ICONS.arrowRight} frame={20} />
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-gb-xl border border-line">
            <div className="grid grid-cols-7 border-b border-line bg-surface-muted">
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="px-gb-md py-gb-md text-center text-gb-xs font-semibold uppercase tracking-wide text-fg-tertiary"
                >
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {weeks.flat().map((day) => {
                const tasks = byDay.get(day.iso) ?? [];
                const isTarget = overDay === day.iso;
                const isToday = day.iso === todayIso;
                return (
                  <div
                    key={day.iso}
                    {...dropHandlers(day.iso)}
                    className={`flex min-h-[7rem] flex-col gap-gb-xs border-b border-r border-line p-gb-xs transition-colors last:border-r-0 ${
                      isTarget
                        ? 'bg-brand-subtle'
                        : day.inMonth
                          ? 'bg-surface'
                          : 'bg-surface-muted/60'
                    }`}
                  >
                    <span
                      className={`self-start rounded-gb-sm px-gb-xs text-gb-xs font-semibold ${
                        isToday
                          ? 'bg-brand text-white'
                          : day.inMonth
                            ? 'text-fg-secondary'
                            : 'text-fg-muted'
                      }`}
                    >
                      {day.dayOfMonth}
                    </span>
                    {tasks.map((rec) => (
                      <TaskCard
                        key={rec.id}
                        recommendation={rec}
                        applicationId={applicationId}
                        onDragStart={setDraggingId}
                        compact
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* The unscheduled tray — drag out of here onto a day, or back into it
            to clear a date. */}
        <aside
          {...dropHandlers(null)}
          className={`flex max-h-[36rem] flex-col gap-gb-lg overflow-y-auto rounded-gb-xl border p-gb-lg transition-colors ${
            overDay === null && draggingId !== null
              ? 'border-brand bg-brand-subtle'
              : 'border-line bg-surface-muted'
          }`}
        >
          <div className="flex flex-col gap-gb-xxs">
            <h3 className="text-gb-sm font-semibold text-fg">Not scheduled</h3>
            <p className="text-gb-xs text-fg-tertiary">
              Drag a task onto a day to give it a deadline. Drag it back here to clear one.
            </p>
          </div>

          <div className="flex flex-col gap-gb-md">
            {tray.map((rec) => (
              <TaskCard
                key={rec.id}
                recommendation={rec}
                applicationId={applicationId}
                onDragStart={setDraggingId}
              />
            ))}
            {tray.length === 0 ? (
              <p className="rounded-gb-lg border border-dashed border-line px-gb-lg py-gb-2xl text-center text-gb-xs text-fg-muted">
                Everything has a date.
              </p>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
