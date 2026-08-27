'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Pagination,
  Panel,
  StatTile,
  controlClasses,
} from '@/shared/ui';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';
import { Alert, EmptyRow, TableShell, TD, TH } from '../_ui';

const USERS_PER_PAGE = 10;

type AdminUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  is_admin: boolean;
  is_coordinator: boolean;
  onboarding_completed: boolean;
  mentor_status: string | null;
  mentor_name: string | null;
  login_count: number;
  has_plus_access: boolean;
  plus_expires_at: string | null;
};

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; users: AdminUser[] }
  | { kind: 'error'; message: string };

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'admins', label: 'Admins' },
  { key: 'mentors', label: 'Advisors' },
  { key: 'plus', label: 'Plus access' },
] as const;

type Filter = (typeof FILTERS)[number]['key'];

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export function AdminUsersClient() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [busy, setBusy] = useState<string | null>(null);
  useLoadingIndicator(busy !== null, 'Updating the user');
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  async function fetchState(): Promise<Extract<LoadState, { kind: 'ready' }>> {
      const res = await fetch('/api/admin/users', { cache: 'no-store' });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      const body = (await res.json()) as { users: AdminUser[] };
      return { kind: 'ready', users: body.users };
  }

  async function load() {
    setState({ kind: 'loading' });
    try {
      setState(await fetchState());
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Failed to load users.',
      });
    }
  }

  useEffect(() => {
    let active = true;
    void fetchState().then(
      (next) => active && setState(next),
      (err: unknown) =>
        active &&
        setState({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Failed to load users.',
        }),
    );
    return () => {
      active = false;
    };
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

  async function setPlusAccess(userId: string, nextHasAccess: boolean) {
    setBusy(userId);
    setError(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, plus_access: nextHasAccess }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      if (state.kind === 'ready') {
        setState({
          kind: 'ready',
          users: state.users.map((u) =>
            u.id === userId ? { ...u, has_plus_access: nextHasAccess } : u,
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
      if (filter === 'plus' && !u.has_plus_access) return false;
      if (!q) return true;
      return (
        (u.email?.toLowerCase().includes(q) ?? false) ||
        (u.full_name?.toLowerCase().includes(q) ?? false) ||
        (u.mentor_name?.toLowerCase().includes(q) ?? false) ||
        u.id.toLowerCase().includes(q)
      );
    });
  }, [state, filter, query]);

  // Drop back to page 1 whenever the result set changes (filter/search), using
  // React's "adjust state during render" pattern so there's no extra commit.
  const resultKey = `${filter}|${query}`;
  const [prevResultKey, setPrevResultKey] = useState(resultKey);
  if (resultKey !== prevResultKey) {
    setPrevResultKey(resultKey);
    setPage(1);
  }

  const pageCount = Math.max(1, Math.ceil(filtered.length / USERS_PER_PAGE));
  const currentPage = Math.min(page, pageCount); // clamp if the list shrank
  const paged = filtered.slice(
    (currentPage - 1) * USERS_PER_PAGE,
    currentPage * USERS_PER_PAGE,
  );

  if (state.kind === 'loading') {
    return <Panel className="text-gb-sm text-fg-muted">Loading users…</Panel>;
  }
  if (state.kind === 'error') {
    return (
      <Panel className="flex flex-col items-start gap-gb-xl">
        <Alert tone="error">{state.message}</Alert>
        <Button variant="secondary" size="lg" onClick={() => void load()}>
          Try again
        </Button>
      </Panel>
    );
  }

  const total = state.users.length;
  const adminCount = state.users.filter((u) => u.is_admin).length;
  const mentorCount = state.users.filter((u) => u.mentor_status).length;
  const plusCount = state.users.filter((u) => u.has_plus_access).length;

  return (
    <div className="flex flex-col gap-gb-3xl">
      <div className="grid gap-gb-xl sm:grid-cols-4">
        <StatTile label="Total users" value={total} />
        <StatTile label="Admins" value={adminCount} tone="brand" />
        <StatTile label="Advisor profiles" value={mentorCount} tone="info" />
        <StatTile label="Plus access" value={plusCount} tone="safe" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-gb-xl">
        <div className="flex flex-wrap gap-gb-md" role="group" aria-label="Filter users">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={`rounded-gb-full border px-gb-xl py-gb-md text-gb-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                filter === key
                  ? 'border-brand bg-brand-subtle text-fg-brand'
                  : 'border-line-strong bg-surface text-fg-secondary hover:bg-surface-hover'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, email, or ID"
          aria-label="Search users"
          className={controlClasses(false, 'max-w-gb-width-sm')}
        />
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <TableShell>
        <thead className="border-b border-line bg-surface-muted">
          <tr>
            <th scope="col" className={TH}>User</th>
            <th scope="col" className={TH}>Roles</th>
            <th scope="col" className={TH}>Onboarded</th>
            <th scope="col" className={TH}>Joined</th>
            <th scope="col" className={TH}>Last sign-in</th>
            <th scope="col" className={`${TH} text-right`}>Logins</th>
            <th scope="col" className={`${TH} text-right`}>Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {filtered.length === 0 ? (
            <EmptyRow colSpan={7}>No users match.</EmptyRow>
          ) : (
            paged.map((u) => {
              const isBusy = busy === u.id;
              return (
                <tr key={u.id}>
                  <td className={TD}>
                    <div className="flex flex-col gap-gb-xxs">
                      <span className="font-medium text-fg">
                        {u.full_name ?? u.mentor_name ?? '—'}
                      </span>
                      <span className="text-gb-xs text-fg-tertiary">
                        {u.email ?? '(no email)'}
                      </span>
                      <span className="font-mono text-gb-xs text-fg-muted">{u.id}</span>
                    </div>
                  </td>
                  <td className={TD}>
                    <div className="flex flex-wrap gap-gb-xs">
                      {u.is_admin && <Badge variant="brand-chip">Admin</Badge>}
                      {u.is_coordinator && <Badge variant="info-chip">Coordinator</Badge>}
                      {u.mentor_status && (
                        <Badge
                          variant={u.mentor_status === 'approved' ? 'safe-chip' : 'neutral-chip'}
                        >
                          Advisor · {u.mentor_status}
                        </Badge>
                      )}
                      {u.has_plus_access && <Badge variant="safe-chip">Plus</Badge>}
                      {!u.is_admin && !u.is_coordinator && !u.mentor_status && !u.has_plus_access && (
                        <span className="text-gb-xs text-fg-muted">Student</span>
                      )}
                    </div>
                  </td>
                  <td className={TD}>
                    {u.onboarding_completed ? (
                      <Badge variant="safe-chip">Yes</Badge>
                    ) : (
                      <Badge variant="neutral-chip">No</Badge>
                    )}
                  </td>
                  <td className={`${TD} text-fg-muted`}>{formatDate(u.created_at)}</td>
                  <td className={`${TD} text-fg-muted`}>{formatDate(u.last_sign_in_at)}</td>
                  <td className={`${TD} text-right font-semibold text-fg`}>{u.login_count}</td>
                  <td className={TD}>
                    <div className="flex justify-end gap-gb-md">
                      <Button
                        variant="secondary"
                        disabled={isBusy}
                        onClick={() => void setAdmin(u.id, !u.is_admin)}
                      >
                        {u.is_admin ? 'Remove admin' : 'Make admin'}
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={isBusy}
                        onClick={() => void setPlusAccess(u.id, !u.has_plus_access)}
                      >
                        {u.has_plus_access ? 'Revoke Plus' : 'Grant Plus'}
                      </Button>
                      {/*
                        Deletion is permanent and there is no undo, so it does
                        not get a `primary` button — `secondary-destructive` is
                        secondary geometry in the error ramp, which reads as
                        "deliberate" rather than as the obvious next step.
                      */}
                      <Button
                        variant="secondary-destructive"
                        disabled={isBusy}
                        onClick={() => void kickUser(u)}
                      >
                        Kick
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </TableShell>

      {filtered.length > 0 && (
        <div className="flex flex-col items-center gap-gb-md">
          <Pagination page={currentPage} totalPages={pageCount} onPageChange={setPage} />
          <p className="text-gb-xs text-fg-muted">
            Showing {(currentPage - 1) * USERS_PER_PAGE + 1}–
            {Math.min(currentPage * USERS_PER_PAGE, filtered.length)} of {filtered.length}
          </p>
        </div>
      )}
    </div>
  );
}
