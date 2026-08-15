import { createAdminClient } from '@/server/db';

/**
 * Bookings & payments admin console data — unifies `payment_transactions`
 * (Plus + Mentorship) with `manual_payment_reviews` and `bookings`. Lives in
 * `src/server` (not the page itself) because it needs the service-role
 * client: RLS on these tables is scoped to the owning user, and the console
 * is read by a founder/authorized payment admin across every user's rows.
 *
 * `PaymentItem` is defined here (the data's origin), not in the client
 * component that renders it — `src/app` isn't part of the strict TypeScript
 * project, so the reverse dependency direction would have pulled the client
 * component into strict checking as an import side effect.
 */

export type PaymentItem = {
  id: string;
  transactionId?: string | undefined;
  bookingId?: number | undefined;
  reference: string;
  provider: string;
  productType: 'plus' | 'mentorship';
  productTitle: string;
  productSubtitle: string;
  amountVnd: number;
  feeAmountVnd: number;
  customerName: string;
  customerEmail: string;
  status: string;
  isClaimed: boolean;
  claimedAt?: string | null | undefined;
  createdAt: string;
  expiresAt?: string | null | undefined;
  achieverName?: string | undefined;
};

type ReviewRecord = {
  id: string;
  transaction_id: string;
  state: string;
  claimed_at?: string | null;
  review_deadline_at?: string | null;
  reviewed_at?: string | null;
  reviewer_note?: string | null;
};

type BookingRecord = {
  id: number;
  applicant_id: string;
  achiever_id: string;
  scheduled_at: string;
  duration_mins: number;
  session_price_vnd: number;
  glowbal_fee_vnd: number;
  achiever_payout_vnd: number;
  status: string;
  payment_reference?: string | null;
  created_at: string;
  achiever?: { display_name?: string | null } | null;
};

type TransactionRecord = {
  id: string;
  reference: string;
  user_id: string;
  provider: string;
  product_type: string;
  status: string;
  amount_vnd: number;
  booking_id?: number | null;
  plus_plan?: string | null;
  plus_ai_credits?: number | null;
  plus_duration_months?: number | null;
  recipient_name?: string | null;
  recipient_email?: string | null;
  summary?: string | null;
  created_at: string;
  expires_at?: string | null;
  paid_at?: string | null;
  fulfilled_at?: string | null;
};

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

export async function loadAdminBookingPaymentItems(): Promise<PaymentItem[]> {
  const admin = createAdminClient();

  const [transactionsRes, reviewsRes, bookingsRes] = await Promise.all([
    admin.from('payment_transactions').select('*').order('created_at', { ascending: false }),
    admin.from('manual_payment_reviews').select('*'),
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

  const transactions = (transactionsRes.data ?? []) as unknown as TransactionRecord[];
  const reviews = (reviewsRes.data ?? []) as unknown as ReviewRecord[];
  const rawBookings = (bookingsRes.data ?? []) as unknown as BookingRecord[];

  const reviewMap = new Map<string, ReviewRecord>();
  reviews.forEach((r) => {
    reviewMap.set(r.transaction_id, r);
  });

  const bookingMap = new Map<number, BookingRecord>();
  const bookingRefMap = new Map<string, BookingRecord>();
  rawBookings.forEach((b) => {
    bookingMap.set(b.id, b);
    if (b.payment_reference) {
      bookingRefMap.set(b.payment_reference.trim().toUpperCase(), b);
    }
  });

  const processedBookingIds = new Set<number>();
  const items: PaymentItem[] = [];

  // 1. Process payment transactions (both Plus subscriptions and Mentorship payments)
  transactions.forEach((tx) => {
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
      bookingId: booking?.id ?? (tx.booking_id ? Number(tx.booking_id) : undefined),
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
      achieverName: booking?.achiever?.display_name ?? undefined,
    });
  });

  // 2. Add any standalone bookings not linked to transactions
  rawBookings.forEach((b) => {
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
      achieverName: b.achiever?.display_name ?? undefined,
    });
  });

  // Sort newest first
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return items;
}
