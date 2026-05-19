'use client';

import { useEffect, useState } from 'react';
import type { AchieverWithUniversity, AchieverAvailability } from '@/types/achievers';
import { createClient } from '@/lib/supabase/client';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
}

type Props = {
  achiever: AchieverWithUniversity;
  availability: AchieverAvailability[];
  onClose: () => void;
};

type BookingState = 'select' | 'confirm' | 'success';

export function BookingModal({ achiever, availability, onClose }: Props) {
  const [state, setState] = useState<BookingState>('select');
  const [selectedSlot, setSelectedSlot] = useState<AchieverAvailability | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentRef, setPaymentRef] = useState<string | null>(null);

  // Close on Escape, lock body scroll while open
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const bankName = process.env.NEXT_PUBLIC_GLOWBAL_BANK_NAME ?? 'VietcomBank';
  const bankAccount = process.env.NEXT_PUBLIC_GLOWBAL_BANK_ACCOUNT ?? '(Contact admin)';
  const bankHolder = process.env.NEXT_PUBLIC_GLOWBAL_BANK_HOLDER ?? 'GLOWBAL';

  // Group availability by day
  const slotsByDay = DAYS.map((day, i) => ({
    day,
    slots: availability.filter((s) => s.day_of_week === i),
  })).filter((d) => d.slots.length > 0);

  async function handleBooking() {
    if (!selectedSlot || !notes.trim()) {
      setError('Please select a slot and describe what you want to discuss.');
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError('Please sign in to book a session.');
      setLoading(false);
      return;
    }

    // Calculate next occurrence of this day/time
    const now = new Date();
    const targetDay = selectedSlot.day_of_week; // 0=Mon
    const currentDay = (now.getDay() + 6) % 7; // Convert JS Sunday=0 to Monday=0
    let daysUntil = targetDay - currentDay;
    if (daysUntil <= 0) daysUntil += 7;

    const scheduledDate = new Date(now);
    scheduledDate.setDate(scheduledDate.getDate() + daysUntil);
    const [hours, minutes] = selectedSlot.start_time.split(':').map(Number);
    scheduledDate.setHours(hours, minutes, 0, 0);

    const glowbalFee = Math.round(achiever.session_price_vnd * 0.2);
    const achieverPayout = achiever.session_price_vnd - glowbalFee;
    const refSuffix = Math.floor(1000 + Math.random() * 9000);
    const reference = `GLOW-${refSuffix}`;

    const { data, error: insertError } = await supabase
      .from('bookings')
      .insert({
        applicant_id: user.id,
        achiever_id: achiever.id,
        scheduled_at: scheduledDate.toISOString(),
        duration_mins: achiever.session_duration_mins,
        session_price_vnd: achiever.session_price_vnd,
        glowbal_fee_vnd: glowbalFee,
        achiever_payout_vnd: achieverPayout,
        status: 'pending_payment',
        payment_reference: reference,
        applicant_notes: notes,
      })
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    setPaymentRef(data.payment_reference);
    setState('success');
    setLoading(false);
  }

  return (
    <div
      className="glow-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-modal-title"
    >
      <div
        className="glow-modal-shell max-w-lg w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="glow-modal-header">
          <div>
            <h3 id="booking-modal-title" className="text-lg font-semibold text-slate-900">
              {state === 'success' ? 'Booking confirmed!' : 'Book a session'}
            </h3>
            <p className="text-sm text-slate-500">
              {achiever.display_name} · {achiever.session_duration_mins} min · {formatVND(achiever.session_price_vnd)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="glow-modal-body">
          {state === 'select' && (
            <div className="space-y-5">
              {/* Slot selection */}
              <div>
                <p className="text-sm font-medium text-slate-700 mb-3">Choose a time slot</p>
                {slotsByDay.length === 0 ? (
                  <p className="text-sm text-slate-400">No availability set yet.</p>
                ) : (
                  <div className="space-y-3">
                    {slotsByDay.map(({ day, slots }) => (
                      <div key={day}>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                          {day}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {slots.map((slot) => {
                            const isSelected = selectedSlot?.id === slot.id;
                            return (
                              <button
                                key={slot.id}
                                type="button"
                                onClick={() => setSelectedSlot(slot)}
                                className={`glow-chip text-xs px-3 py-1.5 ${isSelected ? 'glow-chip-selected' : ''}`}
                              >
                                {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="text-sm font-medium text-slate-700">
                  What would you like to discuss? <span className="text-red-400">*</span>
                </label>
                <textarea
                  className="field mt-1.5 text-sm min-h-[100px]"
                  placeholder="e.g. I want to know about the application process for Computer Science..."
                  maxLength={500}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
                <p className="text-xs text-slate-400 mt-1">{notes.length}/500</p>
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <button
                type="button"
                onClick={handleBooking}
                disabled={loading || !selectedSlot || !notes.trim()}
                className="glow-button-primary w-full py-3"
              >
                {loading ? 'Booking...' : 'Confirm booking'}
              </button>
            </div>
          )}

          {state === 'success' && (
            <div className="space-y-5 text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>

              <div>
                <p className="text-lg font-semibold text-slate-900">Session booked!</p>
                <p className="text-sm text-slate-500 mt-1">
                  Complete the payment below to confirm your session.
                </p>
              </div>

              {/* Payment instructions */}
              <div className="glow-muted-card text-left space-y-3">
                <p className="text-sm font-semibold text-slate-800">Payment instructions</p>
                <div className="space-y-2 text-sm text-slate-600">
                  <p><strong>Amount:</strong> {formatVND(achiever.session_price_vnd)}</p>
                  <p><strong>Bank:</strong> {bankName}</p>
                  <p><strong>Account:</strong> {bankAccount}</p>
                  <p><strong>Holder:</strong> {bankHolder}</p>
                  <p>
                    <strong>Transfer note:</strong>{' '}
                    <span className="font-mono text-sky-600 font-semibold">{paymentRef}</span>
                  </p>
                </div>
                <p className="text-xs text-slate-400">
                  Use the transfer note exactly as shown. Your session will be confirmed once payment is verified (usually within 24 hours).
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="glow-button-secondary w-full py-2.5"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
