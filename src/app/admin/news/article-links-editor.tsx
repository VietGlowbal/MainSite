'use client';

import { useEffect, useState } from 'react';
import { Badge, Button, Panel, PanelHeader, Select } from '@/shared/ui';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';
import { Alert } from '../_ui';

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
  useLoadingIndicator(loading, 'Loading article links');
  const [saving, setSaving] = useState(false);
  useLoadingIndicator(saving, 'Saving article links');
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

  return (
    <Panel className="flex flex-col gap-gb-xl">
      <PanelHeader
        title="Linked articles (GEO graph)"
        description="Connect this article to others to power related rails, hubs, and AI-search structure."
        action={
          <Button variant="secondary" disabled={saving || loading} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save links'}
          </Button>
        }
      />

      {err ? <Alert tone="error">{err}</Alert> : null}
      {msg ? <Alert tone="success">{msg}</Alert> : null}

      {loading ? (
        <p className="text-gb-sm text-fg-muted">Loading…</p>
      ) : links.length === 0 ? (
        <p className="text-gb-sm text-fg-muted">No links yet.</p>
      ) : (
        <ul className="flex flex-col gap-gb-md">
          {links.map((l, i) => {
            const c = byId.get(l.to_article_id);
            return (
              <li
                key={`${l.to_article_id}-${l.relation}`}
                className="flex items-center justify-between gap-gb-lg rounded-gb-xl border border-line bg-surface-muted px-gb-xl py-gb-lg"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-gb-md">
                  <span className="truncate text-gb-sm text-fg">{c?.title ?? l.to_article_id}</span>
                  <Badge variant="info-chip">
                    {RELATIONS.find((r) => r.value === l.relation)?.label ?? l.relation}
                  </Badge>
                </div>
                <Button
                  variant="secondary-destructive"
                  onClick={() => remove(i)}
                  className="shrink-0"
                >
                  Remove
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-gb-md border-t border-line pt-gb-xl">
        <Select
          name="link-target"
          label="Article"
          placeholder="Pick an article…"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          fieldClassName="min-w-0 flex-1"
        >
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </Select>
        <Select
          name="link-relation"
          label="Relation"
          value={relation}
          onChange={(e) => setRelation(e.target.value as Relation)}
        >
          {RELATIONS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </Select>
        <Button size="lg" onClick={add} disabled={!target}>
          Add link
        </Button>
      </div>
    </Panel>
  );
}
