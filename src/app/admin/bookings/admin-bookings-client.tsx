'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { BookingStatus } from '@/types/achievers';
import { Badge, Button, Panel, StatTile, type BadgeVariant } from '@/shared/ui';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';
import { EmptyRow, TableShell, TD, TH } from '../_ui';

function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

/** Same reading as the mentor queue: rose is work waiting on an admin. */
const STATUS_VARIANT: Record<BookingStatus, BadgeVariant> = {
  pending_payment: 'brand-chip',
  confirmed: 'info-chip',
  completed: 'safe-chip',
  reviewed: 'safe-chip',
  cancelled: 'neutral-chip',
};

const STATUS_LABEL: Record<BookingStatus, string> = {
  pending_payment: 'Pending payment',
  confirmed: 'Confirmed',
  completed: 'Completed',
  reviewed: 'Reviewed',
  cancelled: 'Cancelled',
};

function StatusBadge({ status }: { status: BookingStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
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
    <div className="flex flex-col gap-gb-4xl">
      <div className="grid gap-gb-xl sm:grid-cols-3">
        <StatTile
          label="Pending payments"
          value={pendingPayment.length}
          hint="Waiting on a transfer"
          tone="brand"
        />
        <StatTile label="Active sessions" value={confirmed.length} hint="Paid, not yet held" tone="info" />
        {/* StatTile drops the tone on a numeric zero by itself, but this value
            is pre-formatted ("0 ₫") and it will not parse a string — so the
            caller, which does know the number, decides. A green zero says
            "revenue banked" about no revenue. */}
        <StatTile
          label="Total GlowBal revenue"
          value={formatVND(totalRevenue)}
          hint="Fee on confirmed and completed sessions"
          tone={totalRevenue > 0 ? 'safe' : 'default'}
        />
      </div>

      <section className="flex flex-col gap-gb-xl">
        <h3 className="text-gb-lg font-semibold text-fg">
          Awaiting payment confirmation ({pendingPayment.length})
        </h3>

        {pendingPayment.length === 0 ? (
          <Panel className="text-center text-gb-sm text-fg-muted">No pending payments.</Panel>
        ) : (
          pendingPayment.map((booking) => (
            <Panel key={booking.id} className="flex flex-col gap-gb-xl">
              <div className="flex flex-wrap items-start justify-between gap-gb-xl">
                <div className="flex min-w-0 flex-col gap-gb-xxs">
                  <p className="text-gb-md font-semibold text-fg">
                    Booking #{booking.id} · {booking.achiever?.display_name ?? 'Achiever'}
                  </p>
                  <p className="text-gb-sm text-fg-tertiary">
                    {formatVND(booking.session_price_vnd)} · Ref{' '}
                    <span className="font-mono text-fg-info">{booking.payment_reference}</span>
                  </p>
                  <p className="text-gb-xs text-fg-muted">Created {formatDate(booking.created_at)}</p>
                </div>
                <StatusBadge status={booking.status} />
              </div>

              <dl className="grid gap-gb-xl rounded-gb-xl border border-line bg-surface-muted p-gb-2xl sm:grid-cols-2">
                <div className="flex flex-col gap-gb-xxs">
                  <dt className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">
                    GlowBal fee
                  </dt>
                  <dd className="text-gb-sm text-fg-secondary">
                    {formatVND(booking.glowbal_fee_vnd)}
                  </dd>
                </div>
                <div className="flex flex-col gap-gb-xxs">
                  <dt className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">
                    Achiever payout
                  </dt>
                  <dd className="text-gb-sm text-fg-secondary">
                    {formatVND(booking.achiever_payout_vnd)}
                  </dd>
                </div>
              </dl>

              <div className="flex flex-wrap gap-gb-lg border-t border-line pt-gb-xl">
                <Button
                  onClick={() => void confirmPayment(booking.id)}
                  disabled={updating === booking.id}
                  size="lg"
                >
                  Confirm payment
                </Button>
                <Button
                  onClick={() => void cancelBooking(booking.id)}
                  disabled={updating === booking.id}
                  variant="secondary"
                  size="lg"
                >
                  Cancel
                </Button>
              </div>
            </Panel>
          ))
        )}
      </section>

      <section className="flex flex-col gap-gb-xl">
        <h3 className="text-gb-lg font-semibold text-fg">All bookings</h3>
        <TableShell>
          <thead className="border-b border-line bg-surface-muted">
            <tr>
              <th scope="col" className={TH}>ID</th>
              <th scope="col" className={TH}>Achiever</th>
              <th scope="col" className={`${TH} text-right`}>Amount</th>
              <th scope="col" className={`${TH} text-right`}>Fee</th>
              <th scope="col" className={TH}>Status</th>
              <th scope="col" className={TH}>Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.length === 0 ? (
              <EmptyRow colSpan={6}>No bookings yet.</EmptyRow>
            ) : (
              items.map((b) => (
                <tr key={b.id}>
                  <td className={`${TD} font-mono text-gb-xs`}>{b.id}</td>
                  <td className={`${TD} font-medium text-fg`}>{b.achiever?.display_name ?? '—'}</td>
                  <td className={`${TD} text-right`}>{formatVND(b.session_price_vnd)}</td>
                  <td
                    className={`${TD} text-right font-semibold ${
                      b.glowbal_fee_vnd > 0 ? 'text-on-tier-safe' : 'text-fg-muted'
                    }`}
                  >
                    {formatVND(b.glowbal_fee_vnd)}
                  </td>
                  <td className={TD}>
                    <StatusBadge status={b.status} />
                  </td>
                  <td className={`${TD} text-fg-muted`}>{formatDate(b.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </TableShell>
      </section>
    </div>
  );
}
