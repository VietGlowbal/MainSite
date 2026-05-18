import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { BookingsDashboardClient } from './bookings-client';

export default async function BookingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth?redirect=/dashboard/bookings');
  }

  const { data: bookings } = await supabase
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
    .eq('applicant_id', user.id)
    .order('scheduled_at', { ascending: false });

  return (
    <main className="min-h-screen bg-transparent px-6 py-16 md:px-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <div>
          <span className="glow-pill">My Bookings</span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
            Your sessions
          </h1>
          <p className="mt-2 text-slate-500">
            Track your booked sessions with Achievers.
          </p>
        </div>

        <BookingsDashboardClient bookings={bookings ?? []} userId={user.id} />
      </div>
    </main>
  );
}
