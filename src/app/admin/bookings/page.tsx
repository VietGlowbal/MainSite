import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isPaymentAdmin } from '@/lib/auth-helpers';
import { loadAdminBookingPaymentItems } from '@/server/payments/admin-bookings';
import { AdminHeading } from '../_ui';
import { AdminBookingsClient } from './admin-bookings-client';

export const dynamic = 'force-dynamic';

/**
 * Bookings & payments console.
 *
 * Restricted strictly to the founder / authorized payment admin.
 * Unifies all payment transactions (Plus plans & Mentorship) alongside
 * manual review states and booking records.
 */
export default async function AdminBookingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth?redirect=/admin/bookings');
  }

  const canManage = await isPaymentAdmin(user.id, user.email);
  if (!canManage) {
    redirect('/admin');
  }

  const items = await loadAdminBookingPaymentItems();

  return (
    <section className="flex flex-col gap-gb-3xl">
      <AdminHeading
        title="Bookings & payments"
        description="Review bank transfers, confirm transactions, and track platform revenue."
      />
      <AdminBookingsClient initialItems={items} />
    </section>
  );
}
