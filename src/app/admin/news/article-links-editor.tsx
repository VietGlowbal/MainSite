'use client';

import { useEffect, useState } from 'react';

type Candidate = { id: string; title: string; slug: string };
type Relation = 'related' | 'cluster' | 'prerequisite' | 'next' | 'cites';
type Link = { to_article_id: string; relation: Relation; weight: number };

const RELATIONS: { value: Relation; label: string }[] = [
  { value: 'related', label: 'Related' },
  { value: 'cluster', label: 'Same hub/cluster' },
  { value: 'next', label: 'Next read' },
  { value: 'prerequisite', label: 'Prerequisite' },
  { value: 'cites', label: 'Cites as source' },
];

/**
 * Edits an article's outgoing GEO graph edges (geo_article_links). Loads the
 * current edges, lets an admin add/remove links to other articles with a
 * relation type, and PUTs the full set.
 */
export function ArticleLinksEditor({ articleId, candidates }: { articleId: string; candidates: Candidate[] }) {
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [target, setTarget] = useState('');
  const [relation, setRelation] = useState<Relation>('related');

  useEffect(() => {
    let active = true;
    fetch(`/api/admin/news/${articleId}/links`)
      .then((r) => r.json())
      .then((d) => {
        if (active && Array.isArray(d.links)) setLinks(d.links);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [articleId]);

  const byId = new Map(candidates.map((c) => [c.id, c]));

  function add() {
    if (!target) return;
    if (links.some((l) => l.to_article_id === target && l.relation === relation)) return;
    setLinks((prev) => [...prev, { to_article_id: target, relation, weight: 0 }]);
    setTarget('');
    setMsg(null);
  }

  function remove(index: number) {
    setLinks((prev) => prev.filter((_, i) => i !== index));
    setMsg(null);
  }

  async function save() {
    setSaving(true);
    setErr(null);
    setMsg(null);
    const res = await fetch(`/api/admin/news/${articleId}/links`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ links }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => null);
      setErr(d?.error ?? 'Save failed');
      return;
    }
    setMsg('Links saved');
  }

  const selectClass =
    'rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-pink-300 focus:ring-2 focus:ring-pink-100';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Linked articles (GEO graph)</h3>
          <p className="text-xs text-slate-500">
            Connect this article to others to power related rails, hubs, and AI-search structure.
          </p>
        </div>
        <button
          type="button"
          disabled={saving || loading}
          onClick={save}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save links'}
        </button>
      </div>

      {err ? <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">{err}</p> : null}
      {msg ? <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700">{msg}</p> : null}

      <div className="mt-4 space-y-2">
        {loading ? (
          <p className="text-xs text-slate-400">Loading…</p>
        ) : links.length === 0 ? (
          <p className="text-xs text-slate-400">No links yet.</p>
        ) : (
          links.map((l, i) => {
            const c = byId.get(l.to_article_id);
            return (
              <div key={`${l.to_article_id}-${l.relation}`} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                <div className="min-w-0">
                  <span className="text-sm text-slate-800">{c?.title ?? l.to_article_id}</span>
                  <span className="ml-2 rounded bg-white px-1.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-slate-500">
                    {RELATIONS.find((r) => r.value === l.relation)?.label ?? l.relation}
                  </span>
                </div>
                <button type="button" onClick={() => remove(i)} className="text-xs font-semibold text-red-500 hover:text-red-700">
                  Remove
                </button>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select className={`${selectClass} min-w-0 flex-1`} value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="">Pick an article…</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
        <select className={selectClass} value={relation} onChange={(e) => setRelation(e.target.value as Relation)}>
          {RELATIONS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={add}
          disabled={!target}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </div>
  );
}
