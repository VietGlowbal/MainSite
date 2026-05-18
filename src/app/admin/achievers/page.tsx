import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AdminAchieversClient } from './admin-achievers-client';

async function isAdmin(userId: string): Promise<boolean> {
  // Check env-based admin list first
  const adminIds = (process.env.ADMIN_USER_IDS ?? '').split(',').map((s) => s.trim());
  if (adminIds.includes(userId)) return true;

  // Check is_admin column on student_profiles
  const supabase = await createClient();
  const { data } = await supabase
    .from('student_profiles')
    .select('is_admin')
    .eq('user_id', userId)
    .maybeSingle();

  return data?.is_admin === true;
}

export default async function AdminAchieversPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth');
  if (!(await isAdmin(user.id))) redirect('/dashboard');

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
