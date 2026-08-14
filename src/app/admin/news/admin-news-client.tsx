'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { GeoArticleStatus } from '@/lib/geo-cms';
import { useLanguage } from '@/lib/i18n';
import { Badge, Button, ICONS, Input, KitIcon, Panel, Select, type BadgeVariant } from '@/shared/ui';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';
import { Alert, TableShell, TD, TH } from '../_ui';
import { useNewsCopy } from './news-copy';

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

const STATUS_VARIANT: Record<GeoArticleStatus, BadgeVariant> = {
  draft: 'brand-chip',
  published: 'safe-chip',
  archived: 'neutral-chip',
};

function StatusBadge({ status, label }: { status: GeoArticleStatus; label: string }) {
  return <Badge variant={STATUS_VARIANT[status]}>{label}</Badge>;
}

function formatDate(value: string | null, locale: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-GB', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

export function AdminNewsClient({ articles }: { articles: ArticleRow[] }) {
  const router = useRouter();
  const { lang } = useLanguage();
  const t = useNewsCopy();
  const [items, setItems] = useState(articles);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | GeoArticleStatus>('all');
  const [topicFilter, setTopicFilter] = useState('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  useLoadingIndicator(busy !== null || importing, t('Updating the article'));

  const topics = useMemo(() => [...new Set(items.map((article) => article.topic).filter(Boolean))].sort(), [items]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((article) => {
      const matchesQuery = !needle || `${article.title} ${article.slug} ${article.topic}`.toLowerCase().includes(needle);
      const matchesStatus = statusFilter === 'all' || article.status === statusFilter;
      const matchesTopic = topicFilter === 'all' || article.topic === topicFilter;
      return matchesQuery && matchesStatus && matchesTopic;
    });
  }, [items, query, statusFilter, topicFilter]);

  async function importFromFiles() {
    setImporting(true);
    setError(null);
    setNotice(null);
    const res = await fetch('/api/admin/news/import', { method: 'POST' });
    const data = await res.json().catch(() => null);
    setImporting(false);
    if (!res.ok || !data) {
      setError(data?.error ?? t('Import failed'));
      return;
    }
    setNotice(t('Imported {total} file article(s): {created} created, {updated} updated, {skipped} skipped.', data));
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
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.errors?.join(' · ') ?? data?.error ?? t('Update failed'));
    } else {
      setItems((prev) => prev.map((article) => (article.id === id ? { ...article, status } : article)));
      router.refresh();
    }
    setBusy(null);
  }

  async function remove(id: string, title: string) {
    if (!window.confirm(t('Delete “{title}”? This cannot be undone.', { title }))) return;
    setBusy(id);
    setError(null);
    const res = await fetch(`/api/admin/news/${id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => null);
    if (!res.ok) setError(data?.error ?? t('Delete failed'));
    else {
      setItems((prev) => prev.filter((article) => article.id !== id));
      router.refresh();
    }
    setBusy(null);
  }

  const statusLabel = (status: GeoArticleStatus) => t(status.charAt(0).toUpperCase() + status.slice(1));

  return (
    <div className="flex flex-col gap-gb-xl">
      <div className="flex flex-wrap items-center justify-between gap-gb-xl">
        <p className="text-gb-sm text-fg-tertiary">{t('{count} article(s)', { count: filtered.length })}</p>
        <div className="flex flex-wrap items-center gap-gb-md">
          <Button variant="secondary" size="lg" disabled={importing} onClick={() => void importFromFiles()} title={t('Import legacy articles')}>
            {importing ? t('Importing…') : t('Import from files')}
          </Button>
          <Button href="/admin/news/new" size="lg">
            <KitIcon art={ICONS.plus} frame={20} />
            {t('New article')}
          </Button>
        </div>
      </div>

      <Panel padding="sm" className="grid gap-gb-lg md:grid-cols-[minmax(0,1fr)_180px_220px]">
        <Input name="news-search" label={t('Search articles')} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('Search by title, topic, or URL')} />
        <Select name="news-status-filter" label={t('Status')} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | GeoArticleStatus)}>
          <option value="all">{t('All statuses')}</option>
          <option value="draft">{t('Draft')}</option>
          <option value="published">{t('Published')}</option>
          <option value="archived">{t('Archived')}</option>
        </Select>
        <Select name="news-topic-filter" label={t('Topic')} value={topicFilter} onChange={(event) => setTopicFilter(event.target.value)}>
          <option value="all">{t('All topics')}</option>
          {topics.map((topic) => <option key={topic} value={topic}>{t(topic)}</option>)}
        </Select>
      </Panel>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      {filtered.length === 0 ? (
        <Panel className="text-center text-gb-sm text-fg-muted">
          {items.length === 0 ? t('No articles yet. Create your first one.') : t('No articles match these filters.')}
        </Panel>
      ) : (
        <>
          <div className="hidden md:block">
            <TableShell>
              <thead className="border-b border-line bg-surface-muted">
                <tr>
                  <th scope="col" className={TH}>{t('Title')}</th>
                  <th scope="col" className={TH}>{t('Topic')}</th>
                  <th scope="col" className={TH}>{t('Status')}</th>
                  <th scope="col" className={TH}>{t('Updated')}</th>
                  <th scope="col" className={`${TH} text-right`}>{t('Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((article) => (
                  <tr key={article.id}>
                    <td className={TD}>
                      <div className="flex flex-col gap-gb-xxs">
                        <Link href={`/admin/news/${article.id}/edit`} className="font-semibold text-fg transition-colors hover:text-fg-brand focus-visible:outline-2 focus-visible:outline-brand">{article.title}</Link>
                        <span className="font-mono text-gb-xs text-fg-muted">/{article.slug}</span>
                      </div>
                    </td>
                    <td className={TD}>{t(article.topic)}</td>
                    <td className={TD}><StatusBadge status={article.status} label={statusLabel(article.status)} /></td>
                    <td className={`${TD} text-fg-muted`}>{formatDate(article.updated_at, lang)}</td>
                    <td className={TD}><Actions article={article} busy={busy === article.id} t={t} onPatch={patchStatus} onRemove={remove} /></td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          </div>
          <div className="grid gap-gb-lg md:hidden">
            {filtered.map((article) => (
              <Panel key={article.id} padding="sm" className="flex flex-col gap-gb-lg">
                <div className="flex items-start justify-between gap-gb-lg">
                  <div className="min-w-0"><Link href={`/admin/news/${article.id}/edit`} className="font-semibold text-fg hover:text-fg-brand">{article.title}</Link><p className="mt-gb-xs truncate font-mono text-gb-xs text-fg-muted">/{article.slug}</p></div>
                  <StatusBadge status={article.status} label={statusLabel(article.status)} />
                </div>
                <div className="flex items-center justify-between text-gb-sm text-fg-tertiary"><span>{t(article.topic)}</span><span>{formatDate(article.updated_at, lang)}</span></div>
                <Actions article={article} busy={busy === article.id} t={t} onPatch={patchStatus} onRemove={remove} />
              </Panel>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Actions({ article, busy, t, onPatch, onRemove }: { article: ArticleRow; busy: boolean; t: (value: string, vars?: Record<string, string | number>) => string; onPatch: (id: string, status: GeoArticleStatus) => void; onRemove: (id: string, title: string) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-gb-md">
      <Button href={`/admin/news/${article.id}/edit`} variant="secondary">{t('Edit')}</Button>
      {article.status !== 'published' ? <Button variant="secondary" disabled={busy} onClick={() => void onPatch(article.id, 'published')}>{t('Publish')}</Button> : <Button variant="secondary" disabled={busy} onClick={() => void onPatch(article.id, 'draft')}>{t('Unpublish')}</Button>}
      <Button variant="secondary-destructive" disabled={busy} onClick={() => void onRemove(article.id, article.title)}>{t('Delete')}</Button>
    </div>
  );
}
