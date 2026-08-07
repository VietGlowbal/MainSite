import { NextResponse, type NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { getStripe, stripeWebhookSecret } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateMeetingLink, buildIcsForBooking } from '@/lib/meetings';
import {
  sendMenteeConfirmation,
  sendMentorNotification,
} from '@/lib/emails/mentorship-confirmation';
import type { Currency } from '@/types/mentorship';

/**
 * POST /api/mentorship/webhook
 *
 * Stripe webhook handler. We listen for `checkout.session.completed` and
 * `checkout.session.expired` events and update the booking accordingly.
 *
 * Why this needs to be a webhook rather than the success_url:
 *   • The mentee can close the browser between paying and being redirected.
 *   • Stripe is the source of truth for "did the money actually arrive?".
 *   • A webhook gives us a strong guarantee — and we verify the signature
 *     with STRIPE_WEBHOOK_SECRET so an attacker can't spoof confirmations.
 */

// Stripe needs the raw request body to verify the signature, so we disable
// the static route caching/parsing.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const sig = request.headers.get('stripe-signature');
  if (!sig) {
    return NextResponse.json({ error: 'Missing Stripe signature' }, { status: 400 });
  }

  let secret: string;
  try {
    secret = stripeWebhookSecret();
  } catch (err) {
    console.error('[webhook] missing webhook secret', err);
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    const rawBody = await request.text();
    event = getStripe().webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    console.error('[webhook] signature verification failed', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutCompleted(session, admin);
    } else if (event.type === 'checkout.session.expired') {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutExpired(session, admin);
    } else if (event.type === 'charge.refunded') {
      const charge = event.data.object as Stripe.Charge;
      await handleRefund(charge, admin);
    }
  } catch (err) {
    console.error('[webhook] handler error', err);
    // Return 500 so Stripe retries; idempotency below makes that safe.
    return NextResponse.json({ error: 'Handler error' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  admin: ReturnType<typeof createAdminClient>,
): Promise<void> {
  const bookingId = Number(session.metadata?.booking_id ?? session.client_reference_id);
  if (!Number.isFinite(bookingId)) {
    console.warn('[webhook] missing booking_id on session', session.id);
    return;
  }
  if (session.payment_status !== 'paid') {
    console.warn('[webhook] checkout.completed but payment_status is', session.payment_status);
    return;
  }

  // Fetch the booking + mentor in one shot. Idempotent: if we've already
  // confirmed it, we just exit.
  const { data: booking, error: bErr } = await admin
    .from('bookings')
    .select('*, achiever:achiever_profiles!bookings_achiever_id_fkey(id, display_name)')
    .eq('id', bookingId)
    .maybeSingle();

  if (bErr || !booking) {
    console.error('[webhook] booking not found', bookingId, bErr);
    return;
  }
  if (booking.status === 'confirmed' || booking.status === 'completed' || booking.status === 'reviewed') {
    return; // already processed
  }

  // Generate a meeting link.
  const meetingLink = booking.meeting_link ?? generateMeetingLink(bookingId);

  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  await admin
    .from('bookings')
    .update({
      status: 'confirmed',
      payment_confirmed_at: new Date().toISOString(),
      meeting_link: meetingLink,
      stripe_payment_intent_id: paymentIntentId,
    })
    .eq('id', bookingId);

  // The slot status flips to 'booked' via the trg_sync_slot_status trigger.

  // Pull mentee + mentor email from auth.users — RLS doesn't apply via admin.
  const [{ data: applicantUser }, { data: mentorUser }] = await Promise.all([
    admin.auth.admin.getUserById(booking.applicant_id as string),
    admin.auth.admin.getUserById(booking.achiever_id as string),
  ]);

  const menteeEmail = applicantUser?.user?.email ?? session.customer_email ?? null;
  const menteeName =
    (applicantUser?.user?.user_metadata?.full_name as string | undefined) ??
    (menteeEmail ? menteeEmail.split('@')[0] : 'Mentee');
  const mentorEmail = mentorUser?.user?.email ?? null;
  const mentorName = (booking.achiever as { display_name?: string } | null)?.display_name ?? 'Your advisor';

  if (!menteeEmail || !mentorEmail) {
    console.warn('[webhook] missing emails for booking', bookingId, { menteeEmail, mentorEmail });
    return;
  }

  const startsAt = new Date(booking.scheduled_at as string);
  const endsAt = new Date(startsAt.getTime() + (booking.duration_mins as number) * 60_000);
  const ics = buildIcsForBooking({
    bookingId,
    startsAt,
    endsAt,
    mentorName,
    menteeName,
    meetingLink,
    helpTopic: (booking.help_topic as string | null) ?? null,
  });

  const ctx = {
    bookingId,
    mentorName,
    mentorEmail,
    menteeName,
    menteeEmail,
    scheduledAt: startsAt,
    durationMins: booking.duration_mins as number,
    meetingLink,
    helpTopic: (booking.help_topic as string | null) ?? null,
    helpQuestions: (booking.help_questions as string | null) ?? null,
    helpOutcome: (booking.help_outcome as string | null) ?? null,
    amountTotal: Number(booking.amount_total ?? booking.session_price_vnd ?? 0),
    currency: ((booking.currency as Currency) ?? 'VND') as Currency,
    icsContent: ics,
  };

  // Fire emails in parallel; don't block on either failing.
  await Promise.allSettled([
    sendMenteeConfirmation(ctx),
    sendMentorNotification(ctx),
  ]);
}

async function handleCheckoutExpired(
  session: Stripe.Checkout.Session,
  admin: ReturnType<typeof createAdminClient>,
): Promise<void> {
  const bookingId = Number(session.metadata?.booking_id ?? session.client_reference_id);
  if (!Number.isFinite(bookingId)) return;

  const { data: booking } = await admin
    .from('bookings')
    .select('id, status, slot_id')
    .eq('id', bookingId)
    .maybeSingle();
  if (!booking || booking.status !== 'pending_payment') return;

  await admin
    .from('bookings')
    .update({ status: 'cancelled', cancelled_by: 'applicant', cancellation_reason: 'Checkout session expired' })
    .eq('id', bookingId);

  // Trigger releases the slot back to 'open' automatically.
}

async function handleRefund(
  charge: Stripe.Charge,
  admin: ReturnType<typeof createAdminClient>,
): Promise<void> {
  const paymentIntentId =
    typeof charge.payment_intent === 'string'
      ? charge.payment_intent
      : charge.payment_intent?.id;
  if (!paymentIntentId) return;

  // Find the booking whose payment intent matches and mark it cancelled.
  const { data: booking } = await admin
    .from('bookings')
    .select('id, status')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .maybeSingle();
  if (!booking) return;
  if (booking.status === 'cancelled') return;

  await admin
    .from('bookings')
    .update({ status: 'cancelled', cancelled_by: 'admin', cancellation_reason: 'Refunded via Stripe' })
    .eq('id', booking.id);
}
