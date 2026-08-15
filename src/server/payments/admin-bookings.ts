import { createAdminClient } from '@/server/db/admin';

export async function loadAdminBookingsData() {
  const admin = createAdminClient();
  const [transactions, reviews, bookings] = await Promise.all([
    admin.from('payment_transactions').select('*').order('created_at', { ascending: false }),
    admin.from('manual_payment_reviews').select('*'),
    admin
      .from('bookings')
      .select(`
        *,
        achiever:achiever_profiles!bookings_achiever_id_fkey (
          display_name
        )
      `)
      .order('created_at', { ascending: false }),
  ]);

  return {
    transactions: transactions.data ?? [],
    reviews: reviews.data ?? [],
    bookings: bookings.data ?? [],
  };
}
