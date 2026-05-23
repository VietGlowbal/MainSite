import { createClient } from '@/lib/supabase/server';
import { AdminBookingsClient } from './admin-bookings-client';

/**
 * Bookings & payments console. The /admin layout already verifies the
 * caller is an admin and renders the page header + tabs.
 */
export default async function AdminBookingsPage() {
  const supabase = await createClient();

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
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          Bookings & payments
        </h2>
        <p className="text-sm text-slate-500">
          Confirm bank transfers, cancel stale bookings, and watch revenue.
        </p>
      </div>
      <AdminBookingsClient bookings={bookings ?? []} />
    </section>
  );
}
