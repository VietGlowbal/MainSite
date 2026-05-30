import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// /dashboard is the legacy home for signed-in users.
// We now redirect to the application tracker which serves as the dashboard.
// /dashboard/bookings and /dashboard/achiever are still nested under here.
export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth?redirect=/apply');
  redirect('/apply');
}
