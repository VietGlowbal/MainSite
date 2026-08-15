import { createHash, randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { computeServiceFee, computeTotal } from '@/lib/currency';
import { getPlusPackage, planAmountMajor } from '@/lib/plus';
import { holdMentorSlot, isSupportedCurrency } from '@/lib/mentors';
import {
  buildVnpayPaymentUrl,
  convertToVnd,
  getClientIp,
  getVnpayConfig,
  VNPAY_FX_RATES,
  VNPAY_TTL_MINUTES,
} from '@/lib/payments/vnpay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Idempotency = z.string().regex(/^[A-Za-z0-9_-]{8,100}$/);
const MentorshipBody = z.object({
  product: z.literal('mentorship'),
  slot_id: z.number().int().positive(),
  help_topic: z.string().trim().min(3).max(200),
  help_questions: z.string().max(1500).optional().nullable(),
  help_outcome: z.string().max(500).optional().nullable(),
  user_university_id: z.number().int().positive().optional().nullable(),
  idempotency_key: Idempotency,
});
const PlusBody = z.object({
  product: z.literal('plus'),
  plan: z.enum(['plus-starter', 'plus-pro', 'plus-premium']),
  currency: z.enum(['USD', 'VND', 'GBP', 'EUR', 'CNY']).optional(),
  applicationId: z.string().uuid().optional(),
  idempotency_key: Idempotency,
});
const BodySchema = z.discriminatedUnion('product', [MentorshipBody, PlusBody]);

type Transaction = {
  id: string;
  reference: string;
  status: string;
  amount_vnd: number | string;
  expires_at: string;
  product_type: 'mentorship' | 'plus';
  booking_id?: number | null;
  plus_plan?: string | null;
  source_currency?: string | null;
  source_amount?: number | null;
  request_fingerprint?: string | null;
};

async function expireTransactionFallback(
  admin: ReturnType<typeof createAdminClient>,
  tx: Transaction,
): Promise<void> {
  await admin.from('payment_transactions').update({ status: 'expired' }).eq('id', tx.id).eq('status', 'pending');
  if (tx.product_type !== 'mentorship' || !tx.booking_id) return;

  const { data: booking } = await admin
    .from('bookings')
    .select('slot_id')
    .eq('id', tx.booking_id)
    .eq('status', 'pending_payment')
    .maybeSingle();
  await admin
    .from('bookings')
    .update({ status: 'cancelled', cancelled_by: 'admin', cancellation_reason: 'VNPay checkout expired' })
    .eq('id', tx.booking_id)
    .eq('status', 'pending_payment');
  if (booking?.slot_id) {
    await admin
      .from('mentor_availability_slots')
      .update({ status: 'open', booking_id: null, hold_expires_at: null })
      .eq('id', booking.slot_id)
      .eq('status', 'held')
      .eq('booking_id', tx.booking_id);
  }
}

function fingerprint(input: unknown): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

function newReference(): string {
  return `GLOW${Date.now().toString(36).toUpperCase()}${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
}

function asciiOrderInfo(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

function transactionUrl(tx: Transaction, request: NextRequest, config: ReturnType<typeof getVnpayConfig>) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  return buildVnpayPaymentUrl({
    amountVnd: Number(tx.amount_vnd),
    txnRef: tx.reference,
    orderInfo: asciiOrderInfo(`GlowBal ${tx.product_type} ${tx.reference}`),
    returnUrl: config.returnUrl ?? `${baseUrl}/payment/vnpay/return`,
    clientIp: getClientIp(request),
    expiresAt: new Date(tx.expires_at),
    config,
  });
}

async function existingTransaction(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  productType: 'mentorship' | 'plus',
  key: string,
  requestFingerprint: string,
  request: NextRequest,
  config: ReturnType<typeof getVnpayConfig>,
): Promise<NextResponse | null> {
  const { data, error } = await admin
    .from('payment_transactions')
    .select('id, reference, status, amount_vnd, expires_at, product_type, booking_id, plus_plan, source_currency, source_amount, request_fingerprint')
    .eq('user_id', userId)
    .eq('provider', 'vnpay')
    .eq('product_type', productType)
    .eq('idempotency_key', key)
    .maybeSingle();
  if (error) return NextResponse.json({ error: 'Could not check payment status.' }, { status: 503 });
  if (!data) return null;
  const tx = data as Transaction;
  if (tx.request_fingerprint !== requestFingerprint) {
    return NextResponse.json({ error: 'This idempotency key was already used for different details.' }, { status: 409 });
  }
  if (tx.status !== 'pending') {
    return NextResponse.json({ error: 'This payment has already been processed.', status: tx.status, reference: tx.reference }, { status: 409 });
  }
  if (new Date(tx.expires_at).getTime() <= Date.now()) {
    const { error: expiryError } = await admin.rpc('expire_vnpay_transaction', {
      p_transaction_id: tx.id,
    });
    if (expiryError) {
      // Keep the checkout retry safe even while an older deployment is being
      // migrated; the database function remains the authoritative path once
      // the VNPay migration is installed.
      await expireTransactionFallback(admin, tx);
    }
    return NextResponse.json({ error: 'This checkout has expired. Please start again.' }, { status: 409 });
  }
  return NextResponse.json({
    checkout_url: transactionUrl(tx, request, config),
    reference: tx.reference,
    ...(tx.booking_id ? { booking_id: tx.booking_id } : {}),
    amount_vnd: Number(tx.amount_vnd),
    expires_at: tx.expires_at,
  });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payment request' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  let config: ReturnType<typeof getVnpayConfig>;
  try {
    config = getVnpayConfig(baseUrl);
  } catch {
    return NextResponse.json({ error: 'VNPay Sandbox is not configured.' }, { status: 503 });
  }

  const admin = createAdminClient();
  if (parsed.data.product === 'plus') {
    const input = parsed.data;
    const pkg = getPlusPackage(input.plan);
    if (!pkg) return NextResponse.json({ error: 'Unknown plan' }, { status: 400 });
    if (input.applicationId) {
      const { data: application } = await admin
        .from('course_applications')
        .select('id')
        .eq('id', input.applicationId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!application) return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }
    const displayCurrency = input.currency ?? 'USD';
    const sourceAmount = planAmountMajor(pkg.amountVnd, displayCurrency);
    const requestFingerprint = fingerprint({ provider: 'vnpay', product: 'plus', plan: pkg.id, currency: displayCurrency, applicationId: input.applicationId ?? null });
    const duplicate = await existingTransaction(admin, user.id, 'plus', input.idempotency_key, requestFingerprint, request, config);
    if (duplicate) return duplicate;

    const reference = newReference();
    const expiresAt = new Date(Date.now() + VNPAY_TTL_MINUTES * 60_000);
    const { data: tx, error } = await admin
      .from('payment_transactions')
      .insert({
        reference,
        user_id: user.id,
        provider: 'vnpay',
        product_type: 'plus',
        status: 'pending',
        amount_vnd: pkg.amountVnd,
        vnp_amount: pkg.amountVnd * 100,
        source_currency: displayCurrency,
        source_amount: sourceAmount,
        fx_rate: VNPAY_FX_RATES[displayCurrency],
        idempotency_key: input.idempotency_key,
        request_fingerprint: requestFingerprint,
        plus_plan: pkg.id,
        plus_ai_credits: pkg.aiCredits,
        plus_duration_months: pkg.durationMonths,
        plus_application_id: input.applicationId ?? null,
        expires_at: expiresAt.toISOString(),
      })
      .select('id, reference, status, amount_vnd, expires_at, product_type, plus_plan, source_currency, source_amount, request_fingerprint')
      .single();
    if (error || !tx) return NextResponse.json({ error: 'Could not create payment.' }, { status: 500 });
    const checkoutUrl = transactionUrl(tx as Transaction, request, config);
    return NextResponse.json({ checkout_url: checkoutUrl, reference, amount_vnd: pkg.amountVnd, expires_at: expiresAt.toISOString() });
  }

  const input = parsed.data;
  const requestFingerprint = fingerprint({
    provider: 'vnpay', product: 'mentorship', slot_id: input.slot_id, help_topic: input.help_topic,
    help_questions: input.help_questions ?? null, help_outcome: input.help_outcome ?? null,
    user_university_id: input.user_university_id ?? null,
  });
  const duplicate = await existingTransaction(admin, user.id, 'mentorship', input.idempotency_key, requestFingerprint, request, config);
  if (duplicate) return duplicate;

  await admin.rpc('reclaim_vnpay_expired_holds');
  const { data: slot, error: slotError } = await admin
    .from('mentor_availability_slots')
    .select('id, mentor_id, starts_at, ends_at, status')
    .eq('id', input.slot_id)
    .maybeSingle();
  if (slotError || !slot) return NextResponse.json({ error: 'Slot not found' }, { status: 404 });
  if (slot.status !== 'open') return NextResponse.json({ error: 'This slot is no longer available' }, { status: 409 });
  if (new Date(slot.starts_at).getTime() < Date.now() + 60 * 60 * 1000) {
    return NextResponse.json({ error: 'Sessions must be booked at least an hour in advance' }, { status: 400 });
  }
  const { data: mentor, error: mentorError } = await admin
    .from('achiever_profiles')
    .select('id, display_name, hourly_rate_amount, hourly_rate_currency, status, session_duration_mins')
    .eq('id', slot.mentor_id)
    .maybeSingle();
  if (mentorError || !mentor) return NextResponse.json({ error: 'Advisor not found' }, { status: 404 });
  if (mentor.status !== 'approved') return NextResponse.json({ error: 'Advisor is not currently accepting bookings' }, { status: 403 });
  if (!isSupportedCurrency(mentor.hourly_rate_currency) || !mentor.hourly_rate_amount || Number(mentor.hourly_rate_amount) <= 0) {
    return NextResponse.json({ error: 'Advisor pricing is not configured.' }, { status: 400 });
  }

  const currency = mentor.hourly_rate_currency as 'USD' | 'GBP' | 'VND';
  const mentorAmount = Number(mentor.hourly_rate_amount);
  const serviceFee = computeServiceFee(mentorAmount);
  const total = computeTotal(mentorAmount);
  const amountVnd = convertToVnd(total, currency);
  const held = await holdMentorSlot(input.slot_id, VNPAY_TTL_MINUTES);
  if (!held.ok) return NextResponse.json({ error: held.error }, { status: 409 });

  const reference = newReference();
  const startsAt = new Date(slot.starts_at);
  const endsAt = new Date(slot.ends_at);
  const durationMins = Math.round((endsAt.getTime() - startsAt.getTime()) / 60000);
  const expiresAt = new Date(Date.now() + VNPAY_TTL_MINUTES * 60_000);
  const { data: booking, error: bookingError } = await admin
    .from('bookings')
    .insert({
      applicant_id: user.id,
      achiever_id: mentor.id,
      user_university_id: input.user_university_id ?? null,
      scheduled_at: startsAt.toISOString(),
      duration_mins: durationMins,
      session_price_vnd: currency === 'VND' ? mentorAmount : 0,
      glowbal_fee_vnd: currency === 'VND' ? serviceFee : 0,
      achiever_payout_vnd: currency === 'VND' ? mentorAmount : 0,
      currency,
      amount_total: total,
      amount_mentor: mentorAmount,
      amount_service_fee: serviceFee,
      slot_id: input.slot_id,
      status: 'pending_payment',
      payment_reference: reference,
      help_topic: input.help_topic,
      help_questions: input.help_questions ?? null,
      help_outcome: input.help_outcome ?? null,
      applicant_notes: input.help_questions ?? null,
    })
    .select('id')
    .single();
  if (bookingError || !booking) {
    await admin
      .from('mentor_availability_slots')
      .update({ status: 'open', hold_expires_at: null })
      .eq('id', input.slot_id)
      .eq('status', 'held')
      .is('booking_id', null);
    return NextResponse.json({ error: 'Could not create booking.' }, { status: 500 });
  }

  // Bind ownership before the ledger row exists. IPN fulfilment only accepts
  // an exact slot.booking_id match, so a late callback cannot steal a re-held
  // slot from another booking.
  const { data: boundSlot, error: bindError } = await admin
    .from('mentor_availability_slots')
    .update({ booking_id: booking.id })
    .eq('id', input.slot_id)
    .eq('status', 'held')
    .is('booking_id', null)
    .select('id')
    .maybeSingle();
  if (bindError || !boundSlot) {
    await admin
      .from('bookings')
      .update({ status: 'cancelled', cancelled_by: 'admin', cancellation_reason: 'VNPay slot binding failed' })
      .eq('id', booking.id)
      .eq('status', 'pending_payment');
    await admin
      .from('mentor_availability_slots')
      .update({ status: 'open', hold_expires_at: null })
      .eq('id', input.slot_id)
      .eq('status', 'held')
      .is('booking_id', null);
    return NextResponse.json({ error: 'Could not reserve the selected slot.' }, { status: 409 });
  }

  const { data: tx, error: txError } = await admin
    .from('payment_transactions')
    .insert({
      reference,
      user_id: user.id,
      provider: 'vnpay',
      product_type: 'mentorship',
      status: 'pending',
      amount_vnd: amountVnd,
      vnp_amount: amountVnd * 100,
      source_currency: currency,
      source_amount: total,
      fx_rate: VNPAY_FX_RATES[currency],
      idempotency_key: input.idempotency_key,
      request_fingerprint: requestFingerprint,
      booking_id: booking.id,
      expires_at: expiresAt.toISOString(),
    })
    .select('id, reference, status, amount_vnd, expires_at, product_type, booking_id, source_currency, source_amount, request_fingerprint')
    .single();
  if (txError || !tx) {
    await admin.from('bookings').update({ status: 'cancelled', cancelled_by: 'admin', cancellation_reason: 'VNPay transaction init failed' }).eq('id', booking.id);
    await admin
      .from('mentor_availability_slots')
      .update({ status: 'open', hold_expires_at: null, booking_id: null })
      .eq('id', input.slot_id)
      .eq('status', 'held')
      .eq('booking_id', booking.id);
    return NextResponse.json({ error: 'Could not create payment.' }, { status: 500 });
  }

  const checkoutUrl = transactionUrl(tx as Transaction, request, config);
  return NextResponse.json({
    checkout_url: checkoutUrl,
    reference,
    booking_id: booking.id,
    amount_vnd: amountVnd,
    expires_at: expiresAt.toISOString(),
  });
}
