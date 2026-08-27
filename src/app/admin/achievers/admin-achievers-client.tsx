'use client';

import { useState } from 'react';
import type { AchieverStatus } from '@/types/achievers';
import { Badge, Button, ICONS, KitIcon, Panel, type BadgeVariant } from '@/shared/ui';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';

type Application = {
  id: string;
  display_name: string;
  subject: string;
  degree_level: string;
  bio: string | null;
  help_topics: string[];
  languages: string[];
  session_price_vnd: number;
  session_duration_mins: number;
  status: AchieverStatus;
  created_at: string;
  quick_signup?: boolean | null;
  university: { id: number; name: string; country: string } | null;
};

/**
 * Status onto the chip set in shared/ui/badge.tsx.
 *
 * `pending` is brand, not a fourth colour: rose is the console's "this is
 * waiting on you" signal, and the whole point of this page is the pending
 * queue. Rejected and suspended are both grey — a rejected application and a
 * suspended mentor are equally out of the directory, and giving suspension its
 * own red implies an urgency that no control here can act on.
 */
const STATUS_VARIANT: Record<AchieverStatus, BadgeVariant> = {
  pending: 'brand-chip',
  approved: 'safe-chip',
  suspended: 'neutral-chip',
  rejected: 'neutral-chip',
};

function StatusBadge({ status }: { status: AchieverStatus }) {
  return (
    <Badge variant={STATUS_VARIANT[status]}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export function AdminAchieversClient({ applications }: { applications: Application[] }) {
  const [items, setItems] = useState(applications);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useLoadingIndicator(updating !== null, 'Updating the application');
  const [expanded, setExpanded] = useState<string | null>(null);

  async function updateStatus(id: string, status: 'approved' | 'rejected') {
    setUpdating(id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/achievers/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; application?: { status?: AchieverStatus } }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Could not update the advisor application.');
      }

      const savedStatus = payload?.application?.status;
      if (savedStatus !== 'approved' && savedStatus !== 'rejected') {
        throw new Error('The server returned an invalid application status.');
      }
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: savedStatus } : item)),
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Could not update the advisor application.',
      );
    } finally {
      setUpdating(null);
    }
  }

  const pending = items.filter((a) => a.status === 'pending');
  const others = items.filter((a) => a.status !== 'pending');

  return (
    <div className="flex flex-col gap-gb-4xl">
      {error ? (
        <div role="alert">
          <Panel className="border-danger text-gb-sm text-danger">{error}</Panel>
        </div>
      ) : null}

      <section className="flex flex-col gap-gb-xl">
        <h3 className="text-gb-lg font-semibold text-fg">Pending ({pending.length})</h3>

        {pending.length === 0 ? (
          <Panel className="text-center text-gb-sm text-fg-muted">
            No pending applications. Nothing is waiting on you here.
          </Panel>
        ) : (
          pending.map((app) => {
            const open = expanded === app.id;
            return (
              <Panel key={app.id} className="flex flex-col gap-gb-xl">
                <div className="flex flex-wrap items-start justify-between gap-gb-xl">
                  <div className="flex min-w-0 flex-col gap-gb-xxs">
                    <p className="text-gb-md font-semibold text-fg">{app.display_name}</p>
                    <p className="text-gb-sm text-fg-tertiary">
                      {app.university?.name ?? 'No university on file'} · {app.subject} ·{' '}
                      {app.degree_level}
                    </p>
                    <p className="text-gb-xs text-fg-muted">Applied {formatDate(app.created_at)}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-gb-md">
                    <StatusBadge status={app.status} />
                    {app.quick_signup ? (
                      <Badge variant="info-chip">Fast-track · no documents</Badge>
                    ) : null}
                  </div>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : app.id)}
                    aria-expanded={open}
                    aria-controls={`application-${app.id}`}
                    className="inline-flex items-center gap-gb-xs rounded-gb-sm text-gb-sm font-semibold text-fg-brand transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  >
                    {open ? 'Hide details' : 'View application'}
                    <KitIcon
                      art={ICONS.chevronDown}
                      frame={16}
                      className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
                    />
                  </button>
                </div>

                {open ? (
                  <dl
                    id={`application-${app.id}`}
                    className="grid gap-gb-xl rounded-gb-xl border border-line bg-surface-muted p-gb-2xl sm:grid-cols-2"
                  >
                    {app.bio ? (
                      <div className="flex flex-col gap-gb-xxs sm:col-span-2">
                        <dt className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">
                          Bio
                        </dt>
                        <dd className="text-gb-sm text-fg-secondary">{app.bio}</dd>
                      </div>
                    ) : null}
                    <div className="flex flex-col gap-gb-xxs">
                      <dt className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">
                        Topics
                      </dt>
                      <dd className="text-gb-sm text-fg-secondary">{app.help_topics.join(', ')}</dd>
                    </div>
                    <div className="flex flex-col gap-gb-xxs">
                      <dt className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">
                        Languages
                      </dt>
                      <dd className="text-gb-sm text-fg-secondary">{app.languages.join(', ')}</dd>
                    </div>
                    <div className="flex flex-col gap-gb-xxs">
                      <dt className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">
                        Price
                      </dt>
                      <dd className="text-gb-sm text-fg-secondary">
                        {new Intl.NumberFormat('vi-VN').format(app.session_price_vnd)} ₫ /{' '}
                        {app.session_duration_mins} min
                      </dd>
                    </div>
                  </dl>
                ) : null}

                <div className="flex flex-wrap gap-gb-lg border-t border-line pt-gb-xl">
                  <Button
                    onClick={() => void updateStatus(app.id, 'approved')}
                    disabled={updating !== null}
                    size="lg"
                  >
                    Approve
                  </Button>
                  <Button
                    onClick={() => void updateStatus(app.id, 'rejected')}
                    disabled={updating !== null}
                    variant="secondary"
                    size="lg"
                  >
                    Reject
                  </Button>
                </div>
              </Panel>
            );
          })
        )}
      </section>

      {others.length > 0 && (
        <section className="flex flex-col gap-gb-xl">
          <h3 className="text-gb-lg font-semibold text-fg">Processed</h3>
          <div className="flex flex-col gap-gb-lg">
            {others.map((app) => (
              <Panel
                key={app.id}
                padding="sm"
                className="flex flex-wrap items-center justify-between gap-gb-lg"
              >
                <div className="flex min-w-0 flex-col gap-gb-xxs">
                  <p className="text-gb-sm font-semibold text-fg">{app.display_name}</p>
                  <p className="text-gb-xs text-fg-muted">
                    {app.university?.name ?? 'No university on file'} · {app.subject}
                  </p>
                </div>
                <StatusBadge status={app.status} />
              </Panel>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
