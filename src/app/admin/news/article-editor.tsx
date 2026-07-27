'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { GeoArticle, GeoArticleStatus } from '@/lib/geo-cms';
import { ArticleLinksEditor } from './article-links-editor';
import { useLoadingIndicator } from '@/shared/ui';

const TOPICS = [
  'All topics',
  'Universities',
  'Applications',
  'Scholarships',
  'Visas & immigration',
  'Student life',
  'Careers',
];

type EditorProps = {
  /** Existing article when editing; undefined when creating. */
  article?: GeoArticle;
  /** Other articles available as link targets (edit mode only). */
  candidates?: Array<{ id: string; title: string; slug: string }>;
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 80);
}

export function ArticleEditor({ article, candidates = [] }: EditorProps) {
  const router = useRouter();
  const isEdit = Boolean(article);

  const [title, setTitle] = useState(article?.title ?? '');
  const [slug, setSlug] = useState(article?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [topic, setTopic] = useState(article?.topic ?? 'All topics');
  const [status, setStatus] = useState<GeoArticleStatus>(article?.status ?? 'draft');
  const [description, setDescription] = useState(article?.description ?? '');
  const [excerpt, setExcerpt] = useState(article?.excerpt ?? '');
  const [keyTakeaway, setKeyTakeaway] = useState(article?.key_takeaway ?? '');
  const [heroImage, setHeroImage] = useState(article?.hero_image ?? '');
  const [tags, setTags] = useState((article?.tags ?? []).join(', '));
  const [body, setBody] = useState(article?.body ?? '');
  const [metaText, setMetaText] = useState(
    article?.meta && Object.keys(article.meta).length ? JSON.stringify(article.meta, null, 2) : '',
  );
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [saving, setSaving] = useState(false);
  useLoadingIndicator(saving, 'Saving the article');
  const [error, setError] = useState<string | null>(null);

  const effectiveSlug = slugTouched ? slug : slugify(title);
  const readingMinutes = useMemo(
    () => Math.max(4, Math.round(body.split(/\s+/).filter(Boolean).length / 180)),
    [body],
  );

  async function save(nextStatus?: GeoArticleStatus) {
    setError(null);

    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    let meta: Record<string, unknown> | undefined;
    if (metaText.trim()) {
      try {
        meta = JSON.parse(metaText);
      } catch {
        setError('Advanced metadata is not valid JSON');
        return;
      }
    }

    const payload = {
      title: title.trim(),
      slug: effectiveSlug,
      topic,
      status: nextStatus ?? status,
      description: description.trim() || null,
      excerpt: excerpt.trim() || null,
      key_takeaway: keyTakeaway.trim() || null,
      hero_image: heroImage.trim() || null,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      body,
      ...(meta ? { meta } : {}),
    };

    setSaving(true);
    const res = await fetch(isEdit ? `/api/admin/news/${article!.id}` : '/api/admin/news', {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setSaving(false);

    if (!res.ok) {
      const { error: msg } = await res.json().catch(() => ({ error: 'Save failed' }));
      setError(msg ?? 'Save failed');
      return;
    }

    router.push('/admin/news');
    router.refresh();
  }

  const inputClass =
    'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-pink-300 focus:ring-2 focus:ring-pink-100';
  const labelClass = 'block text-xs font-semibold uppercase tracking-wide text-slate-500';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            {isEdit ? 'Edit article' : 'New article'}
          </h2>
          <p className="text-sm text-slate-500">
            {isEdit ? `Editing /${article!.slug}` : 'Draft a new GLOWBAL News article.'}
          </p>
        </div>
        <Link href="/admin/news" className="text-sm font-semibold text-slate-500 hover:text-slate-800">
          ← Back to list
        </Link>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Main column */}
        <div className="space-y-4">
          <div>
            <label className={labelClass} htmlFor="title">Title</label>
            <input
              id="title"
              className={`${inputClass} mt-1 text-base`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Best UK Computer Science degrees for Vietnamese students"
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="slug">Slug</label>
            <input
              id="slug"
              className={`${inputClass} mt-1 font-mono text-xs`}
              value={effectiveSlug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              placeholder="auto-generated-from-title"
            />
            <p className="mt-1 text-xs text-slate-400">Lives at /guides/{effectiveSlug || '…'}</p>
          </div>

          <div>
            <label className={labelClass} htmlFor="description">Subtitle / dek</label>
            <textarea
              id="description"
              className={`${inputClass} mt-1`}
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="One-sentence summary shown under the title."
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="key_takeaway">Key takeaway</label>
            <textarea
              id="key_takeaway"
              className={`${inputClass} mt-1`}
              rows={2}
              value={keyTakeaway}
              onChange={(e) => setKeyTakeaway(e.target.value)}
              placeholder="Highlighted callout at the top of the article."
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className={labelClass} htmlFor="body">Body (Markdown)</label>
              <span className="text-xs text-slate-400">~{readingMinutes} min read</span>
            </div>
            <textarea
              id="body"
              className={`${inputClass} mt-1 font-mono text-xs leading-relaxed`}
              rows={22}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={'## Section heading\n\nWrite the article in Markdown…'}
            />
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              {showAdvanced ? '▾' : '▸'} Advanced metadata (JSON)
            </button>
            {showAdvanced ? (
              <textarea
                className={`${inputClass} mt-2 font-mono text-xs`}
                rows={8}
                value={metaText}
                onChange={(e) => setMetaText(e.target.value)}
                placeholder={'{\n  "supportCards": [],\n  "toc": [],\n  "schema": {}\n}'}
              />
            ) : null}
          </div>

          {isEdit && article ? (
            <ArticleLinksEditor articleId={article.id} candidates={candidates} />
          ) : null}
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
            <div className="space-y-4">
              <div>
                <label className={labelClass} htmlFor="status">Status</label>
                <select
                  id="status"
                  className={`${inputClass} mt-1`}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as GeoArticleStatus)}
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div>
                <label className={labelClass} htmlFor="topic">Topic</label>
                <select
                  id="topic"
                  className={`${inputClass} mt-1`}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                >
                  {TOPICS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass} htmlFor="tags">Tags (comma-separated)</label>
                <input
                  id="tags"
                  className={`${inputClass} mt-1`}
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="UK, Computer Science"
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="excerpt">Excerpt</label>
                <textarea
                  id="excerpt"
                  className={`${inputClass} mt-1`}
                  rows={3}
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                  placeholder="Card + search-result summary."
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="hero">Hero image URL</label>
                <input
                  id="hero"
                  className={`${inputClass} mt-1 text-xs`}
                  value={heroImage}
                  onChange={(e) => setHeroImage(e.target.value)}
                  placeholder="/generated/news/your-slug.png"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => save()}
              className="glow-button-primary text-sm disabled:opacity-50"
            >
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create article'}
            </button>
            {status !== 'published' ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => save('published')}
                className="glow-button-secondary text-sm disabled:opacity-50"
              >
                Save &amp; publish
              </button>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
