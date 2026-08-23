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
import { CalendarDayAgenda } from './calendar-day-agenda';
import { TaskCard } from './planner-shared';
import { useMediaQuery } from './use-media-query';
import type { PlannerRecommendationsController } from './use-planner-recommendations';
import { useT } from '@/lib/i18n';
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
 * `onDeadlineChange` — `usePlannerRecommendations().updateDeadline` — moves
 * the card immediately, PATCHes in the background, and rolls the field back
 * with an error if the save fails. That logic lives in the shared hook, not
 * here, which is also what lets a date dragged here show up on the list and
 * the board without a reload — see the hook's own comment.
 *
 * ─── SIX FIXED WEEKS ─────────────────────────────────────────────────────────
 *
 * `calendarMonthGrid` always returns six rows even when a month needs four or
 * five, so the grid does not change height as a student pages through months.
 *
 * ─── MOBILE: COMPACT GRID + DAY AGENDA (<768px) ──────────────────────────────
 *
 * The desktop arrangement — six tall cells per row with cards inside them, tray
 * beside the grid — does not fit a phone, and simply letting Tailwind collapse
 * it produced a grid whose cells disappeared into slivers. So below the `md`
 * breakpoint this renders a DIFFERENT tree rather than hiding desktop DOM:
 * cells shrink to tappable day numbers (≥44px targets, count shown in-cell),
 * tapping selects a day (`aria-pressed`, plus `aria-current="date"` on today),
 * and the selected day's tasks render in a full-width agenda panel under the
 * grid (`CalendarDayAgenda`). One tree per viewport means no duplicate tab
 * stops and no second source of truth for "which tasks exist" — both trees
 * read the same selectors below.
 *
 * Selection defaults to TODAY until the student taps another day, computed
 * through the same UTC helpers everything else uses (`toIsoDate`), so the
 * server-rendered first paint and the client agree on what "today" is.
 *
 * THE UNSCHEDULED TRAY stays available under the agenda, collapsed behind a
 * disclosure button. Native HTML5 drag does not start from a touch, so on a
 * phone scheduling still happens through the List view's deadline field — that
 * hint ships inside the open tray. Where drag DOES work (narrow desktop
 * windows, tests), the tray keeps its real drop handlers, including
 * drag-back-to-clear.
 */
