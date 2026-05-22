import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/mentorship/review
 *
 * Lets the mentee leave a star rating + comment after a session. We only
 * allow it once the booking is in `completed` status. The DB triggers
 * (in supabase-global-station.sql) recompute the mentor's avg_rating and
 * total_sessions automatically.
 */

const ReviewSchema = z.object({
  booking_id: z.number().int().positive(),
  rating: z.number().int().min(0).max(5),
  comment: z.string().max(800).optional().nullable(),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = ReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });

  // Validate the booking belongs to the user, is completed, and isn't yet reviewed.
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, applicant_id, achiever_id, status')
    .eq('id', parsed.data.booking_id)
    .maybeSingle();
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  if (booking.applicant_id !== user.id) {
    return NextResponse.json({ error: 'Not your booking' }, { status: 403 });
  }
  if (booking.status !== 'completed') {
    return NextResponse.json(
      { error: 'You can only review completed sessions.' },
      { status: 400 },
    );
  }

  // Insert the review. The DB also has a unique constraint on booking_id
  // so a duplicate insert will fail cleanly.
  const { error: insertErr } = await supabase.from('session_reviews').insert({
    booking_id: parsed.data.booking_id,
    reviewer_id: user.id,
    achiever_id: booking.achiever_id,
    rating: parsed.data.rating,
    comment: parsed.data.comment ?? null,
  });
  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 400 });
  }

  // Flip booking → reviewed so the dashboard hides the "leave a review" CTA.
  await supabase
    .from('bookings')
    .update({ status: 'reviewed' })
    .eq('id', parsed.data.booking_id);

  return NextResponse.json({ ok: true });
}
