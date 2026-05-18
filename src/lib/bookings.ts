import { createClient } from '@/lib/supabase/server';
import type {
  Booking,
  BookingWithParties,
  CreateBookingInput,
  CreateReviewInput,
} from '@/types/achievers';

// ── Create a booking ────────────────────────────────────────────────────────

export async function createBooking(
  input: CreateBookingInput,
): Promise<{ booking: Booking | null; error: string | null }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { booking: null, error: 'Not authenticated' };

  const glowbalFee = Math.round(input.session_price_vnd * 0.2);
  const achieverPayout = input.session_price_vnd - glowbalFee;

  // Generate payment reference
  const refSuffix = Math.floor(1000 + Math.random() * 9000);
  const paymentReference = `GLOW-${refSuffix}`;

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      applicant_id: user.id,
      achiever_id: input.achiever_id,
      user_university_id: input.user_university_id ?? null,
      scheduled_at: input.scheduled_at,
      duration_mins: input.duration_mins,
      session_price_vnd: input.session_price_vnd,
      glowbal_fee_vnd: glowbalFee,
      achiever_payout_vnd: achieverPayout,
      status: 'pending_payment',
      payment_reference: paymentReference,
      applicant_notes: input.applicant_notes,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating booking:', error);
    return { booking: null, error: error.message };
  }

  return { booking: data as Booking, error: null };
}

// ── Get student bookings ────────────────────────────────────────────────────

export async function getStudentBookings(userId: string): Promise<BookingWithParties[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *,
      achiever:achiever_profiles!bookings_achiever_id_fkey (
        id,
        display_name,
        avatar_url,
        university:universities!achiever_profiles_university_id_fkey (
          name
        )
      )
    `)
    .eq('applicant_id', userId)
    .order('scheduled_at', { ascending: false });

  if (error) {
    console.error('Error fetching student bookings:', error);
    return [];
  }

  return (data ?? []).map((row: Record<string, unknown>) => {
    const achiever = row.achiever as Record<string, unknown> | null;
    const uni = achiever?.university as Record<string, unknown> | null;
    return {
      ...row,
      achiever: {
        id: achiever?.id ?? '',
        display_name: achiever?.display_name ?? '',
        avatar_url: achiever?.avatar_url ?? null,
        university_name: uni?.name ?? null,
      },
      applicant: { id: userId, full_name: null, email: null },
    };
  }) as BookingWithParties[];
}

// ── Get achiever bookings ───────────────────────────────────────────────────

export async function getAchieverBookings(achieverId: string): Promise<BookingWithParties[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('achiever_id', achieverId)
    .order('scheduled_at', { ascending: false });

  if (error) {
    console.error('Error fetching achiever bookings:', error);
    return [];
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    ...row,
    achiever: {
      id: achieverId,
      display_name: '',
      avatar_url: null,
      university_name: null,
    },
    applicant: {
      id: row.applicant_id ?? '',
      full_name: null,
      email: null,
    },
  })) as BookingWithParties[];
}

// ── Update booking status ───────────────────────────────────────────────────

export async function updateBookingStatus(
  bookingId: number,
  status: string,
  extra?: { meeting_link?: string; cancellation_reason?: string; cancelled_by?: string },
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient();

  const updateData: Record<string, unknown> = { status };
  if (extra?.meeting_link) updateData.meeting_link = extra.meeting_link;
  if (extra?.cancellation_reason) updateData.cancellation_reason = extra.cancellation_reason;
  if (extra?.cancelled_by) updateData.cancelled_by = extra.cancelled_by;
  if (status === 'confirmed') updateData.payment_confirmed_at = new Date().toISOString();

  const { error } = await supabase
    .from('bookings')
    .update(updateData)
    .eq('id', bookingId);

  if (error) {
    console.error('Error updating booking:', error);
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

// ── Create a review ─────────────────────────────────────────────────────────

export async function createReview(
  input: CreateReviewInput,
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: 'Not authenticated' };

  // Get the booking to verify it's completed and belongs to this user
  const { data: booking } = await supabase
    .from('bookings')
    .select('achiever_id, applicant_id, status')
    .eq('id', input.booking_id)
    .single();

  if (!booking) return { success: false, error: 'Booking not found' };
  if (booking.applicant_id !== user.id) return { success: false, error: 'Not your booking' };
  if (booking.status !== 'completed') return { success: false, error: 'Booking not completed' };

  const { error } = await supabase.from('session_reviews').insert({
    booking_id: input.booking_id,
    reviewer_id: user.id,
    achiever_id: booking.achiever_id,
    rating: input.rating,
    comment: input.comment ?? null,
  });

  if (error) {
    console.error('Error creating review:', error);
    return { success: false, error: error.message };
  }

  // Update booking status to reviewed
  await supabase
    .from('bookings')
    .update({ status: 'reviewed' })
    .eq('id', input.booking_id);

  return { success: true, error: null };
}
