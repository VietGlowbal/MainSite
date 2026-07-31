import { createAdminClient } from '@/lib/supabase/admin';
import { Button, Panel, PanelHeader, StatTile, type StatTone } from '@/shared/ui';
import { AdminHeading } from './_ui';

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

  /*
   * `tone` is the queue's meaning, not a palette. Brand marks the two counts
   * that are work waiting on an admin; safe marks work already banked; info
   * marks something in flight. The five hand-picked hues this replaces (amber,
   * emerald, sky, purple) coloured every tile, which told a reader nothing
   * about which one to look at first.
   */
  const cards: { label: string; value: number; href: string; hint: string; tone: StatTone }[] = [
    {
      label: 'Mentor applications waiting',
      value: pendingMentors.count ?? 0,
      href: '/admin/achievers',
      hint: 'Needs a decision',
      tone: 'brand',
    },
    {
      label: 'Bookings awaiting payment',
      value: pendingPayments.count ?? 0,
      href: '/admin/bookings',
      hint: 'Needs a transfer confirmed',
      tone: 'brand',
    },
    {
      label: 'Confirmed sessions',
      value: confirmedBookings.count ?? 0,
      href: '/admin/bookings',
      hint: 'Paid, not yet held',
      tone: 'info',
    },
    {
      label: 'Approved mentors',
      value: approvedMentors.count ?? 0,
      href: '/admin/achievers',
      hint: 'Live on the directory',
      tone: 'safe',
    },
    {
      label: 'Completed sessions',
      value: completedBookings.count ?? 0,
      href: '/admin/bookings',
      hint: 'Held or reviewed',
      tone: 'safe',
    },
  ];

  return (
    <div className="flex flex-col gap-gb-4xl">
      <section className="flex flex-col gap-gb-xl">
        <AdminHeading
          title="Overview"
          description="Anything in rose is waiting on you."
        />
        <div className="grid gap-gb-xl sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <StatTile
              key={`${card.label}-${card.href}`}
              label={card.label}
              value={card.value}
              hint={card.hint}
              href={card.href}
              tone={card.tone}
            />
          ))}
        </div>
      </section>

      <Panel className="flex flex-col gap-gb-xl">
        <PanelHeader title="Quick actions" />
        <div className="flex flex-wrap gap-gb-lg">
          <Button href="/admin/achievers" size="lg">
            Review mentor applications
          </Button>
          <Button href="/admin/bookings" variant="secondary" size="lg">
            Confirm payments
          </Button>
          <Button href="/admin/users" variant="secondary" size="lg">
            Manage users
          </Button>
          <Button href="/admin/news" variant="secondary" size="lg">
            Write an article
          </Button>
        </div>
      </Panel>
    </div>
  );
}
