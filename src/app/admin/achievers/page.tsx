import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/auth-helpers';
import { AdminAchieversClient } from './admin-achievers-client';

export default async function AdminAchieversPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth');
  if (!(await isAdmin(user.id))) redirect('/my-universities');

  // Get pending achiever applications
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
    <main className="min-h-screen bg-transparent px-6 py-16 md:px-10">
      <div className="mx-auto max-w-5xl space-y-8">
        <div>
          <span className="glow-pill">Admin</span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
            Achiever Applications
          </h1>
        </div>

        <AdminAchieversClient applications={applications ?? []} />
      </div>
    </main>
  );
}
