'use client';

import { useEffect, useMemo, useState } from 'react';

type Ambassador = {
  link_id: string;
  coordinator_id: string;
  code: string;
  ambassador_name: string;
  is_active: boolean;
  total_visits: number;
  unique_visitors: number;
  referred_users: number;
  last_visit_at: string | null;
};

type DashboardSummary = {
  signups_by_day: { day: string; count: number }[];
};

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; ambassadors: Ambassador[]; summary: DashboardSummary }
  | { kind: 'error'; message: string };

const EMPTY_SUMMARY: DashboardSummary = { signups_by_day: [] };

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

export function AmbassadorsClient() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  async function load() {
    setState({ kind: 'loading' });
    try {
      const res = await fetch('/api/coordinator/ambassadors', { cache: 'no-store' });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      const body = (await res.json()) as { ambassadors: Ambassador[]; summary?: DashboardSummary };
      setState({ kind: 'ready', ambassadors: body.ambassadors, summary: body.summary ?? EMPTY_SUMMARY });
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Failed to load ambassadors.',
      });
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createAmbassador(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/coordinator/ambassadors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ambassador_name: trimmed }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      setName('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create.');
    } finally {
      setCreating(false);
    }
  }

  async function setActive(linkId: string, next: boolean) {
    setBusy(linkId);
    setError(null);
    try {
      const res = await fetch('/api/coordinator/ambassadors', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: linkId, is_active: next }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      if (state.kind === 'ready') {
        setState({
          kind: 'ready',
          summary: state.summary,
          ambassadors: state.ambassadors.map((a) =>
            a.link_id === linkId ? { ...a, is_active: next } : a,
          ),
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update.');
    } finally {
      setBusy(null);
    }
  }

  async function copyLink(code: string) {
    try {
      await navigator.clipboard.writeText(`${origin}/c/${code}`);
      setCopied(code);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      // Clipboard unavailable — ignore.
    }
  }

  const totals = useMemo(() => {
    if (state.kind !== 'ready') return { active: 0, visits: 0, uniques: 0, referred: 0 };
    return state.ambassadors.reduce(
      (acc, a) => ({
        active: acc.active + (a.is_active ? 1 : 0),
        visits: acc.visits + a.total_visits,
        uniques: acc.uniques + a.unique_visitors,
        referred: acc.referred + a.referred_users,
      }),
      { active: 0, visits: 0, uniques: 0, referred: 0 },
    );
  }, [state]);

  // Last-30-days sign-up series (zero-filled), built from the daily summary.
  // Day keys are bucketed in Vietnam time to match the coordinator_referral_daily
  // view (Asia/Ho_Chi_Minh). VN has no DST, so stepping 24h yields consecutive
  // VN calendar days. en-CA formats as YYYY-MM-DD.
  const signupChart = useMemo(() => {
    const byDay = new Map<string, number>();
    if (state.kind === 'ready') {
      for (const r of state.summary.signups_by_day) byDay.set(r.day.slice(0, 10), r.count);
    }
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    const series: { date: string; count: number }[] = [];
    const now = Date.now();
    for (let i = 29; i >= 0; i -= 1) {
      const key = fmt.format(new Date(now - i * 86_400_000));
      series.push({ date: key, count: byDay.get(key) ?? 0 });
    }
    return { series, max: Math.max(1, ...series.map((s) => s.count)) };
  }, [state]);

  if (state.kind === 'loading') {
    return <p className="text-sm text-slate-400">Loading ambassadors…</p>;
  }
  if (state.kind === 'error') {
    return (
      <div className="glow-card-tight space-y-2">
        <p className="text-sm text-red-600">{state.message}</p>
        <button
          type="button"
          className="glow-button-secondary text-xs px-4 py-2"
          onClick={() => void load()}
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active ambassadors" value={totals.active} tone="pink" />
        <StatCard label="Total visits" value={totals.visits} tone="sky" />
        <StatCard label="Unique visitors" value={totals.uniques} />
        <StatCard label="Total sign-ups through links" value={totals.referred} tone="emerald" />
      </div>

      {/* Add ambassador */}
      <form onSubmit={createAmbassador} className="glow-card-tight space-y-3">
        <p className="text-sm font-semibold text-slate-700">Add an ambassador</p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ambassador name (e.g. Nguyễn An)"
            maxLength={120}
            className="glow-input min-w-0 flex-1 text-sm"
          />
          <button
            type="submit"
            disabled={creating || !name.trim()}
            className="glow-button-primary shrink-0 text-sm px-5 py-2 disabled:opacity-50"
          >
            {creating ? 'Creating…' : 'Create link'}
          </button>
        </div>
        <p className="text-xs text-slate-400">
          A unique <code>/c/&lt;code&gt;</code> link is generated for each ambassador to share.
        </p>
      </form>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Ambassadors table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white/90">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="px-4 py-3">Ambassador</th>
              <th className="px-4 py-3">Link</th>
              <th className="px-4 py-3 text-right">Visits</th>
              <th className="px-4 py-3 text-right">Unique</th>
              <th className="px-4 py-3 text-right">Referred</th>
              <th className="px-4 py-3">Last visit</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {state.ambassadors.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">
                  No ambassadors yet. Add one above to get a shareable link.
                </td>
              </tr>
            ) : (
              state.ambassadors.map((a) => {
                const isBusy = busy === a.link_id;
                return (
                  <tr
                    key={a.link_id}
                    className={`border-b border-slate-100 last:border-0 ${
                      a.is_active ? '' : 'opacity-50'
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {a.ambassador_name}
                      {!a.is_active && (
                        <span className="ml-2 text-[0.65rem] uppercase text-slate-400">paused</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs text-slate-600">{origin}/c/{a.code}</code>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {a.total_visits}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">{a.unique_visitors}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                      {a.referred_users}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {formatDate(a.last_visit_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => void copyLink(a.code)}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:border-sky-300 hover:text-sky-600"
                        >
                          {copied === a.code ? 'Copied!' : 'Copy link'}
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void setActive(a.link_id, !a.is_active)}
                          className={`rounded-full border bg-white px-3 py-1 text-xs font-semibold disabled:opacity-50 ${
                            a.is_active
                              ? 'border-red-200 text-red-600 hover:bg-red-50'
                              : 'border-slate-200 text-slate-700 hover:border-pink-300 hover:text-pink-600'
                          }`}
                        >
                          {a.is_active ? 'Pause' : 'Resume'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Sign-ups by day */}
      <section className="glow-card space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Sign-ups by day (last 30 days)</h2>
        {totals.referred === 0 ? (
          <p className="text-sm text-slate-500">No sign-ups through your links yet.</p>
        ) : (
          <div className="space-y-1.5">
            {signupChart.series.map((b) => (
              <div key={b.date} className="flex items-center gap-3 text-xs">
                <span className="w-16 shrink-0 text-slate-400">{b.date.slice(5)}</span>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-400"
                    style={{ width: `${(b.count / signupChart.max) * 100}%` }}
                  />
                </div>
                <span className="w-20 shrink-0 text-right text-slate-500">
                  {b.count} sign-up{b.count === 1 ? '' : 's'}
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
  value: number;
  tone?: 'slate' | 'pink' | 'sky' | 'emerald';
}) {
  const toneClass =
    tone === 'pink'
      ? 'text-pink-600'
      : tone === 'sky'
        ? 'text-sky-600'
        : tone === 'emerald'
          ? 'text-emerald-600'
          : 'text-slate-900';
  return (
    <div className="glow-card-tight">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
