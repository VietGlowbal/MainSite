'use client';

import { useEffect, useMemo, useState } from 'react';

type AdminUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  is_admin: boolean;
  onboarding_completed: boolean;
  mentor_status: string | null;
  mentor_name: string | null;
};

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; users: AdminUser[] }
  | { kind: 'error'; message: string };

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

export function AdminUsersClient() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'admins' | 'mentors'>('all');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setState({ kind: 'loading' });
    try {
      const res = await fetch('/api/admin/users', { cache: 'no-store' });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      const body = (await res.json()) as { users: AdminUser[] };
      setState({ kind: 'ready', users: body.users });
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Failed to load users.',
      });
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function setAdmin(userId: string, nextIsAdmin: boolean) {
    setBusy(userId);
    setError(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, is_admin: nextIsAdmin }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      if (state.kind === 'ready') {
        setState({
          kind: 'ready',
          users: state.users.map((u) =>
            u.id === userId ? { ...u, is_admin: nextIsAdmin } : u,
          ),
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update.');
    } finally {
      setBusy(null);
    }
  }

  async function kickUser(user: AdminUser) {
    const label = user.email ?? user.full_name ?? user.id;
    const confirmed = window.confirm(
      `Remove ${label}? This deletes their account and all associated data. This cannot be undone.`,
    );
    if (!confirmed) return;

    setBusy(user.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users?id=${encodeURIComponent(user.id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      if (state.kind === 'ready') {
        setState({
          kind: 'ready',
          users: state.users.filter((u) => u.id !== user.id),
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove.');
    } finally {
      setBusy(null);
    }
  }

  const filtered = useMemo(() => {
    if (state.kind !== 'ready') return [];
    const q = query.trim().toLowerCase();
    return state.users.filter((u) => {
      if (filter === 'admins' && !u.is_admin) return false;
      if (filter === 'mentors' && !u.mentor_status) return false;
      if (!q) return true;
      return (
        (u.email?.toLowerCase().includes(q) ?? false) ||
        (u.full_name?.toLowerCase().includes(q) ?? false) ||
        (u.mentor_name?.toLowerCase().includes(q) ?? false) ||
        u.id.toLowerCase().includes(q)
      );
    });
  }, [state, filter, query]);

  if (state.kind === 'loading') {
    return <p className="text-sm text-slate-400">Loading users…</p>;
  }
  if (state.kind === 'error') {
    return (
      <div className="glow-card-tight space-y-2">
        <p className="text-sm text-red-600">{state.message}</p>
        <button type="button" className="glow-button-secondary text-xs px-4 py-2" onClick={() => void load()}>
          Try again
        </button>
      </div>
    );
  }

  const total = state.users.length;
  const adminCount = state.users.filter((u) => u.is_admin).length;
  const mentorCount = state.users.filter((u) => u.mentor_status).length;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Total users" value={total} />
        <SummaryCard label="Admins" value={adminCount} tone="pink" />
        <SummaryCard label="Mentor profiles" value={mentorCount} tone="sky" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(['all', 'admins', 'mentors'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                filter === key
                  ? 'border-pink-300 bg-pink-50 text-pink-600'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              {key === 'all' ? 'All' : key === 'admins' ? 'Admins' : 'Mentors'}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, email, or ID"
          className="glow-input max-w-xs text-sm"
        />
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white/90">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Roles</th>
              <th className="px-4 py-3">Onboarded</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3">Last sign-in</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
                  No users match.
                </td>
              </tr>
            ) : (
              filtered.map((u) => {
                const isBusy = busy === u.id;
                return (
                  <tr key={u.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">
                        {u.full_name ?? u.mentor_name ?? '—'}
                      </div>
                      <div className="text-xs text-slate-500">{u.email ?? '(no email)'}</div>
                      <div className="font-mono text-[0.65rem] text-slate-400">{u.id}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.is_admin && <Badge tone="pink">Admin</Badge>}
                        {u.mentor_status && (
                          <Badge tone={u.mentor_status === 'approved' ? 'emerald' : 'amber'}>
                            Mentor · {u.mentor_status}
                          </Badge>
                        )}
                        {!u.is_admin && !u.mentor_status && (
                          <span className="text-xs text-slate-400">Student</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {u.onboarding_completed ? (
                        <span className="text-emerald-600">Yes</span>
                      ) : (
                        <span className="text-slate-400">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDate(u.created_at)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {formatDate(u.last_sign_in_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void setAdmin(u.id, !u.is_admin)}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:border-pink-300 hover:text-pink-600 disabled:opacity-50"
                        >
                          {u.is_admin ? 'Remove admin' : 'Make admin'}
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void kickUser(u)}
                          className="rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          Kick
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

function Badge({ children, tone }: { children: React.ReactNode; tone: 'pink' | 'emerald' | 'amber' }) {
  const styles: Record<typeof tone, string> = {
    pink: 'border-pink-200 bg-pink-50 text-pink-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
  };
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${styles[tone]}`}>
      {children}
    </span>
  );
}
