import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AdminBookingsClient } from './admin-bookings-client';

async function isAdmin(userId: string): Promise<boolean> {
  const adminIds = (process.env.ADMIN_USER_IDS ?? '').split(',').map((s) => s.trim());
  if (adminIds.includes(userId)) return true;

  const supabase = await createClient();
  const { data } = await supabase
    .from('student_profiles')
    .select('is_admin')
    .eq('user_id', userId)
    .maybeSingle();

  return data?.is_admin === true;
}

export default async function AdminBookingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth');
  if (!(await isAdmin(user.id))) redirect('/dashboard');

  // Get all bookings with related data
  const { data: bookings } = await supabase
    .from('bookings')
    .select(`
      *,
      achiever:achiever_profiles!bookings_achiever_id_fkey (
        display_name
      )
    `)
    .order('created_at', { ascending: false });

  return (
    <main className="min-h-screen bg-transparent px-6 py-16 md:px-10">
      <div className="mx-auto max-w-5xl space-y-8">
        <div>
          <span className="glow-pill">Admin</span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
            Bookings & Payments
          </h1>
        </div>

        <AdminBookingsClient bookings={bookings ?? []} />
      </div>
    </main>
  );
}
