'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { AchieverAvailability } from '@/types/achievers';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

type Props = {
  achieverId: string;
  initialSlots: AchieverAvailability[];
};

export function AvailabilityEditorClient({ achieverId, initialSlots }: Props) {
  const [slots, setSlots] = useState<AchieverAvailability[]>(initialSlots);
  const [addingDay, setAddingDay] = useState<number | null>(null);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function addSlot(dayOfWeek: number) {
    setError(null);

    if (startTime >= endTime) {
      setError('End time must be after start time.');
      return;
    }

    // Check overlap
    const daySlots = slots.filter((s) => s.day_of_week === dayOfWeek);
    const overlaps = daySlots.some((s) => {
      return startTime < s.end_time && endTime > s.start_time;
    });

    if (overlaps) {
      setError('This slot overlaps with an existing one.');
      return;
    }

    setSaving(true);
    const supabase = createClient();

    const { data, error: insertError } = await supabase
      .from('achiever_availability')
      .insert({
        achiever_id: achieverId,
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    setSlots((prev) => [...prev, data as AchieverAvailability]);
    setAddingDay(null);
    setStartTime('09:00');
    setEndTime('10:00');
    setSaving(false);
  }

  async function deleteSlot(slotId: number) {
    const supabase = createClient();
    await supabase
      .from('achiever_availability')
      .delete()
      .eq('id', slotId);

    setSlots((prev) => prev.filter((s) => s.id !== slotId));
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {DAYS.map((day, dayIndex) => {
        const daySlots = slots.filter((s) => s.day_of_week === dayIndex);

        return (
          <div key={day} className="glow-card-tight space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">{day}</h3>

            {/* Existing slots */}
            {daySlots.length > 0 ? (
              <div className="space-y-1.5">
                {daySlots.map((slot) => (
                  <div
                    key={slot.id}
                    className="flex items-center justify-between rounded-lg bg-sky-50 border border-sky-100 px-3 py-1.5"
                  >
                    <span className="text-xs font-medium text-sky-700">
                      {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteSlot(slot.id)}
                      className="text-slate-400 hover:text-red-500 transition"
                      aria-label="Delete slot"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">No slots</p>
            )}

            {/* Add slot form */}
            {addingDay === dayIndex ? (
              <div className="space-y-2 pt-2 border-t border-black/5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-500">Start</label>
                    <input
                      type="time"
                      className="field text-xs py-1.5"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">End</label>
                    <input
                      type="time"
                      className="field text-xs py-1.5"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                    />
                  </div>
                </div>
                {error && addingDay === dayIndex && (
                  <p className="text-xs text-red-500">{error}</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => addSlot(dayIndex)}
                    disabled={saving}
                    className="glow-button-primary text-xs px-3 py-1.5 flex-1"
                  >
                    {saving ? '...' : 'Add'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAddingDay(null); setError(null); }}
                    className="glow-button-secondary text-xs px-3 py-1.5"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setAddingDay(dayIndex); setError(null); }}
                className="w-full text-xs text-sky-600 hover:text-sky-700 font-medium py-1.5 border border-dashed border-sky-200 rounded-lg hover:bg-sky-50 transition"
              >
                + Add slot
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
