'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { GeoArticle, GeoArticleStatus } from '@/lib/geo-cms';
import {
  Button,
  ICONS,
  Input,
  KitIcon,
  Panel,
  PanelHeader,
  Select,
  Textarea,
} from '@/shared/ui';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';
import { AdminHeading, Alert } from '../_ui';
import { ArticleLinksEditor } from './article-links-editor';

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

  return (
    <div className="flex flex-col gap-gb-3xl">
      <AdminHeading
        title={isEdit ? 'Edit article' : 'New article'}
        description={isEdit ? `Editing /${article!.slug}` : 'Draft a new GLOWBAL News article.'}
        action={
          <Link
            href="/admin/news"
            className="inline-flex items-center gap-gb-md rounded-gb-md px-gb-md py-gb-xs text-gb-sm font-semibold text-fg-tertiary transition-colors hover:bg-surface-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <KitIcon art={ICONS.arrowLeft} frame={16} className="shrink-0" />
            Back to list
          </Link>
        }
      />

      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="grid gap-gb-3xl lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Main column */}
        <div className="flex min-w-0 flex-col gap-gb-3xl">
          <Panel className="flex flex-col gap-gb-2xl">
            <PanelHeader title="The article" />

            <Input
              name="title"
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Best UK Computer Science degrees for Vietnamese students"
            />

            <Input
              name="slug"
              label="Slug"
              value={effectiveSlug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              placeholder="auto-generated-from-title"
              hint={`Lives at /news/${effectiveSlug || '…'}`}
              className="font-mono text-gb-sm"
            />

            <Textarea
              name="description"
              label="Subtitle / dek"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="One-sentence summary shown under the title."
            />

            <Textarea
              name="key_takeaway"
              label="Key takeaway"
              rows={2}
              value={keyTakeaway}
              onChange={(e) => setKeyTakeaway(e.target.value)}
              placeholder="Highlighted callout at the top of the article."
            />
          </Panel>

          <Panel className="flex flex-col gap-gb-2xl">
            <PanelHeader title="Body" description={`Markdown · about ${readingMinutes} min read`} />

            <Textarea
              name="body"
              rows={24}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={'## Section heading\n\nWrite the article in Markdown…'}
              className="font-mono text-gb-sm leading-relaxed"
            />

            <div className="flex flex-col gap-gb-lg border-t border-line pt-gb-xl">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                aria-expanded={showAdvanced}
                className="inline-flex w-fit items-center gap-gb-xs rounded-gb-sm text-gb-sm font-semibold text-fg-tertiary transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                Advanced metadata (JSON)
                <KitIcon
                  art={ICONS.chevronDown}
                  frame={16}
                  className={`shrink-0 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
                />
              </button>
              {showAdvanced ? (
                <Textarea
                  name="meta"
                  rows={8}
                  value={metaText}
                  onChange={(e) => setMetaText(e.target.value)}
                  placeholder={'{\n  "supportCards": [],\n  "toc": [],\n  "schema": {}\n}'}
                  className="font-mono text-gb-sm"
                />
              ) : null}
            </div>
          </Panel>

          {isEdit && article ? (
            <ArticleLinksEditor articleId={article.id} candidates={candidates} />
          ) : null}
        </div>

        {/* Sidebar */}
        <aside className="flex flex-col gap-gb-xl">
          <Panel padding="sm" className="flex flex-col gap-gb-2xl">
            <PanelHeader title="Publishing" />

            <Select
              name="status"
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value as GeoArticleStatus)}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </Select>

            <Select
              name="topic"
              label="Topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            >
              {TOPICS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>

            <Input
              name="tags"
              label="Tags"
              hint="Comma-separated."
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="UK, Computer Science"
            />

            <Textarea
              name="excerpt"
              label="Excerpt"
              hint="Card and search-result summary."
              rows={3}
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
            />

            <Input
              name="hero_image"
              label="Hero image URL"
              value={heroImage}
              onChange={(e) => setHeroImage(e.target.value)}
              placeholder="/generated/news/your-slug.png"
              className="font-mono text-gb-sm"
            />
          </Panel>

          <div className="flex flex-col gap-gb-md">
            <Button size="lg" disabled={saving} onClick={() => void save()}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create article'}
            </Button>
            {status !== 'published' ? (
              <Button
                variant="secondary"
                size="lg"
                disabled={saving}
                onClick={() => void save('published')}
              >
                Save &amp; publish
              </Button>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
