import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AchieverDashboardClient } from './achiever-dashboard-client';

export default async function AchieverDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth?redirect=/dashboard/achiever');
  }

  // Check achiever profile exists
  const { data: achieverProfile } = await supabase
    .from('achiever_profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (!achieverProfile) {
    redirect('/achievers/apply');
  }

  // Get bookings for this achiever
  const { data: bookings } = await supabase
    .from('bookings')
    .select('*')
    .eq('achiever_id', user.id)
    .order('scheduled_at', { ascending: false });

  return (
    <main className="min-h-screen bg-transparent px-6 py-16 md:px-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <div>
          <span className="glow-pill">Achiever Dashboard</span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
            Welcome, {achieverProfile.display_name}
          </h1>
        </div>

        {/* Status banner */}
        {achieverProfile.status === 'pending' && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
            <strong>Profile under review.</strong> We will notify you when your profile is approved.
          </div>
        )}
        {achieverProfile.status === 'suspended' && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
            <strong>Profile suspended.</strong> Please contact support for more information.
          </div>
        )}

        <AchieverDashboardClient
          profile={achieverProfile}
          bookings={bookings ?? []}
        />
      </div>
    </main>
  );
}
