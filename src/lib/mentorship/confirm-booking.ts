import 'server-only';

import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateMeetingLink, buildIcsForBooking } from '@/lib/meetings';
import {
  sendMenteeConfirmation,
  sendMentorNotification,
} from '@/lib/emails/mentorship-confirmation';
import type { Currency } from '@/types/mentorship';

/**
 * Idempotent booking-confirmation helper.
 *
 * Originally lived inside the Stripe webhook. We extracted it so the success
 * page can also call it as a fallback when the webhook hasn't fired yet
 * (slow webhook delivery, or the webhook endpoint isn't configured for the
 * current environment). Calling this twice is safe — we early-return when
 * the booking is already confirmed.
 */

type Admin = ReturnType<typeof createAdminClient>;

export type ConfirmOutcome =
  | { ok: true; status: 'confirmed' | 'already_confirmed'; bookingId: number }
  | { ok: false; reason: 'unpaid' | 'not_found' | 'no_booking_id' };

/**
 * Confirm a booking from a Stripe Checkout Session id. Loads the session
 * from Stripe so the caller doesn't need to pass the full object.
 */
export async function confirmBookingBySessionId(
  sessionId: string,
  admin: Admin = createAdminClient(),
): Promise<ConfirmOutcome> {
  let session: Stripe.Checkout.Session;
  try {
    session = await getStripe().checkout.sessions.retrieve(sessionId);
  } catch (err) {
    console.error('[confirm-booking] failed to retrieve session', sessionId, err);
    return { ok: false, reason: 'not_found' };
  }
  return confirmBookingFromSession(session, admin);
}

/**
 * Confirm a booking from a Stripe Checkout Session object. Used directly
 * by the webhook (which already has the full session) and indirectly by
 * `confirmBookingBySessionId` from the success page.
 */
export async function confirmBookingFromSession(
  session: Stripe.Checkout.Session,
  admin: Admin = createAdminClient(),
): Promise<ConfirmOutcome> {
  const bookingId = Number(session.metadata?.booking_id ?? session.client_reference_id);
  if (!Number.isFinite(bookingId)) {
    console.warn('[confirm-booking] missing booking_id on session', session.id);
    return { ok: false, reason: 'no_booking_id' };
  }
  if (session.payment_status !== 'paid') {
    return { ok: false, reason: 'unpaid' };
  }

  const { data: booking, error: bErr } = await admin
    .from('bookings')
    .select('*, achiever:achiever_profiles!bookings_achiever_id_fkey(id, display_name)')
    .eq('id', bookingId)
    .maybeSingle();

  if (bErr || !booking) {
    console.error('[confirm-booking] booking not found', bookingId, bErr);
    return { ok: false, reason: 'not_found' };
  }

  if (
    booking.status === 'confirmed' ||
    booking.status === 'completed' ||
    booking.status === 'reviewed'
  ) {
    return { ok: true, status: 'already_confirmed', bookingId };
  }

  const meetingLink = (booking.meeting_link as string | null) ?? generateMeetingLink(bookingId);

  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  const { error: updErr } = await admin
    .from('bookings')
    .update({
      status: 'confirmed',
      payment_confirmed_at: new Date().toISOString(),
      meeting_link: meetingLink,
      stripe_payment_intent_id: paymentIntentId,
    })
    .eq('id', bookingId)
    // Only flip pending_payment → confirmed. If a parallel call (e.g. the
    // webhook running at the same time as the success page) has already
    // marked it confirmed, this update no-ops and we exit cleanly below.
    .eq('status', 'pending_payment');

  if (updErr) {
    console.error('[confirm-booking] failed to update booking', bookingId, updErr);
    return { ok: false, reason: 'not_found' };
  }

  // Re-read the row so we don't double-send emails when a race happened.
  const { data: confirmed } = await admin
    .from('bookings')
    .select('status')
    .eq('id', bookingId)
    .maybeSingle();

  if (!confirmed || confirmed.status !== 'confirmed') {
    // Some other process already confirmed (and presumably emailed).
    return { ok: true, status: 'already_confirmed', bookingId };
  }

  // Send confirmation emails. We deliberately don't block the response on
  // these — the bookings list will render either way.
  await sendBookingEmails({ booking, meetingLink, session, admin });

  return { ok: true, status: 'confirmed', bookingId };
}

async function sendBookingEmails(args: {
  booking: Record<string, unknown>;
  meetingLink: string;
  session: Stripe.Checkout.Session;
  admin: Admin;
}): Promise<void> {
  const { booking, meetingLink, session, admin } = args;
  const bookingId = Number(booking.id);

  const [{ data: applicantUser }, { data: mentorUser }] = await Promise.all([
    admin.auth.admin.getUserById(booking.applicant_id as string),
    admin.auth.admin.getUserById(booking.achiever_id as string),
  ]);

  const menteeEmail =
    applicantUser?.user?.email ?? session.customer_email ?? null;
  const menteeName =
    (applicantUser?.user?.user_metadata?.full_name as string | undefined) ??
    (menteeEmail ? menteeEmail.split('@')[0] : 'Mentee');
  const mentorEmail = mentorUser?.user?.email ?? null;
  const mentorName =
    (booking.achiever as { display_name?: string } | null)?.display_name ?? 'Your advisor';

  if (!menteeEmail || !mentorEmail) {
    console.warn('[confirm-booking] missing emails for booking', bookingId, {
      hasMentee: !!menteeEmail,
      hasMentor: !!mentorEmail,
    });
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

  await Promise.allSettled([
    sendMenteeConfirmation(ctx),
    sendMentorNotification(ctx),
  ]);
}
