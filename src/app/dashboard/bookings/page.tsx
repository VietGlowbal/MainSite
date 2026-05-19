import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppSidebar } from '@/components/layout/app-sidebar';
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
    <main className="min-h-screen bg-transparent px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
          <AppSidebar />

          <div className="space-y-6 min-w-0">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">My bookings</h1>
              <p className="mt-1 text-sm text-slate-500">
                Track your booked sessions with Achievers.
              </p>
            </div>

            <BookingsDashboardClient bookings={bookings ?? []} userId={user.id} />
          </div>
        </div>
      </div>
    </main>
  );
}
