'use client';

import { useMemo, useState } from 'react';
import type { MentorAvailabilitySlot } from '@/types/mentorship';
import { ChevronIcon } from './mentor-icons';

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEKDAY_HEAD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type Props = {
  slots: MentorAvailabilitySlot[];
  selectedSlotId: number | null;
  onSelectSlot: (slot: MentorAvailabilitySlot | null) => void;
};

/**
 * A monthly calendar that highlights which dates have open slots, lets the
 * mentee click a date to see the time chips for that day, and pick one.
 *
 * We deliberately keep this self-contained — no external date-fns import.
 */
export function MentorAvailabilityGrid({ slots, selectedSlotId, onSelectSlot }: Props) {
  // Group slots by YYYY-MM-DD in the user's local TZ. We render with their
  // local time so a Vietnam mentor's 19:00 slot reads as 13:00 in Paris.
  const slotsByDay = useMemo(() => {
    const map = new Map<string, MentorAvailabilitySlot[]>();
    for (const s of slots) {
      const d = new Date(s.starts_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }
    // Ensure each day's slots are time-sorted.
    for (const arr of map.values()) {
      arr.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    }
    return map;
  }, [slots]);

  // Default focus month: the first month containing an open slot, else this month.
  const initialMonth = useMemo(() => {
    if (slots.length === 0) return new Date();
    const earliest = slots.reduce(
      (acc, s) => (new Date(s.starts_at) < acc ? new Date(s.starts_at) : acc),
      new Date(slots[0].starts_at),
    );
    return new Date(earliest.getFullYear(), earliest.getMonth(), 1);
  }, [slots]);

  const [viewMonth, setViewMonth] = useState<Date>(initialMonth);
  const [activeDate, setActiveDate] = useState<string | null>(null);

  const monthStart = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const monthEnd = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0);

  // Calendar grid: lead in with empty cells from the previous month so the
  // first row aligns to Monday.
  const cells: (Date | null)[] = [];
  const leadEmpty = (monthStart.getDay() + 6) % 7; // Mon=0
  for (let i = 0; i < leadEmpty; i++) cells.push(null);
  for (let d = 1; d <= monthEnd.getDate(); d++) {
    cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const todayKey = (() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  })();

  const activeSlots = activeDate ? slotsByDay.get(activeDate) ?? [] : [];

  function shiftMonth(delta: number) {
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
    setActiveDate(null);
  }

  return (
    <div className="space-y-4">
      {/* Month header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100"
          aria-label="Previous month"
        >
          <ChevronIcon dir="left" />
        </button>
        <p className="text-sm font-semibold text-slate-900">
          {MONTH_LABELS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
        </p>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100"
          aria-label="Next month"
        >
          <ChevronIcon dir="right" />
        </button>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1 px-1 text-center text-[0.65rem] font-semibold uppercase tracking-wider text-slate-400">
        {WEEKDAY_HEAD.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((cell, i) => {
          if (!cell) {
            return <div key={`e-${i}`} className="h-12" />;
          }
          const key = `${cell.getFullYear()}-${String(cell.getMonth() + 1).padStart(2, '0')}-${String(cell.getDate()).padStart(2, '0')}`;
          const daySlots = slotsByDay.get(key) ?? [];
          const hasSlots = daySlots.length > 0;
          const isPast = key < todayKey;
          const isActive = activeDate === key;
          const isToday = key === todayKey;
          const dayHasSelected = daySlots.some((s) => s.id === selectedSlotId);

          return (
            <button
              key={key}
              type="button"
              disabled={!hasSlots || isPast}
              onClick={() => setActiveDate(isActive ? null : key)}
              className={[
                'relative flex h-12 flex-col items-center justify-center rounded-xl border text-sm transition',
                hasSlots && !isPast
                  ? isActive
                    ? 'border-pink-300 bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] text-white shadow-[0_6px_16px_rgba(255,77,140,0.25)]'
                    : dayHasSelected
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-pink-200 hover:bg-pink-50/40'
                  : isPast
                  ? 'border-transparent text-slate-300'
                  : 'border-transparent text-slate-300',
                isToday && !isActive ? 'ring-1 ring-cyan-300' : '',
              ].join(' ')}
            >
              <span className="font-semibold">{cell.getDate()}</span>
              {hasSlots && !isPast && (
                <span
                  className={`mt-0.5 h-1 w-1 rounded-full ${
                    isActive ? 'bg-white' : dayHasSelected ? 'bg-emerald-500' : 'bg-pink-500'
                  }`}
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day's time chips */}
      {activeDate && activeSlots.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            {new Date(`${activeDate}T00:00:00`).toLocaleDateString(undefined, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}{' '}
            · times shown in your timezone
          </p>
          <div className="flex flex-wrap gap-2">
            {activeSlots.map((slot) => {
              const start = new Date(slot.starts_at);
              const end = new Date(slot.ends_at);
              const isSelected = slot.id === selectedSlotId;
              const disabled = slot.status !== 'open';
              return (
                <button
                  key={slot.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelectSlot(isSelected ? null : slot)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                    isSelected
                      ? 'border-pink-300 bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] text-white shadow-[0_6px_18px_rgba(255,77,140,0.25)]'
                      : disabled
                      ? 'border-slate-200 bg-slate-50 text-slate-400 line-through'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-pink-200 hover:text-pink-600'
                  }`}
                >
                  {start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  {' – '}
                  {end.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!activeDate && slots.length > 0 && (
        <p className="text-xs text-slate-400">
          Pick a highlighted date to see open times. New slots are added regularly.
        </p>
      )}

      {slots.length === 0 && (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
          This mentor hasn&rsquo;t opened any new slots yet. Check back soon, or message support to nudge them.
        </p>
      )}
    </div>
  );
}
