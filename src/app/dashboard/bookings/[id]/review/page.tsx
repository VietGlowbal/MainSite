import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ReviewFormClient } from './review-form';

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ReviewPage({ params }: Props) {
  const { id } = await params;
  const bookingId = Number(id);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth');

  // Get the booking
  const { data: booking } = await supabase
    .from('bookings')
    .select(`
      *,
      achiever:achiever_profiles!bookings_achiever_id_fkey (
        display_name,
        university:universities!achiever_profiles_university_id_fkey (
          name
        )
      )
    `)
    .eq('id', bookingId)
    .eq('applicant_id', user.id)
    .eq('status', 'completed')
    .maybeSingle();

  if (!booking) {
    redirect('/dashboard/bookings');
  }

  // Check if already reviewed
  const { data: existingReview } = await supabase
    .from('session_reviews')
    .select('id')
    .eq('booking_id', bookingId)
    .maybeSingle();

  if (existingReview) {
    redirect('/dashboard/bookings');
  }

  return (
    <main className="min-h-screen bg-transparent px-6 py-16 md:px-10">
      <div className="mx-auto max-w-lg space-y-8">
        <div className="text-center">
          <span className="glow-pill">Review</span>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
            How was your session?
          </h1>
          <p className="mt-2 text-slate-500">
            with {booking.achiever?.display_name ?? 'your Achiever'}
          </p>
        </div>

        <ReviewFormClient
          bookingId={bookingId}
          achieverId={booking.achiever_id}
          userId={user.id}
        />
      </div>
    </main>
  );
}
