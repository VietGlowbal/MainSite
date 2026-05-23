import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Admin overview — quick counts + shortcuts. The layout already verified
 * the caller is an admin, so this page just reads aggregate data via the
 * service role client to bypass row-level security.
 */
export default async function AdminOverviewPage() {
  const admin = createAdminClient();

  const [
    pendingMentors,
    approvedMentors,
    pendingPayments,
    confirmedBookings,
    completedBookings,
  ] = await Promise.all([
    admin.from('achiever_profiles').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    admin.from('achiever_profiles').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
    admin.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'pending_payment'),
    admin.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'confirmed'),
    admin.from('bookings').select('id', { count: 'exact', head: true }).in('status', ['completed', 'reviewed']),
  ]);

  const cards = [
    {
      label: 'Mentor applications waiting',
      value: pendingMentors.count ?? 0,
      href: '/admin/achievers',
      tone: 'amber' as const,
    },
    {
      label: 'Approved mentors',
      value: approvedMentors.count ?? 0,
      href: '/admin/achievers',
      tone: 'emerald' as const,
    },
    {
      label: 'Bookings awaiting payment',
      value: pendingPayments.count ?? 0,
      href: '/admin/bookings',
      tone: 'amber' as const,
    },
    {
      label: 'Confirmed sessions',
      value: confirmedBookings.count ?? 0,
      href: '/admin/bookings',
      tone: 'sky' as const,
    },
    {
      label: 'Completed sessions',
      value: completedBookings.count ?? 0,
      href: '/admin/bookings',
      tone: 'purple' as const,
    },
  ];

  const toneClasses: Record<typeof cards[number]['tone'], string> = {
    amber: 'text-amber-600',
    emerald: 'text-emerald-600',
    sky: 'text-sky-600',
    purple: 'text-purple-600',
  };

  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={`${card.label}-${card.href}`}
            href={card.href}
            className="glow-card-tight transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(22,33,62,0.08)]"
          >
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className={`mt-2 text-3xl font-semibold ${toneClasses[card.tone]}`}>
              {card.value}
            </p>
          </Link>
        ))}
      </section>

      <section className="glow-card space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Quick actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/achievers" className="glow-button-primary text-sm">
            Review mentor applications
          </Link>
          <Link href="/admin/bookings" className="glow-button-secondary text-sm">
            Confirm payments
          </Link>
          <Link href="/admin/users" className="glow-button-secondary text-sm">
            Manage users
          </Link>
        </div>
      </section>
    </div>
  );
}
