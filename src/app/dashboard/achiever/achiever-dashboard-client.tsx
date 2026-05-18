'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { AchieverProfile, Booking, BookingStatus } from '@/types/achievers';

function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
}

function StatusBadge({ status }: { status: BookingStatus }) {
  const styles: Record<BookingStatus, string> = {
    pending_payment: 'border-amber-200 bg-amber-50 text-amber-700',
    confirmed: 'border-sky-200 bg-sky-50 text-sky-700',
    completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    reviewed: 'border-purple-200 bg-purple-50 text-purple-700',
    cancelled: 'border-slate-200 bg-slate-50 text-slate-500',
  };

  const labels: Record<BookingStatus, string> = {
    pending_payment: 'Pending payment',
    confirmed: 'Confirmed',
    completed: 'Completed',
    reviewed: 'Reviewed',
    cancelled: 'Cancelled',
  };

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

type Tab = 'sessions' | 'earnings' | 'availability';

export function AchieverDashboardClient({
  profile,
  bookings,
}: {
  profile: AchieverProfile;
  bookings: Booking[];
}) {
  const [tab, setTab] = useState<Tab>('sessions');
  const [meetingLinks, setMeetingLinks] = useState<Record<number, string>>({});
  const [updating, setUpdating] = useState<number | null>(null);

  const confirmedBookings = bookings.filter((b) => b.status === 'confirmed');
  const pendingBookings = bookings.filter((b) => b.status === 'pending_payment');
  const completedBookings = bookings.filter((b) => b.status === 'completed' || b.status === 'reviewed');

  const totalEarnings = completedBookings.reduce((sum, b) => sum + b.achiever_payout_vnd, 0);
  const pendingEarnings = confirmedBookings.reduce((sum, b) => sum + b.achiever_payout_vnd, 0);

  async function markCompleted(bookingId: number) {
    setUpdating(bookingId);
    const supabase = createClient();
    await supabase
      .from('bookings')
      .update({ status: 'completed' })
      .eq('id', bookingId);
    window.location.reload();
  }

  async function saveMeetingLink(bookingId: number) {
    const link = meetingLinks[bookingId];
    if (!link) return;
    setUpdating(bookingId);
    const supabase = createClient();
    await supabase
      .from('bookings')
      .update({ meeting_link: link })
      .eq('id', bookingId);
    setUpdating(null);
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2">
        {([
          { key: 'sessions', label: 'Sessions' },
          { key: 'earnings', label: 'Earnings' },
          { key: 'availability', label: 'Availability' },
        ] as const).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`glow-chip text-sm px-4 py-2 ${tab === t.key ? 'glow-chip-selected' : ''}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Sessions tab */}
      {tab === 'sessions' && (
        <div className="space-y-4">
          {bookings.length === 0 ? (
            <div className="glow-card text-center py-12">
              <p className="text-slate-500">No sessions yet. Once students book you, they will appear here.</p>
            </div>
          ) : (
            [...pendingBookings, ...confirmedBookings, ...completedBookings].map((booking) => (
              <article key={booking.id} className="glow-card space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-slate-500">
                      {new Date(booking.scheduled_at).toLocaleDateString('en-GB', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    <p className="text-sm font-medium text-slate-700 mt-1">
                      {formatVND(booking.session_price_vnd)} · {booking.duration_mins} min
                    </p>
                  </div>
                  <StatusBadge status={booking.status} />
                </div>

                {booking.applicant_notes && (
                  <p className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                    &ldquo;{booking.applicant_notes}&rdquo;
                  </p>
                )}

                {/* Actions for confirmed bookings */}
                {booking.status === 'confirmed' && (
                  <div className="space-y-2 pt-2 border-t border-black/5">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="field text-sm flex-1"
                        placeholder="Paste meeting link (Zalo, Meet, etc.)"
                        value={meetingLinks[booking.id] ?? booking.meeting_link ?? ''}
                        onChange={(e) =>
                          setMeetingLinks((prev) => ({ ...prev, [booking.id]: e.target.value }))
                        }
                      />
                      <button
                        type="button"
                        onClick={() => saveMeetingLink(booking.id)}
                        disabled={updating === booking.id}
                        className="glow-button-secondary text-xs px-3"
                      >
                        Save
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => markCompleted(booking.id)}
                      disabled={updating === booking.id}
                      className="glow-button-primary text-xs px-4 py-2"
                    >
                      Mark as completed
                    </button>
                  </div>
                )}
              </article>
            ))
          )}
        </div>
      )}

      {/* Earnings tab */}
      {tab === 'earnings' && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="glow-card text-center">
              <p className="text-sm text-slate-500">Total sessions</p>
              <p className="text-2xl font-semibold text-slate-900 mt-1">{completedBookings.length}</p>
            </div>
            <div className="glow-card text-center">
              <p className="text-sm text-slate-500">Total earnings</p>
              <p className="text-2xl font-semibold text-emerald-600 mt-1">{formatVND(totalEarnings)}</p>
            </div>
            <div className="glow-card text-center">
              <p className="text-sm text-slate-500">Pending payout</p>
              <p className="text-2xl font-semibold text-amber-600 mt-1">{formatVND(pendingEarnings)}</p>
            </div>
          </div>
          <p className="text-xs text-slate-400 text-center">
            Payouts are processed manually. Contact admin for payout status.
          </p>
        </div>
      )}

      {/* Availability tab */}
      {tab === 'availability' && (
        <div className="glow-card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Weekly availability</h3>
            <Link
              href="/dashboard/achiever/availability"
              className="glow-button-primary text-xs px-4 py-2"
            >
              Edit availability
            </Link>
          </div>
          <p className="text-sm text-slate-500">
            Manage your weekly time slots from the availability editor.
          </p>
        </div>
      )}
    </div>
  );
}
