import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { MentorAvailabilitySlot, MentorshipBooking } from '@/types/mentorship';
import { MentorDashboard } from '@/components/mentorship/MentorDashboard';

export default async function MentorDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/auth?redirect=/dashboard/mentor');
  }

  const { data: profile } = await supabase
    .from('achiever_profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) {
    redirect('/mentors/apply');
  }

  const { data: bookings } = await supabase
    .from('bookings')
    .select('*')
    .eq('achiever_id', user.id)
    .order('scheduled_at', { ascending: false });

  // eslint-disable-next-line react-hooks/purity -- dynamic server route; freshness is intentional.
  const recentSlotsCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: slots } = await supabase
    .from('mentor_availability_slots')
    .select('*')
    .eq('mentor_id', user.id)
    .gte('starts_at', recentSlotsCutoff)
    .order('starts_at', { ascending: true });

  return (
    <main className="min-h-screen bg-transparent px-4 py-10 md:px-8 md:py-16">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <span className="glow-pill">Mentor dashboard</span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            Welcome, {profile.display_name}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your sessions, pricing, and availability in one place.
          </p>
        </div>

        <MentorDashboard
          profile={profile}
          bookings={(bookings ?? []) as MentorshipBooking[]}
          initialSlots={(slots ?? []) as MentorAvailabilitySlot[]}
        />
      </div>
    </main>
  );
}
