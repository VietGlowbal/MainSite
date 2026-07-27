'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { BookingStatus } from '@/types/achievers';
import { useLoadingIndicator } from '@/shared/ui';

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
  applicant_id: string;
  achiever_id: string;
  scheduled_at: string;
  session_price_vnd: number;
  glowbal_fee_vnd: number;
  achiever_payout_vnd: number;
  status: BookingStatus;
  payment_reference: string | null;
  created_at: string;
  achiever: { display_name: string } | null;
};

export function AdminBookingsClient({ bookings }: { bookings: BookingRow[] }) {
  const [items, setItems] = useState(bookings);
  const [updating, setUpdating] = useState<number | null>(null);
  useLoadingIndicator(updating !== null, 'Updating the booking');

  const pendingPayment = items.filter((b) => b.status === 'pending_payment');
  const confirmed = items.filter((b) => b.status === 'confirmed');
  const completed = items.filter((b) => b.status === 'completed' || b.status === 'reviewed');

  const totalRevenue = [...completed, ...confirmed].reduce((sum, b) => sum + b.glowbal_fee_vnd, 0);

  async function confirmPayment(bookingId: number) {
    setUpdating(bookingId);
    const supabase = createClient();
    await supabase
      .from('bookings')
      .update({
        status: 'confirmed',
        payment_confirmed_at: new Date().toISOString(),
      })
      .eq('id', bookingId);

    setItems((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, status: 'confirmed' as BookingStatus } : b)),
    );
    setUpdating(null);
  }

  async function cancelBooking(bookingId: number) {
    setUpdating(bookingId);
    const supabase = createClient();
    await supabase
      .from('bookings')
      .update({
        status: 'cancelled',
        cancelled_by: 'admin',
      })
      .eq('id', bookingId);

    setItems((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, status: 'cancelled' as BookingStatus } : b)),
    );
    setUpdating(null);
  }

  return (
    <div className="space-y-6">
      {/* Revenue summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="glow-card text-center">
          <p className="text-sm text-slate-500">Pending payments</p>
          <p className="text-2xl font-semibold text-amber-600 mt-1">{pendingPayment.length}</p>
        </div>
        <div className="glow-card text-center">
          <p className="text-sm text-slate-500">Active sessions</p>
          <p className="text-2xl font-semibold text-sky-600 mt-1">{confirmed.length}</p>
        </div>
        <div className="glow-card text-center">
          <p className="text-sm text-slate-500">Total Glowbal revenue</p>
          <p className="text-2xl font-semibold text-emerald-600 mt-1">{formatVND(totalRevenue)}</p>
        </div>
      </div>

      {/* Pending payment bookings */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">
          Awaiting payment confirmation ({pendingPayment.length})
        </h2>
        {pendingPayment.length === 0 ? (
          <p className="text-sm text-slate-400">No pending payments.</p>
        ) : (
          pendingPayment.map((booking) => (
            <article key={booking.id} className="glow-card space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-slate-900">
                    Booking #{booking.id} · {booking.achiever?.display_name ?? 'Achiever'}
                  </p>
                  <p className="text-sm text-slate-500">
                    {formatVND(booking.session_price_vnd)} · Ref:{' '}
                    <span className="font-mono text-sky-600">{booking.payment_reference}</span>
                  </p>
                  <p className="text-xs text-slate-400">
                    Created {new Date(booking.created_at).toLocaleDateString()}
                  </p>
                </div>
                <StatusBadge status={booking.status} />
              </div>

              <div className="text-xs text-slate-500 space-y-0.5">
                <p>Fee: {formatVND(booking.glowbal_fee_vnd)} (20%)</p>
                <p>Achiever payout: {formatVND(booking.achiever_payout_vnd)}</p>
              </div>

              <div className="flex gap-2 pt-2 border-t border-black/5">
                <button
                  type="button"
                  onClick={() => confirmPayment(booking.id)}
                  disabled={updating === booking.id}
                  className="glow-button-primary text-xs px-4 py-2"
                >
                  Confirm payment
                </button>
                <button
                  type="button"
                  onClick={() => cancelBooking(booking.id)}
                  disabled={updating === booking.id}
                  className="glow-button-secondary text-xs px-4 py-2"
                >
                  Cancel
                </button>
              </div>
            </article>
          ))
        )}
      </section>

      {/* All bookings table */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">All bookings</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase tracking-wider">
                <th className="pb-2 pr-4">ID</th>
                <th className="pb-2 pr-4">Achiever</th>
                <th className="pb-2 pr-4">Amount</th>
                <th className="pb-2 pr-4">Fee</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {items.map((b) => (
                <tr key={b.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4 font-mono text-xs">{b.id}</td>
                  <td className="py-2 pr-4">{b.achiever?.display_name ?? '—'}</td>
                  <td className="py-2 pr-4">{formatVND(b.session_price_vnd)}</td>
                  <td className="py-2 pr-4 text-emerald-600">{formatVND(b.glowbal_fee_vnd)}</td>
                  <td className="py-2 pr-4"><StatusBadge status={b.status} /></td>
                  <td className="py-2 text-xs text-slate-400">{new Date(b.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
