import { NextResponse, type NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { getStripe, stripeWebhookSecret } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { confirmBookingFromSession } from '@/lib/mentorship/confirm-booking';

/**
 * POST /api/mentorship/webhook
 *
 * Stripe webhook handler. We listen for `checkout.session.completed`,
 * `checkout.session.expired`, and `charge.refunded` events and update the
 * booking accordingly.
 *
 * Why this needs to be a webhook rather than the success_url:
 *   • The mentee can close the browser between paying and being redirected.
 *   • Stripe is the source of truth for "did the money actually arrive?".
 *   • A webhook gives us a strong guarantee — and we verify the signature
 *     with STRIPE_WEBHOOK_SECRET so an attacker can't spoof confirmations.
 *
 * The actual confirm-and-email logic lives in `confirmBookingFromSession`
 * so the success page can call it as a fallback when the webhook hasn't
 * fired yet (e.g. webhooks aren't configured for the current environment).
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
      await confirmBookingFromSession(session, admin);
    } else if (event.type === 'checkout.session.expired') {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutExpired(session, admin);
    } else if (event.type === 'charge.refunded') {
      const charge = event.data.object as Stripe.Charge;
      await handleRefund(charge, admin);
    }
  } catch (err) {
    console.error('[webhook] handler error', err);
    // Return 500 so Stripe retries; idempotency in the helper makes that safe.
    return NextResponse.json({ error: 'Handler error' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
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
    .update({
      status: 'cancelled',
      cancelled_by: 'applicant',
      cancellation_reason: 'Checkout session expired',
    })
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
    .update({
      status: 'cancelled',
      cancelled_by: 'admin',
      cancellation_reason: 'Refunded via Stripe',
    })
    .eq('id', booking.id);
}
