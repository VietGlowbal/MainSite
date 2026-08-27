'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Panel, PanelHeader, StatTile, controlClasses } from '@/shared/ui';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';
import { Alert, EmptyRow, TableShell, TD, TH } from '../_ui';

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
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

/** One row in the two person lists — the same shape granting and revoking. */
function PersonRow({
  name,
  detail,
  action,
}: {
  name: string;
  detail: string;
  action: React.ReactNode;
}) {
  return (
    <li className="flex items-center justify-between gap-gb-lg rounded-gb-xl border border-line bg-surface px-gb-xl py-gb-lg">
      <div className="flex min-w-0 flex-col gap-gb-xxs">
        <span className="truncate text-gb-sm font-medium text-fg">{name}</span>
        <span className="truncate text-gb-xs text-fg-tertiary">{detail}</span>
      </div>
      <div className="shrink-0">{action}</div>
    </li>
  );
}

export function AdminCoordinatorsClient() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [busy, setBusy] = useState<string | null>(null);
  useLoadingIndicator(busy !== null, 'Updating the coordinator');
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  async function fetchState(): Promise<Extract<LoadState, { kind: 'ready' }>> {
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
      return { kind: 'ready', ambassadors: ambBody.ambassadors, users: usersBody.users };
  }

  async function load() {
    setState({ kind: 'loading' });
    try {
      setState(await fetchState());
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Failed to load.',
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
          message: err instanceof Error ? err.message : 'Failed to load.',
        }),
    );
    return () => {
      active = false;
    };
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
    return <Panel className="text-gb-sm text-fg-muted">Loading…</Panel>;
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

  const activeAmbassadors = state.ambassadors.filter((a) => a.is_active);
  const totalVisits = state.ambassadors.reduce((s, a) => s + a.total_visits, 0);

  return (
    <div className="flex flex-col gap-gb-3xl">
      <div className="grid gap-gb-xl sm:grid-cols-3">
        <StatTile label="Coordinators" value={coordinators.length} tone="brand" />
        <StatTile label="Active ambassadors" value={activeAmbassadors.length} tone="info" />
        <StatTile label="Total visits driven" value={totalVisits} />
      </div>

      <Panel className="flex flex-col gap-gb-3xl">
        <div className="flex flex-col gap-gb-xl">
          <PanelHeader title="Coordinators" description="People who can create ambassador links." />
          {coordinators.length === 0 ? (
            <p className="text-gb-sm text-fg-muted">No coordinators yet.</p>
          ) : (
            <ul className="flex flex-col gap-gb-md">
              {coordinators.map((u) => (
                <PersonRow
                  key={u.id}
                  name={u.full_name ?? '—'}
                  detail={u.email ?? u.id}
                  action={
                    <Button
                      variant="secondary-destructive"
                      disabled={busy === u.id}
                      onClick={() => void setCoordinator(u.id, false)}
                    >
                      Revoke
                    </Button>
                  }
                />
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-gb-xl border-t border-line pt-gb-3xl">
          <PanelHeader
            title="Make someone a coordinator"
            description="Search the whole user base. Only non-coordinators are listed."
            as="h3"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a user by name, email, or ID"
            aria-label="Search users to make coordinator"
            className={controlClasses(false, 'max-w-gb-width-sm')}
          />
          {query.trim() && (
            <>
              {assignable.length === 0 ? (
                <p className="text-gb-sm text-fg-muted">No matching non-coordinator users.</p>
              ) : (
                <ul className="flex flex-col gap-gb-md">
                  {assignable.map((u) => (
                    <PersonRow
                      key={u.id}
                      name={u.full_name ?? '—'}
                      detail={u.email ?? u.id}
                      action={
                        <Button
                          variant="secondary"
                          disabled={busy === u.id}
                          onClick={() => void setCoordinator(u.id, true)}
                        >
                          Make coordinator
                        </Button>
                      }
                    />
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </Panel>

      {error && <Alert tone="error">{error}</Alert>}

      <section className="flex flex-col gap-gb-xl">
        <h3 className="text-gb-lg font-semibold text-fg">All ambassadors</h3>
        <TableShell>
          <thead className="border-b border-line bg-surface-muted">
            <tr>
              <th scope="col" className={TH}>Ambassador</th>
              <th scope="col" className={TH}>Coordinator</th>
              <th scope="col" className={TH}>Link</th>
              <th scope="col" className={`${TH} text-right`}>Visits</th>
              <th scope="col" className={`${TH} text-right`}>Unique</th>
              <th scope="col" className={`${TH} text-right`}>Referred</th>
              <th scope="col" className={TH}>Last visit</th>
              <th scope="col" className={`${TH} text-right`}>Copy</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {state.ambassadors.length === 0 ? (
              <EmptyRow colSpan={8}>No ambassadors yet.</EmptyRow>
            ) : (
              state.ambassadors.map((a) => (
                <tr key={a.link_id} className={a.is_active ? undefined : 'opacity-60'}>
                  <td className={TD}>
                    <div className="flex flex-wrap items-center gap-gb-md">
                      <span className="font-medium text-fg">{a.ambassador_name}</span>
                      {a.is_active ? null : <Badge variant="neutral-chip">Paused</Badge>}
                    </div>
                  </td>
                  <td className={`${TD} text-fg-muted`}>
                    {a.coordinator_name ?? a.coordinator_email ?? a.coordinator_id}
                  </td>
                  <td className={TD}>
                    <code className="font-mono text-gb-xs text-fg-secondary">/c/{a.code}</code>
                  </td>
                  <td className={`${TD} text-right font-semibold text-fg`}>{a.total_visits}</td>
                  <td className={`${TD} text-right`}>{a.unique_visitors}</td>
                  {/* Green means "this link brought someone in". A green zero
                      says the opposite of what the colour says — same rule
                      StatTile applies to its own numbers. */}
                  <td
                    className={`${TD} text-right font-semibold ${
                      a.referred_users > 0 ? 'text-on-tier-safe' : 'text-fg-muted'
                    }`}
                  >
                    {a.referred_users}
                  </td>
                  <td className={`${TD} text-fg-muted`}>{formatDate(a.last_visit_at)}</td>
                  <td className={TD}>
                    <div className="flex justify-end">
                      <Button variant="secondary" onClick={() => void copyLink(a.code)}>
                        {copied === a.code ? 'Copied' : 'Copy link'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </TableShell>
      </section>
    </div>
  );
}
