import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AvailabilityEditorClient } from './availability-editor';

export default async function AvailabilityPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth?redirect=/dashboard/achiever/availability');
  }

  // Check achiever profile exists
  const { data: achieverProfile } = await supabase
    .from('achiever_profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (!achieverProfile) {
    redirect('/achievers/apply');
  }

  // Get existing availability
  const { data: slots } = await supabase
    .from('achiever_availability')
    .select('*')
    .eq('achiever_id', user.id)
    .eq('is_active', true)
    .order('day_of_week')
    .order('start_time');

  return (
    <main className="min-h-screen bg-transparent px-6 py-16 md:px-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <div>
          <span className="glow-pill">Availability</span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
            Set your schedule
          </h1>
          <p className="mt-2 text-slate-500">
            Add your weekly time slots. Students will see these when booking.
          </p>
          <p className="mt-1 text-xs text-slate-400">
            All times are Vietnam time (UTC+7). Students will see them in their local time in a future update.
          </p>
        </div>

        <AvailabilityEditorClient
          achieverId={user.id}
          initialSlots={slots ?? []}
        />
      </div>
    </main>
  );
}
