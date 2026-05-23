import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripe } from '@/lib/stripe';
import { holdMentorSlot, isSupportedCurrency } from '@/lib/mentors';
import { computeServiceFee, computeTotal, meetsStripeMinimum } from '@/lib/currency';

/**
 * POST /api/mentorship/checkout
 *
 * Creates a Stripe Checkout session for a mentorship booking. Flow:
 *   1. Authenticate the mentee.
 *   2. Validate the slot still exists and is open.
 *   3. Soft-hold the slot for 30 min so a parallel booking can't grab it.
 *   4. Create a `pending_payment` booking row (unique payment_reference).
 *   5. Create a Stripe Checkout session and return its URL.
 *
 * The webhook (POST /api/mentorship/webhook) flips the booking to
 * `confirmed`, generates a meeting link, and sends emails on success.
 */

const BodySchema = z.object({
  slot_id: z.number().int().positive(),
  help_topic: z.string().min(3).max(200),
  help_questions: z.string().max(1500).optional().nullable(),
  help_outcome: z.string().max(500).optional().nullable(),
  user_university_id: z.number().int().positive().optional().nullable(),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  // Load the slot + mentor profile via the admin client so RLS doesn't
  // hide the mentor's pricing fields from the mentee.
  const admin = createAdminClient();

  const { data: slot, error: slotErr } = await admin
    .from('mentor_availability_slots')
    .select('id, mentor_id, starts_at, ends_at, status')
    .eq('id', input.slot_id)
    .maybeSingle();

  if (slotErr || !slot) {
    return NextResponse.json({ error: 'Slot not found' }, { status: 404 });
  }
  if (slot.status !== 'open') {
    return NextResponse.json(
      { error: 'This slot is no longer available' },
      { status: 409 },
    );
  }
  if (new Date(slot.starts_at).getTime() < Date.now() + 60 * 60 * 1000) {
    return NextResponse.json(
      { error: 'Sessions must be booked at least an hour in advance' },
      { status: 400 },
    );
  }

  const { data: mentor, error: mentorErr } = await admin
    .from('achiever_profiles')
    .select(
      'id, display_name, hourly_rate_amount, hourly_rate_currency, status, session_duration_mins',
    )
    .eq('id', slot.mentor_id)
    .maybeSingle();

  if (mentorErr || !mentor) {
    return NextResponse.json({ error: 'Mentor not found' }, { status: 404 });
  }
  if (mentor.status !== 'approved') {
    return NextResponse.json(
      { error: 'Mentor is not currently accepting bookings' },
      { status: 403 },
    );
  }

  if (!isSupportedCurrency(mentor.hourly_rate_currency)) {
    return NextResponse.json(
      { error: 'Mentor pricing is not configured. Please try another mentor.' },
      { status: 400 },
    );
  }
  if (!mentor.hourly_rate_amount || mentor.hourly_rate_amount <= 0) {
    return NextResponse.json(
      { error: 'Mentor pricing is not configured.' },
      { status: 400 },
    );
  }

  const currency = mentor.hourly_rate_currency;
  const mentorAmount = Number(mentor.hourly_rate_amount);
  const serviceFee = computeServiceFee(mentorAmount);
  const total = computeTotal(mentorAmount);

  if (!meetsStripeMinimum(total, currency)) {
    return NextResponse.json(
      { error: 'The booking total is below the payment minimum.' },
      { status: 400 },
    );
  }

  // Hold the slot before creating the booking — the unique partial transition
  // 'open' → 'held' acts as a lock so concurrent bookings collide cleanly.
  const held = await holdMentorSlot(input.slot_id);
  if (!held.ok) {
    return NextResponse.json({ error: held.error }, { status: 409 });
  }

  // Generate a payment reference for human-friendly support tickets.
  const refSuffix = Math.floor(10000 + Math.random() * 89999);
  const paymentReference = `GLOW-${refSuffix}`;

  // Insert the booking row in pending_payment.
  const startsAt = new Date(slot.starts_at);
  const endsAt = new Date(slot.ends_at);
  const durationMins = Math.round(
    (endsAt.getTime() - startsAt.getTime()) / 60000,
  );

  const { data: booking, error: bookingErr } = await admin
    .from('bookings')
    .insert({
      applicant_id: user.id,
      achiever_id: mentor.id,
      user_university_id: input.user_university_id ?? null,
      scheduled_at: startsAt.toISOString(),
      duration_mins: durationMins,
      // Legacy columns (kept for back-compat with existing dashboards)
      session_price_vnd: currency === 'VND' ? mentorAmount : 0,
      glowbal_fee_vnd: currency === 'VND' ? serviceFee : 0,
      achiever_payout_vnd: currency === 'VND' ? mentorAmount : 0,
      // New canonical money fields
      currency,
      amount_total: total,
      amount_mentor: mentorAmount,
      amount_service_fee: serviceFee,
      slot_id: input.slot_id,
      status: 'pending_payment',
      payment_reference: paymentReference,
      help_topic: input.help_topic,
      help_questions: input.help_questions ?? null,
      help_outcome: input.help_outcome ?? null,
      applicant_notes: input.help_questions ?? null,
    })
    .select()
    .single();

  if (bookingErr || !booking) {
    // Roll the slot back to open so it doesn't get stuck in 'held'.
    await admin
      .from('mentor_availability_slots')
      .update({ status: 'open', hold_expires_at: null })
      .eq('id', input.slot_id);

    return NextResponse.json(
      { error: bookingErr?.message ?? 'Could not create booking' },
      { status: 500 },
    );
  }

  // Create the Stripe Checkout Session.
  // Stripe rejects success/cancel URLs without an explicit scheme, so we
  // normalise the base URL: strip any trailing slash, prepend https:// if
  // it's missing, and fall back to the request origin when the env var
  // isn't set. On Vercel, VERCEL_URL is the deployment hostname without a
  // scheme, which is the most common reason this used to break.
  function normaliseBaseUrl(raw: string): string {
    let v = raw.trim();
    if (!v) return '';
    // Drop trailing slashes so we don't end up with `//path`.
    v = v.replace(/\/+$/, '');
    // Add scheme if missing. localhost stays http, everything else is https.
    if (!/^https?:\/\//i.test(v)) {
      v = `${v.startsWith('localhost') ? 'http' : 'https'}://${v}`;
    }
    return v;
  }

  const baseUrl =
    normaliseBaseUrl(
      process.env.NEXT_PUBLIC_SITE_URL ||
        process.env.VERCEL_URL ||
        new URL(request.url).origin,
    ) || 'https://localhost:3000';

  let stripeSession;
  try {
    // One-line diagnostic so we can tell at-a-glance whether the dev server
    // actually has the Stripe env vars loaded. Lengths only — never values.
    if (!process.env.STRIPE_SECRET_KEY) {
      console.warn(
        '[checkout] STRIPE_SECRET_KEY not visible to this process. ' +
          'Restart `npm run dev` after editing .env.local. ' +
          `Visible vars: SUPABASE_URL=${!!process.env.NEXT_PUBLIC_SUPABASE_URL}, ` +
          `SERVICE_ROLE=${!!process.env.SUPABASE_SERVICE_ROLE_KEY}, ` +
          `WEBHOOK_SECRET=${!!process.env.STRIPE_WEBHOOK_SECRET}`,
      );
    }
    const stripe = getStripe();
    stripeSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: user.email,
      client_reference_id: String(booking.id),
      // Land on the bookings list (which exists, unlike /dashboard/bookings/[id])
      // and pass the Stripe session id so we can confirm + email as a fallback
      // when the webhook hasn't fired yet. {CHECKOUT_SESSION_ID} is replaced
      // by Stripe at redirect time.
      success_url: `${baseUrl}/dashboard/bookings?status=success&session_id={CHECKOUT_SESSION_ID}&booking=${booking.id}`,
      cancel_url: `${baseUrl}/mentors/${mentor.id}?status=cancelled&booking=${booking.id}`,
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: `Glowbal mentorship — ${mentor.display_name}`,
              description: `${durationMins} min session • ${input.help_topic.slice(0, 80)}`,
            },
            unit_amount: total,
          },
          quantity: 1,
        },
      ],
      metadata: {
        booking_id: String(booking.id),
        mentor_id: mentor.id,
        applicant_id: user.id,
        slot_id: String(input.slot_id),
      },
      payment_intent_data: {
        description: `Glowbal mentorship booking #${booking.id}`,
        metadata: {
          booking_id: String(booking.id),
          mentor_id: mentor.id,
        },
      },
      // Auto-expire after ~31 min so we don't leave the slot held forever.
      // Stripe rejects expires_at values that aren't strictly more than
      // 30 minutes ahead, so we add a 60-second safety margin to absorb
      // clock drift and request latency.
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
    });
  } catch (err) {
    // Surface the real Stripe error message so the booking modal can show
    // something actionable instead of the generic catch-all. We still log
    // the full error for the server-side trail.
    const stripeErr = err as { message?: string; code?: string; param?: string };
    const detail =
      stripeErr?.message ||
      (typeof err === 'string' ? err : 'unknown Stripe error');
    console.error('[checkout] Stripe error', {
      message: stripeErr?.message,
      code: stripeErr?.code,
      param: stripeErr?.param,
    });
    // If it's the env-var problem, swap the copy for a clearer hint.
    const friendly = detail.includes('STRIPE_SECRET_KEY is not set')
      ? 'Stripe is not configured for this environment. If you just added STRIPE_SECRET_KEY to .env.local, stop and restart `npm run dev`.'
      : `Payment setup failed: ${detail}`;
    // Roll back the booking and slot.
    await admin.from('bookings').update({ status: 'cancelled', cancelled_by: 'admin', cancellation_reason: `Stripe checkout init failed: ${detail}` }).eq('id', booking.id);
    await admin
      .from('mentor_availability_slots')
      .update({ status: 'open', hold_expires_at: null })
      .eq('id', input.slot_id);
    return NextResponse.json(
      { error: friendly },
      { status: 502 },
    );
  }

  // Save the Stripe session id on the booking.
  await admin
    .from('bookings')
    .update({ stripe_session_id: stripeSession.id })
    .eq('id', booking.id);

  return NextResponse.json({
    booking_id: booking.id,
    checkout_url: stripeSession.url,
  });
}
