import { createClient } from '@/lib/supabase/server';
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
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          Mentor applications
        </h2>
        <p className="text-sm text-slate-500">
          Approve or reject incoming mentor signups.
        </p>
      </div>
      <AdminAchieversClient applications={applications ?? []} />
    </section>
  );
}
