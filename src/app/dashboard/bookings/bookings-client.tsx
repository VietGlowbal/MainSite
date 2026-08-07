'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { BookingStatus } from '@/types/achievers';

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

type BookingRow = {
  id: number;
  scheduled_at: string;
  status: BookingStatus;
  session_price_vnd: number;
  payment_reference: string | null;
  meeting_link: string | null;
  applicant_notes: string | null;
  achiever: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    university: { name: string } | null;
  } | null;
};

type Tab = 'upcoming' | 'completed' | 'cancelled';

export function BookingsDashboardClient({
  bookings,
  userId,
  showSuccessBanner = false,
  justConfirmed = false,
  highlightedBookingId = null,
}: {
  bookings: BookingRow[];
  userId: string;
  showSuccessBanner?: boolean;
  justConfirmed?: boolean;
  highlightedBookingId?: number | null;
}) {
  // Reference unused params so lint stays happy without changing the signature.
  void userId;

  const [tab, setTab] = useState<Tab>('upcoming');
  const [bannerOpen, setBannerOpen] = useState(showSuccessBanner);

  const upcoming = bookings.filter((b) => b.status === 'pending_payment' || b.status === 'confirmed');
  const completed = bookings.filter((b) => b.status === 'completed' || b.status === 'reviewed');
  const cancelled = bookings.filter((b) => b.status === 'cancelled');

  const current = tab === 'upcoming' ? upcoming : tab === 'completed' ? completed : cancelled;

  return (
    <div className="space-y-6">
      {bannerOpen && (
        <div
          role="status"
          className="glow-card flex items-start gap-3 border border-emerald-200 bg-emerald-50/70"
        >
          <div className="mt-0.5 text-xl" aria-hidden>
            ✅
          </div>
          <div className="flex-1 text-sm">
            <p className="font-semibold text-emerald-800">
              {justConfirmed
                ? 'Booking confirmed — payment received.'
                : 'Thanks for your payment!'}
            </p>
            <p className="text-emerald-700/80">
              {justConfirmed
                ? 'We\u2019ve emailed you and your advisor with the meeting link and calendar invite. You can also see it below.'
                : 'Your session is confirmed. The meeting link is in your email and on the card below.'}
              {highlightedBookingId ? ` (booking #${highlightedBookingId})` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setBannerOpen(false)}
            className="rounded-full p-1 text-emerald-700/60 hover:bg-emerald-100 hover:text-emerald-900"
            aria-label="Dismiss"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        {([
          { key: 'upcoming', label: 'Upcoming', count: upcoming.length },
          { key: 'completed', label: 'Completed', count: completed.length },
          { key: 'cancelled', label: 'Cancelled', count: cancelled.length },
        ] as const).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`glow-chip text-sm px-4 py-2 ${tab === t.key ? 'glow-chip-selected' : ''}`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {/* Booking cards */}
      {current.length === 0 ? (
        <div className="glow-card text-center py-12">
          <p className="text-slate-500">No {tab} sessions.</p>
          {tab === 'upcoming' && (
            <Link href="/advisors" className="glow-button-primary text-sm px-5 py-2.5 mt-4 inline-flex">
              Find an advisor
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {current.map((booking) => (
            <article
              key={booking.id}
              className={`glow-card space-y-3 ${
                booking.id === highlightedBookingId ? 'ring-2 ring-emerald-300' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #ff4d8c, #00b4d8)',
                      padding: 2,
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: '50%',
                        background: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        color: '#ff4d8c',
                      }}
                    >
                      {booking.achiever?.display_name
                        ?.split(' ')
                        .map((w) => w[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase() ?? '?'}
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">
                      {booking.achiever?.display_name ?? 'Achiever'}
                    </p>
                    <p className="text-xs text-slate-400">
                      {booking.achiever?.university?.name ?? ''}
                    </p>
                  </div>
                </div>
                <StatusBadge status={booking.status} />
              </div>

              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <span className="text-slate-400">Date:</span>{' '}
                  <span className="text-slate-700">
                    {new Date(booking.scheduled_at).toLocaleDateString('en-GB', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Price:</span>{' '}
                  <span className="text-slate-700">{formatVND(booking.session_price_vnd)}</span>
                </div>
              </div>

              {/* Payment reference for pending */}
              {booking.status === 'pending_payment' && booking.payment_reference && (
                <div className="glow-muted-card text-sm space-y-1">
                  <p className="font-medium text-slate-700">Payment pending</p>
                  <p className="text-slate-500">
                    Transfer reference:{' '}
                    <span className="font-mono font-semibold text-sky-600">{booking.payment_reference}</span>
                  </p>
                </div>
              )}

              {/* Meeting link for confirmed */}
              {booking.status === 'confirmed' && booking.meeting_link && (
                <div className="glow-muted-card text-sm">
                  <p className="font-medium text-slate-700">Meeting link</p>
                  <a
                    href={booking.meeting_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-600 hover:underline break-all"
                  >
                    {booking.meeting_link}
                  </a>
                </div>
              )}

              {/* Review CTA for completed */}
              {booking.status === 'completed' && (
                <div className="pt-2 border-t border-black/5">
                  <Link
                    href={`/dashboard/bookings/${booking.id}/review`}
                    className="glow-button-secondary text-xs px-4 py-2"
                  >
                    Leave a review
                  </Link>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
