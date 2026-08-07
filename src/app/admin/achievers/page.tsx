import { createClient } from '@/lib/supabase/server';
import { AdminHeading } from '../_ui';
import { AdminAchieversClient } from './admin-achievers-client';

/**
 * Mentor application review. The /admin layout already verifies the
 * caller is an admin and renders the page header + tabs.
 */
export default async function AdminAchieversPage() {
  const supabase = await createClient();

  const { data: applications } = await supabase
    .from('achiever_profiles')
    .select(`
      *,
      university:universities!achiever_profiles_university_id_fkey (
        id,
        name,
        country
      )
    `)
    .in('status', ['pending', 'approved', 'rejected'])
    .order('created_at', { ascending: false });

  return (
    <section className="flex flex-col gap-gb-3xl">
      <AdminHeading
        title="Advisor applications"
        description="Approve or reject incoming advisor signups."
      />
      <AdminAchieversClient applications={applications ?? []} />
    </section>
  );
}
