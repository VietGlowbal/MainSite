'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { GeoArticleStatus } from '@/lib/geo-cms';

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

function StatusBadge({ status }: { status: GeoArticleStatus }) {
  const styles: Record<GeoArticleStatus, string> = {
    draft: 'border-amber-200 bg-amber-50 text-amber-700',
    published: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    archived: 'border-slate-200 bg-slate-50 text-slate-500',
  };
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${styles[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
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
  const [error, setError] = useState<string | null>(null);

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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{items.length} article{items.length === 1 ? '' : 's'}</p>
        <Link href="/admin/news/new" className="glow-button-primary text-sm">
          New article
        </Link>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-10 text-center text-sm text-slate-400">
          No articles yet. Create your first one.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Title</th>
                <th className="px-4 py-3 font-semibold">Topic</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Updated</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((a) => (
                <tr key={a.id} className="align-top">
                  <td className="px-4 py-3">
                    <Link href={`/admin/news/${a.id}/edit`} className="font-semibold text-slate-900 hover:text-pink-600">
                      {a.title}
                    </Link>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                      <span>/{a.slug}</span>
                      {a.source === 'pipeline' ? (
                        <span className="rounded bg-cyan-50 px-1.5 py-0.5 font-medium text-cyan-700">Pipeline</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{a.topic}</td>
                  <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(a.updated_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Link
                        href={`/admin/news/${a.id}/edit`}
                        className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        Edit
                      </Link>
                      {a.status !== 'published' ? (
                        <button
                          disabled={busy === a.id}
                          onClick={() => patchStatus(a.id, 'published')}
                          className="rounded-lg border border-emerald-200 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                        >
                          Publish
                        </button>
                      ) : (
                        <button
                          disabled={busy === a.id}
                          onClick={() => patchStatus(a.id, 'draft')}
                          className="rounded-lg border border-amber-200 px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                        >
                          Unpublish
                        </button>
                      )}
                      <button
                        disabled={busy === a.id}
                        onClick={() => remove(a.id, a.title)}
                        className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
