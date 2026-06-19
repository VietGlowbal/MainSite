import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { BookingsDashboardClient } from './bookings-client';
import { confirmBookingBySessionId } from '@/lib/mentorship/confirm-booking';

type Props = {
  searchParams: Promise<{
    status?: string;
    session_id?: string;
    booking?: string;
  }>;
};

export default async function BookingsPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth?redirect=/dashboard/bookings');
  }

  // Fallback path for when Stripe redirects here after a successful payment
  // but the webhook hasn't (or can't) fire — confirm the booking and trigger
  // the mentor + mentee emails. Idempotent: re-running with the same
  // session id is a no-op once the booking is already 'confirmed'.
  let justConfirmed = false;
  if (params.status === 'success' && params.session_id) {
    const result = await confirmBookingBySessionId(params.session_id);
    if (result.ok && result.status === 'confirmed') {
      justConfirmed = true;
    }
  }

  const { data: bookings } = await supabase
    .from('bookings')
    .select(
      `
      *,
      achiever:achiever_profiles!bookings_achiever_id_fkey (
        id,
        display_name,
        avatar_url,
        university:universities!achiever_profiles_university_id_fkey (
          name
        )
      )
    `,
    )
    .eq('applicant_id', user.id)
    .order('scheduled_at', { ascending: false });

  const highlightedBookingId = params.booking ? Number(params.booking) : null;

  return (
    <main className="min-h-screen bg-transparent px-4 py-6 md:px-8 md:py-8">
      <div className="w-full">
        <div className="flex gap-6">
          <AppSidebar />

          <div className="flex-1 space-y-6 min-w-0">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">My bookings</h1>
              <p className="mt-1 text-sm text-slate-500">
                Track your booked sessions with Achievers.
              </p>
            </div>

            <BookingsDashboardClient
              bookings={bookings ?? []}
              userId={user.id}
              showSuccessBanner={params.status === 'success'}
              justConfirmed={justConfirmed}
              highlightedBookingId={highlightedBookingId}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
