import { createClient } from '@/lib/supabase/server';
import { AdminHeading } from '../_ui';
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
    <section className="flex flex-col gap-gb-3xl">
      <AdminHeading
        title="Bookings & payments"
        description="Confirm bank transfers, cancel stale bookings, and watch revenue."
      />
      <AdminBookingsClient bookings={bookings ?? []} />
    </section>
  );
}
