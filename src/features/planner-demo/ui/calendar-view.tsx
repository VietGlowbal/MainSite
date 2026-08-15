'use client';

import { useState } from 'react';
import { Button } from '@/shared/ui';
import type { Task } from '../domain';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_LABEL = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' });

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Monday-first 6-week grid covering the given month. */
function buildGrid(monthCursor: Date): Date[] {
  const firstOfMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7; // 0 = Monday
  const start = new Date(firstOfMonth);
  start.setDate(start.getDate() - firstWeekday);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

/**
 * Same underlying tasks as every other view (spec §15) — GlowBal suggesting
 * when work should happen, not a calendar app rebuilt inside the planner.
 */
export function CalendarView({
  tasks,
  deadlineDate,
  deadlineLabel,
  onSelectTask,
}: {
  tasks: readonly Task[];
  deadlineDate: string;
  deadlineLabel: string;
  onSelectTask: (taskId: string) => void;
}) {
  const [monthCursor, setMonthCursor] = useState(() => new Date(2026, 7, 1));
  const [synced, setSynced] = useState(false);
  const grid = buildGrid(monthCursor);
  const tasksByDate = new Map<string, Task[]>();
  for (const task of tasks) {
    if (!task.dueDate) continue;
    const list = tasksByDate.get(task.dueDate) ?? [];
    list.push(task);
    tasksByDate.set(task.dueDate, list);
  }

  return (
    <div className="rounded-gb-2xl border border-line bg-surface p-gb-xl">
      <div className="mb-gb-xl flex flex-wrap items-center justify-between gap-gb-md">
        <div className="flex items-center gap-gb-sm">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setMonthCursor(new Date(2026, 7, 1))}
          >
            Today
          </Button>
          <Button
            variant="secondary"
            size="sm"
            aria-label="Previous month"
            onClick={() => setMonthCursor((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          >
            ←
          </Button>
          <Button
            variant="secondary"
            size="sm"
            aria-label="Next month"
            onClick={() => setMonthCursor((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          >
            →
          </Button>
          <p className="text-gb-sm font-semibold text-fg">{MONTH_LABEL.format(monthCursor)}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setSynced(true)}>
          {synced ? '✓ Synced' : 'Sync my calendar'}
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-gb-xs">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-gb-xs py-gb-xs text-center text-gb-xs font-semibold text-fg-muted">
            {d}
          </div>
        ))}
        {grid.map((day) => {
          const inMonth = day.getMonth() === monthCursor.getMonth();
          const iso = isoDate(day);
          const dayTasks = tasksByDate.get(iso) ?? [];
          const isDeadline = iso === deadlineDate;
          return (
            <div
              key={iso}
              className={`min-h-[84px] rounded-gb-lg border p-gb-xs ${
                isDeadline ? 'border-brand bg-brand-subtle' : 'border-line'
              } ${inMonth ? '' : 'opacity-40'}`}
            >
              <p className={`mb-gb-xs text-gb-xs ${isDeadline ? 'font-bold text-fg-brand' : 'text-fg-muted'}`}>
                {day.getDate()}
              </p>
              <div className="flex flex-col gap-gb-xxs">
                {isDeadline ? (
                  <span className="rounded-gb-sm bg-brand px-gb-xs py-gb-xxs text-[10px] font-semibold text-on-brand">
                    {deadlineLabel.split(' ')[0]} deadline
                  </span>
                ) : null}
                {dayTasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => onSelectTask(task.id)}
                    className="truncate rounded-gb-sm bg-surface-muted px-gb-xs py-gb-xxs text-left text-[10px] font-medium text-fg-secondary hover:bg-brand-subtle hover:text-fg-brand"
                    title={task.title}
                  >
                    {task.title}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-gb-lg text-gb-xs text-fg-muted">
        We&rsquo;ve added these dates to help you stay on track. Reminders go out a couple of days
        before each one.
      </p>
    </div>
  );
}
