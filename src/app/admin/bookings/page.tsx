import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isPaymentAdmin } from '@/lib/auth-helpers';
import { AdminHeading } from '../_ui';
import { AdminBookingsClient, type PaymentItem } from './admin-bookings-client';

export const dynamic = 'force-dynamic';

function formatPlanName(plan?: string | null): string {
  switch (plan) {
    case 'plus-starter':
      return 'GlowBal Plus · Starter (1 Month)';
    case 'plus-pro':
      return 'GlowBal Plus · Pro (3 Months)';
    case 'plus-premium':
      return 'GlowBal Plus · Premium (6 Months)';
    default:
      return plan ? `GlowBal Plus (${plan})` : 'GlowBal Plus Subscription';
  }
}

/**
 * Bookings & payments console.
 *
 * Restricted strictly to the founder / authorized payment admin.
 * Unifies all payment transactions (Plus plans & Mentorship) alongside
 * manual review states and booking records.
 */
export default async function AdminBookingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth?redirect=/admin/bookings');
  }

  const canManage = await isPaymentAdmin(user.id, user.email);
  if (!canManage) {
    redirect('/admin');
  }

  const admin = createAdminClient();

  const [
    { data: transactions },
    { data: reviews },
    { data: rawBookings },
  ] = await Promise.all([
    admin
      .from('payment_transactions')
      .select('*')
      .order('created_at', { ascending: false }),
    admin
      .from('manual_payment_reviews')
      .select('*'),
    admin
      .from('bookings')
      .select(`
        *,
        achiever:achiever_profiles!bookings_achiever_id_fkey (
          display_name
        )
      `)
      .order('created_at', { ascending: false }),
  ]);

  const reviewMap = new Map<string, (typeof reviews extends (infer U)[] ? U : never)>();
  reviews?.forEach((r) => {
    reviewMap.set(r.transaction_id, r);
  });

  const bookingMap = new Map<number, (typeof rawBookings extends (infer U)[] ? U : never)>();
  const bookingRefMap = new Map<string, (typeof rawBookings extends (infer U)[] ? U : never)>();
  rawBookings?.forEach((b) => {
    bookingMap.set(b.id, b);
    if (b.payment_reference) {
      bookingRefMap.set(b.payment_reference.trim().toUpperCase(), b);
    }
  });

  const processedBookingIds = new Set<number>();
  const items: PaymentItem[] = [];

  // 1. Process payment transactions (both Plus subscriptions and Mentorship payments)
  (transactions ?? []).forEach((tx) => {
    const review = reviewMap.get(tx.id);
    const booking = tx.booking_id ? bookingMap.get(tx.booking_id) : bookingRefMap.get(tx.reference.trim().toUpperCase());

    if (booking) {
      processedBookingIds.add(booking.id);
    }

    const isClaimed = review?.state === 'claimed' || Boolean(review?.claimed_at);
    let effectiveStatus = tx.status;
    if (tx.status === 'pending' && isClaimed) {
      effectiveStatus = 'claimed';
    } else if (tx.status === 'pending' && review?.state === 'rejected') {
      effectiveStatus = 'rejected';
    }

    let productTitle = '';
    let productSubtitle = '';
    if (tx.product_type === 'plus') {
      productTitle = formatPlanName(tx.plus_plan);
      productSubtitle = `${tx.plus_ai_credits ?? 0} AI Strategy Credits · ${tx.plus_duration_months ?? 1} Months`;
    } else {
      const achieverName = booking?.achiever?.display_name ?? 'Advisor';
      productTitle = `Mentorship with ${achieverName}`;
      productSubtitle = booking?.id ? `Session #${booking.id}` : tx.summary || '1-on-1 Mentorship session';
    }

    items.push({
      id: tx.id,
      transactionId: tx.id,
      bookingId: booking?.id ?? tx.booking_id ?? undefined,
      reference: tx.reference,
      provider: tx.provider,
      productType: tx.product_type as 'plus' | 'mentorship',
      productTitle,
      productSubtitle,
      amountVnd: Number(tx.amount_vnd ?? 0),
      feeAmountVnd: booking ? Number(booking.glowbal_fee_vnd ?? 0) : Math.round(Number(tx.amount_vnd ?? 0) * 0.15),
      customerName: tx.recipient_name || 'GlowBal customer',
      customerEmail: tx.recipient_email || '—',
      status: effectiveStatus,
      isClaimed,
      claimedAt: review?.claimed_at ?? null,
      createdAt: tx.created_at,
      expiresAt: tx.expires_at ?? null,
      achieverName: booking?.achiever?.display_name,
    });
  });

  // 2. Add any standalone bookings not linked to transactions
  (rawBookings ?? []).forEach((b) => {
    if (processedBookingIds.has(b.id)) return;

    items.push({
      id: `booking-${b.id}`,
      bookingId: b.id,
      reference: b.payment_reference || `BK-${b.id}`,
      provider: 'manual_bank_transfer',
      productType: 'mentorship',
      productTitle: `Mentorship with ${b.achiever?.display_name ?? 'Advisor'}`,
      productSubtitle: `Session #${b.id} · Scheduled ${new Date(b.scheduled_at).toLocaleDateString('vi-VN')}`,
      amountVnd: Number(b.session_price_vnd ?? 0),
      feeAmountVnd: Number(b.glowbal_fee_vnd ?? 0),
      customerName: `Student #${b.applicant_id.slice(0, 8)}`,
      customerEmail: '—',
      status: b.status,
      isClaimed: false,
      claimedAt: null,
      createdAt: b.created_at,
      expiresAt: null,
      achieverName: b.achiever?.display_name,
    });
  });

  // Sort newest first
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <section className="flex flex-col gap-gb-3xl">
      <AdminHeading
        title="Bookings & payments"
        description="Review bank transfers, confirm transactions, and track platform revenue."
      />
      <AdminBookingsClient initialItems={items} />
    </section>
  );
}
