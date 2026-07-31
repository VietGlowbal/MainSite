'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { GeoArticleStatus } from '@/lib/geo-cms';
import { Badge, Button, ICONS, KitIcon, Panel, type BadgeVariant } from '@/shared/ui';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';
import { Alert, TableShell, TD, TH } from '../_ui';

type ArticleRow = {
  id: string;
  slug: string;
  title: string;
  topic: string;
  status: GeoArticleStatus;
  source: 'manual' | 'pipeline';
  updated_at: string;
  published_at: string | null;
};

/** Draft is brand for the same reason a pending mentor is: it wants a decision. */
const STATUS_VARIANT: Record<GeoArticleStatus, BadgeVariant> = {
  draft: 'brand-chip',
  published: 'safe-chip',
  archived: 'neutral-chip',
};

function StatusBadge({ status }: { status: GeoArticleStatus }) {
  return (
    <Badge variant={STATUS_VARIANT[status]}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

export function AdminNewsClient({ articles }: { articles: ArticleRow[] }) {
  const router = useRouter();
  const [items, setItems] = useState(articles);
  const [busy, setBusy] = useState<string | null>(null);
  useLoadingIndicator(busy !== null, 'Updating the article');
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function importFromFiles() {
    setImporting(true);
    setError(null);
    setNotice(null);
    const res = await fetch('/api/admin/news/import', { method: 'POST' });
    const data = await res.json().catch(() => null);
    setImporting(false);
    if (!res.ok || !data) {
      setError(data?.error ?? 'Import failed');
      return;
    }
    setNotice(`Imported ${data.total} file article(s): ${data.created} created, ${data.updated} updated, ${data.skipped} skipped.`);
    router.refresh();
  }

  async function patchStatus(id: string, status: GeoArticleStatus) {
    setBusy(id);
    setError(null);
    const res = await fetch(`/api/admin/news/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const { error: msg } = await res.json().catch(() => ({ error: 'Update failed' }));
      setError(msg ?? 'Update failed');
    } else {
      setItems((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
      router.refresh();
    }
    setBusy(null);
  }

  async function remove(id: string, title: string) {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setBusy(id);
    setError(null);
    const res = await fetch(`/api/admin/news/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const { error: msg } = await res.json().catch(() => ({ error: 'Delete failed' }));
      setError(msg ?? 'Delete failed');
    } else {
      setItems((prev) => prev.filter((a) => a.id !== id));
      router.refresh();
    }
    setBusy(null);
  }

  return (
    <div className="flex flex-col gap-gb-xl">
      <div className="flex flex-wrap items-center justify-between gap-gb-xl">
        <p className="text-gb-sm text-fg-tertiary">
          {items.length} article{items.length === 1 ? '' : 's'}
        </p>
        <div className="flex flex-wrap items-center gap-gb-md">
          <Button
            variant="secondary"
            size="lg"
            disabled={importing}
            onClick={() => void importFromFiles()}
            title="Import the legacy markdown guides (content/geo) into the database"
          >
            {importing ? 'Importing…' : 'Import from files'}
          </Button>
          <Button href="/admin/news/new" size="lg">
            <KitIcon art={ICONS.plus} frame={20} />
            New article
          </Button>
        </div>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      {items.length === 0 ? (
        <Panel className="text-center text-gb-sm text-fg-muted">
          No articles yet. Create your first one.
        </Panel>
      ) : (
        <TableShell>
          <thead className="border-b border-line bg-surface-muted">
            <tr>
              <th scope="col" className={TH}>Title</th>
              <th scope="col" className={TH}>Topic</th>
              <th scope="col" className={TH}>Status</th>
              <th scope="col" className={TH}>Updated</th>
              <th scope="col" className={`${TH} text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.map((a) => (
              <tr key={a.id}>
                <td className={TD}>
                  <div className="flex flex-col gap-gb-xxs">
                    <Link
                      href={`/admin/news/${a.id}/edit`}
                      className="font-semibold text-fg transition-colors hover:text-fg-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    >
                      {a.title}
                    </Link>
                    <div className="flex flex-wrap items-center gap-gb-md">
                      <span className="font-mono text-gb-xs text-fg-muted">/{a.slug}</span>
                      {a.source === 'pipeline' ? (
                        <Badge variant="info-chip">Pipeline</Badge>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td className={TD}>{a.topic}</td>
                <td className={TD}>
                  <StatusBadge status={a.status} />
                </td>
                <td className={`${TD} text-fg-muted`}>{formatDate(a.updated_at)}</td>
                <td className={TD}>
                  <div className="flex flex-wrap items-center justify-end gap-gb-md">
                    <Button href={`/admin/news/${a.id}/edit`} variant="secondary">
                      Edit
                    </Button>
                    {a.status !== 'published' ? (
                      <Button
                        variant="secondary"
                        disabled={busy === a.id}
                        onClick={() => void patchStatus(a.id, 'published')}
                      >
                        Publish
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        disabled={busy === a.id}
                        onClick={() => void patchStatus(a.id, 'draft')}
                      >
                        Unpublish
                      </Button>
                    )}
                    <Button
                      variant="secondary-destructive"
                      disabled={busy === a.id}
                      onClick={() => void remove(a.id, a.title)}
                    >
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}
    </div>
  );
}
