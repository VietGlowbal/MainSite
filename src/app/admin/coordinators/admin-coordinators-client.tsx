'use client';

import { useEffect, useMemo, useState } from 'react';

type Ambassador = {
  coordinator_id: string;
  link_id: string;
  code: string;
  ambassador_name: string;
  is_active: boolean;
  coordinator_name: string | null;
  coordinator_email: string | null;
  total_visits: number;
  unique_visitors: number;
  referred_users: number;
  last_visit_at: string | null;
};

type AdminUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  is_coordinator: boolean;
};

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; ambassadors: Ambassador[]; users: AdminUser[] }
  | { kind: 'error'; message: string };

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

export function AdminCoordinatorsClient() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  async function load() {
    setState({ kind: 'loading' });
    try {
      const [ambRes, usersRes] = await Promise.all([
        fetch('/api/admin/coordinators', { cache: 'no-store' }),
        fetch('/api/admin/users', { cache: 'no-store' }),
      ]);
      if (!ambRes.ok) {
        const body = (await ambRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed (${ambRes.status})`);
      }
      const ambBody = (await ambRes.json()) as { ambassadors: Ambassador[] };
      const usersBody = usersRes.ok
        ? ((await usersRes.json()) as { users: AdminUser[] })
        : { users: [] };
      setState({ kind: 'ready', ambassadors: ambBody.ambassadors, users: usersBody.users });
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Failed to load.',
      });
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function setCoordinator(userId: string, next: boolean) {
    setBusy(userId);
    setError(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, is_coordinator: next }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update.');
    } finally {
      setBusy(null);
    }
  }

  async function copyLink(code: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/c/${code}`);
      setCopied(code);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      // Clipboard unavailable — ignore.
    }
  }

  const coordinators = useMemo(
    () => (state.kind === 'ready' ? state.users.filter((u) => u.is_coordinator) : []),
    [state],
  );

  const assignable = useMemo(() => {
    if (state.kind !== 'ready') return [];
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return state.users
      .filter((u) => !u.is_coordinator)
      .filter(
        (u) =>
          (u.email?.toLowerCase().includes(q) ?? false) ||
          (u.full_name?.toLowerCase().includes(q) ?? false) ||
          u.id.toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [state, query]);

  if (state.kind === 'loading') {
    return <p className="text-sm text-slate-400">Loading…</p>;
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

  const activeAmbassadors = state.ambassadors.filter((a) => a.is_active);
  const totalVisits = state.ambassadors.reduce((s, a) => s + a.total_visits, 0);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Coordinators" value={coordinators.length} tone="pink" />
        <SummaryCard label="Active ambassadors" value={activeAmbassadors.length} tone="sky" />
        <SummaryCard label="Total visits driven" value={totalVisits} />
      </div>

      {/* Coordinator role management */}
      <div className="glow-card-tight space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-700">Coordinators</p>
          {coordinators.length === 0 ? (
            <p className="text-xs text-slate-400">No coordinators yet.</p>
          ) : (
            <div className="space-y-1">
              {coordinators.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-900">
                      {u.full_name ?? '—'}
                    </div>
                    <div className="truncate text-xs text-slate-500">{u.email ?? u.id}</div>
                  </div>
                  <button
                    type="button"
                    disabled={busy === u.id}
                    onClick={() => void setCoordinator(u.id, false)}
                    className="shrink-0 rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2 border-t border-slate-100 pt-3">
          <p className="text-sm font-semibold text-slate-700">Make someone a coordinator</p>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a user by name, email, or ID"
            className="glow-input w-full max-w-md text-sm"
          />
          {query.trim() && (
            <div className="space-y-1">
              {assignable.length === 0 ? (
                <p className="text-xs text-slate-400">No matching non-coordinator users.</p>
              ) : (
                assignable.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-900">
                        {u.full_name ?? '—'}
                      </div>
                      <div className="truncate text-xs text-slate-500">{u.email ?? u.id}</div>
                    </div>
                    <button
                      type="button"
                      disabled={busy === u.id}
                      onClick={() => void setCoordinator(u.id, true)}
                      className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:border-pink-300 hover:text-pink-600 disabled:opacity-50"
                    >
                      Make coordinator
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Ambassadors oversight (read-only) */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-slate-700">All ambassadors</p>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white/90">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="px-4 py-3">Ambassador</th>
                <th className="px-4 py-3">Coordinator</th>
                <th className="px-4 py-3">Link</th>
                <th className="px-4 py-3 text-right">Visits</th>
                <th className="px-4 py-3 text-right">Unique</th>
                <th className="px-4 py-3 text-right">Referred</th>
                <th className="px-4 py-3">Last visit</th>
                <th className="px-4 py-3 text-right">Link</th>
              </tr>
            </thead>
            <tbody>
              {state.ambassadors.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-400">
                    No ambassadors yet.
                  </td>
                </tr>
              ) : (
                state.ambassadors.map((a) => (
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
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {a.coordinator_name ?? a.coordinator_email ?? a.coordinator_id}
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs text-slate-600">/c/{a.code}</code>
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
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void copyLink(a.code)}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:border-sky-300 hover:text-sky-600"
                      >
                        {copied === a.code ? 'Copied!' : 'Copy'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone = 'slate',
}: {
  label: string;
  value: number;
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
