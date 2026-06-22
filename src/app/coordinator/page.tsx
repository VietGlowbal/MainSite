import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { CoordinatorLinkStats } from '@/lib/types';
import { CopyLinkButton } from './copy-link-button';

// Always reflect the latest visit counts.
export const dynamic = 'force-dynamic';

type DayBucket = { date: string; visits: number; uniques: number };

async function baseUrl(): Promise<string> {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  const h = await headers();
  const host = h.get('host') ?? 'localhost:3000';
  const proto = host.startsWith('localhost') ? 'http' : 'https';
  return `${proto}://${host}`;
}

export default async function CoordinatorPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // Layout already gated this route; user is guaranteed here.
  const coordinatorId = user!.id;

  const admin = createAdminClient();

  // Headline stats per link (this coordinator may have one or more links).
  const { data: statRows } = await admin
    .from('coordinator_link_stats')
    .select('*')
    .eq('coordinator_id', coordinatorId);
  const stats = (statRows ?? []) as CoordinatorLinkStats[];
  const activeStats = stats.filter((s) => s.is_active);
  const primary = activeStats[0] ?? stats[0] ?? null;

  const totalVisits = stats.reduce((sum, s) => sum + Number(s.total_visits ?? 0), 0);
  const uniqueVisitors = stats.reduce((sum, s) => sum + Number(s.unique_visitors ?? 0), 0);
  const lastVisitAt = stats
    .map((s) => s.last_visit_at)
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1) ?? null;

  // Last 30 days of visits, bucketed by day (volume is small enough for JS).
  const since = new Date();
  since.setDate(since.getDate() - 29);
  since.setHours(0, 0, 0, 0);
  const { data: recent } = await admin
    .from('coordinator_visits')
    .select('visited_at, is_unique')
    .eq('coordinator_id', coordinatorId)
    .gte('visited_at', since.toISOString())
    .order('visited_at', { ascending: true });

  const buckets = new Map<string, DayBucket>();
  for (let i = 0; i < 30; i += 1) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, { date: key, visits: 0, uniques: 0 });
  }
  for (const v of recent ?? []) {
    const key = new Date(v.visited_at).toISOString().slice(0, 10);
    const b = buckets.get(key);
    if (!b) continue;
    b.visits += 1;
    if (v.is_unique) b.uniques += 1;
  }
  const series = [...buckets.values()];
  const maxVisits = Math.max(1, ...series.map((b) => b.visits));

  const shareUrl = primary ? `${await baseUrl()}/c/${primary.code}` : null;

  return (
    <div className="space-y-6">
      {/* Share link */}
      <section className="glow-card space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Your link</h2>
        {shareUrl ? (
          <div className="flex flex-wrap items-center gap-3">
            <code className="flex-1 break-all rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {shareUrl}
            </code>
            <CopyLinkButton url={shareUrl} />
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Your share link isn’t set up yet. Ask an admin to enable it from the
            Coordinators page.
          </p>
        )}
      </section>

      {/* Headline stats */}
      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total visits" value={totalVisits} tone="pink" />
        <StatCard label="Unique visitors" value={uniqueVisitors} tone="sky" />
        <StatCard
          label="Last visit"
          value={lastVisitAt ? new Date(lastVisitAt).toLocaleDateString() : '—'}
        />
      </section>

      {/* 30-day trend */}
      <section className="glow-card space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Last 30 days</h2>
        {totalVisits === 0 ? (
          <p className="text-sm text-slate-500">
            No visits yet. Share your link to start tracking traffic.
          </p>
        ) : (
          <div className="space-y-1.5">
            {series.map((b) => (
              <div key={b.date} className="flex items-center gap-3 text-xs">
                <span className="w-16 shrink-0 text-slate-400">{b.date.slice(5)}</span>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-pink-400"
                    style={{ width: `${(b.visits / maxVisits) * 100}%` }}
                  />
                </div>
                <span className="w-24 shrink-0 text-right text-slate-500">
                  {b.visits} visit{b.visits === 1 ? '' : 's'}
                  {b.uniques > 0 && (
                    <span className="text-slate-400"> · {b.uniques} new</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = 'slate',
}: {
  label: string;
  value: number | string;
  tone?: 'slate' | 'pink' | 'sky';
}) {
  const toneClass =
    tone === 'pink' ? 'text-pink-600' : tone === 'sky' ? 'text-sky-600' : 'text-slate-900';
  return (
    <div className="glow-card-tight">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