export function PlannerCalendar({
  applicationId,
  recommendations,
  today,
  onDeadlineChange,
}: {
  applicationId: string;
  recommendations: readonly Recommendation[];
  today: Date;
  onDeadlineChange: PlannerRecommendationsController['updateDeadline'];
}) {
  // Hydration default is DESKTOP (`initialState = true`) — the mobile tree
  // only appears after the media query resolves in an effect, so server and
  // first client paint always agree. See `use-media-query.ts`.
  const isDesktop = useMediaQuery('(min-width: 768px)', true);
  const t = useT();

  const [cursor, setCursor] = useState(() => ({
    year: today.getUTCFullYear(),
    month: today.getUTCMonth(),
  }));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overDay, setOverDay] = useState<string | null>(null);
  /** Mobile selection; stays null (→ today) until the student taps a day. */
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [trayOpen, setTrayOpen] = useState(false);

  /* Shared selectors — one source of truth for both trees. */
  const weeks = calendarMonthGrid(cursor.year, cursor.month);
  const byDay = scheduledByDay(recommendations);
  const tray = unscheduled(recommendations);
  const todayIso = toIsoDate(today);
  /** The day the agenda shows: the student's pick, else today. */
  const activeIso = selectedIso ?? todayIso;

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
        if (id) void onDeadlineChange(id, target);
      },
    };
  }

  function selectMonth(delta: number) {
    setCursor((c) => shiftMonth(c.year, c.month, delta));
  }

  /* Shared month header — label plus prev/next navigation, identical in both
     trees so month paging behaves the same everywhere. */
  const monthHeader = (
    <div className="flex items-center justify-between gap-gb-lg">
      <h3 className="text-gb-lg font-semibold text-fg">{monthLabel(cursor.year, cursor.month)}</h3>
      <div className="flex items-center gap-gb-xs">
        <button
          type="button"
          onClick={() => selectMonth(-1)}
          aria-label="Previous month"
          className="inline-flex size-gb-5xl items-center justify-center rounded-gb-md text-fg-secondary transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <KitIcon art={ICONS.arrowLeft} frame={20} />
        </button>
        <button
          type="button"
          onClick={() => setCursor({ year: today.getUTCFullYear(), month: today.getUTCMonth() })}
          className="rounded-gb-md px-gb-lg py-gb-sm text-gb-sm font-semibold text-fg-secondary transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => selectMonth(1)}
          aria-label="Next month"
          className="inline-flex size-gb-5xl items-center justify-center rounded-gb-md text-fg-secondary transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <KitIcon art={ICONS.arrowRight} frame={20} />
        </button>
      </div>
    </div>
  );

  if (!isDesktop) {
    return (
      <div className="flex flex-col gap-gb-lg p-gb-xl">
        {monthHeader}

        {/* Compact month grid — tap a day to load it into the agenda below.
            Cells are buttons, not drop targets: native drag cannot start from
            touch, so scheduling happens via the List view (hinted in the
            tray). */}
        <div className="overflow-hidden rounded-gb-xl border border-line">
          <div className="grid grid-cols-7 bg-surface-muted">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="py-gb-sm text-center text-gb-xs font-semibold uppercase tracking-wide text-fg-tertiary"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-gb-xxs p-gb-xs">
            {weeks.flat().map((day) => {
              const tasks = byDay.get(day.iso) ?? [];
              const isSelected = day.iso === activeIso;
              const isToday = day.iso === todayIso;
              /* Accessible name carries the day number AND its task count, so
                 a screen-reader user hears what sighted users see in-cell. */
              const countLabel =
                tasks.length === 0
                  ? t('No tasks')
                  : tasks.length === 1
                    ? t('{count} task', { count: tasks.length })
                    : t('{count} tasks', { count: tasks.length });
              return (
                <button
                  key={day.iso}
                  type="button"
                  onClick={() => setSelectedIso(day.iso)}
                  aria-pressed={isSelected}
                  aria-current={isToday ? 'date' : undefined}
                  aria-label={`${day.dayOfMonth}, ${countLabel}`}
                  className={`flex min-h-[44px] flex-col items-center justify-center rounded-gb-sm border transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand ${
                    isSelected
                      ? 'border-brand bg-brand-subtle font-semibold ring-2 ring-brand'
                      : 'border-transparent hover:bg-surface-muted'
                  }`}
                >
                  {/* Same pill treatment as the desktop cell, so "today" reads
                      identically on both trees. */}
                  <span
                    className={`rounded-gb-sm px-gb-xs text-gb-sm font-semibold ${
                      isToday && !isSelected
                        ? 'bg-brand text-white'
                        : isSelected
                          ? 'text-fg'
                          : day.inMonth
                            ? 'text-fg-secondary'
                            : 'text-fg-muted'
                    }`}
                  >
                    {day.dayOfMonth}
                  </span>
                  {tasks.length > 0 ? (
                    <span aria-hidden="true" className="text-gb-xs font-medium text-fg-brand">
                      {tasks.length}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* The selected day's tasks. */}
        <CalendarDayAgenda
          dateIso={activeIso}
          tasks={byDay.get(activeIso) ?? []}
          applicationId={applicationId}
          onDragStart={setDraggingId}
        />

        {/* Unscheduled tray, collapsed by default so the agenda leads. */}
        <section className="flex flex-col gap-gb-md">
          <button
            type="button"
            onClick={() => setTrayOpen((open) => !open)}
            aria-expanded={trayOpen}
            className="inline-flex items-center justify-between rounded-gb-lg border border-line bg-surface-muted px-gb-lg py-gb-md text-gb-sm font-semibold text-fg transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {trayOpen
              ? t('Hide unscheduled')
              : t('Show unscheduled ({count})', { count: tray.length })}
          </button>

          {trayOpen ? (
            <aside
              {...dropHandlers(null)}
              className={`flex max-h-[24rem] flex-col gap-gb-lg overflow-y-auto rounded-gb-xl border p-gb-lg transition-colors ${
                overDay === null && draggingId !== null
                  ? 'border-brand bg-brand-subtle'
                  : 'border-line bg-surface-muted'
              }`}
            >
              <div className="flex flex-col gap-gb-xxs">
                <h3 className="text-gb-sm font-semibold text-fg">Not scheduled</h3>
                <p className="text-gb-xs text-fg-tertiary">
                  {t('Tip: you can also set or clear deadlines from the List view.')}
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
          ) : null}
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-gb-lg p-gb-xl">
      <div className="grid gap-gb-2xl xl:grid-cols-[minmax(0,1fr)_18rem]">
        {/* The month */}
        <div className="flex flex-col gap-gb-lg">
          {monthHeader}

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
