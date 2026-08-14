'use client';

import Image from 'next/image';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GeoArticle, GeoArticleStatus } from '@/lib/geo-cms';
import { validateArticleForPublish } from '@/lib/geo-cms-validation';
import {
  Badge,
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
import { hasUnsavedRevision, uploadedImageTarget } from './editor-state';
import { useNewsCopy } from './news-copy';

// MDXEditor touches browser-only APIs during initialization. Keep the editor
// out of the server render so the App Router never evaluates it in Node.
const ClientVisualMarkdownEditor = dynamic(
  () => import('./visual-markdown-editor').then((module) => module.VisualMarkdownEditor),
  {
    ssr: false,
    loading: () => <div className="min-h-[420px] rounded-gb-lg border border-line bg-surface-muted md:min-h-[520px]" aria-label="Loading editor" />,
  },
);

const TOPICS = [
  'Universities',
  'Applications',
  'Scholarships',
  'Visas & immigration',
  'Student life',
  'Careers',
];

type EditorProps = {
  article?: GeoArticle;
  candidates?: Array<{ id: string; title: string; slug: string }>;
};

type SaveState = 'saved' | 'dirty' | 'saving' | 'error' | 'conflict';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/Ä‘/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 80);
}

function heroAltFrom(article?: GeoArticle) {
  return typeof article?.meta?.heroImageAlt === 'string' ? article.meta.heroImageAlt : '';
}

export function ArticleEditor({ article, candidates = [] }: EditorProps) {
  const router = useRouter();
  const t = useNewsCopy();
  const initialId = article?.id;
  const [articleId, setArticleId] = useState(initialId);
  const [updatedAt, setUpdatedAt] = useState(article?.updated_at ?? '');
  const [title, setTitle] = useState(article?.title ?? '');
  const [slug, setSlug] = useState(article?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(Boolean(article));
  const [topic, setTopic] = useState(article?.topic && article.topic !== 'All topics' ? article.topic : '');
  const [status, setStatus] = useState<GeoArticleStatus>(article?.status ?? 'draft');
  const [description, setDescription] = useState(article?.description ?? '');
  const [excerpt, setExcerpt] = useState(article?.excerpt ?? '');
  const [keyTakeaway, setKeyTakeaway] = useState(article?.key_takeaway ?? '');
  const [heroImage, setHeroImage] = useState(article?.hero_image ?? '');
  const [heroAlt, setHeroAlt] = useState(heroAltFrom(article));
  const [tags, setTags] = useState((article?.tags ?? []).join(', '));
  const [body, setBody] = useState(article?.body ?? '');
  const [meta, setMeta] = useState<Record<string, unknown>>(article?.meta ?? {});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishErrors, setPublishErrors] = useState<string[]>([]);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [saveRetry, setSaveRetry] = useState(0);
  const saveLocked = saveState === 'conflict';
  const inFlightRef = useRef(false);
  const revisionRef = useRef(0);
  useLoadingIndicator(saving, t('Saving article'));

  const effectiveSlug = slugTouched ? slug : slugify(title);
  const readingMinutes = useMemo(
    () => Math.max(4, Math.round(body.split(/\s+/).filter(Boolean).length / 180)),
    [body],
  );

  const markDirty = useCallback(() => {
    revisionRef.current += 1;
    setDirty(true);
    setSaveState((current) => current === 'conflict' ? current : 'dirty');
  }, []);

  const setField = useCallback(<T,>(setter: (value: T) => void, value: T) => {
    setter(value);
    markDirty();
  }, [markDirty]);

  const buildPayload = useCallback((nextStatus?: GeoArticleStatus) => {
    const nextMeta = { ...meta, heroImageAlt: heroAlt.trim() };
    return {
      title: title.trim(),
      slug: effectiveSlug,
      topic: topic || 'All topics',
      description: description.trim() || null,
      excerpt: excerpt.trim() || null,
      key_takeaway: keyTakeaway.trim() || null,
      hero_image: heroImage.trim() || null,
      tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      body,
      meta: nextMeta,
      ...(nextStatus ? { status: nextStatus } : {}),
      ...(updatedAt ? { expected_updated_at: updatedAt } : {}),
    };
  }, [body, description, effectiveSlug, excerpt, heroAlt, heroImage, keyTakeaway, meta, tags, title, topic, updatedAt]);

  const persist = useCallback(async (nextStatus?: GeoArticleStatus, openPreview = false) => {
    if (inFlightRef.current) return false;
    setError(null);
    setPublishErrors([]);
    if (editorError) {
      setError(editorError);
      setSaveState('error');
      return false;
    }
    if (!title.trim()) {
      setError(t('Title is required'));
      return false;
    }
    const payload = buildPayload(nextStatus);
    if (nextStatus === 'published') {
      const errors = validateArticleForPublish(payload);
      if (errors.length) {
        setPublishErrors(errors);
        setError(t('Complete the publish checklist'));
        return false;
      }
    }
    const savedRevision = revisionRef.current;
    inFlightRef.current = true;
    setSaving(true);
    setSaveState('saving');
    const id = articleId;
    const res = await fetch(id ? `/api/admin/news/${id}` : '/api/admin/news', {
      method: id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(id ? payload : { ...payload, status: nextStatus ?? 'draft' }),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    inFlightRef.current = false;
    setSaving(false);
    if (!res?.ok) {
      setSaveState(res?.status === 409 ? 'conflict' : 'error');
      setError(data?.error ?? t('Save failed'));
      if (Array.isArray(data?.errors)) setPublishErrors(data.errors);
      return false;
    }
    const saved = data.article as GeoArticle;
    setArticleId(saved.id);
    setUpdatedAt(saved.updated_at);
    setStatus(saved.status);
    const hasNewerEdits = hasUnsavedRevision(savedRevision, revisionRef.current);
    setDirty(hasNewerEdits);
    setSaveState(hasNewerEdits ? 'dirty' : 'saved');
    if (!id) {
      router.replace(`/admin/news/${saved.id}/edit`);
      router.refresh();
    }
    if (openPreview) window.open(`/admin/news/${saved.id}/preview`, '_blank', 'noopener,noreferrer');
    if (hasNewerEdits) setSaveRetry((value) => value + 1);
    return true;
  }, [articleId, buildPayload, editorError, router, t, title]);

  useEffect(() => {
    if (!articleId || !dirty || saveLocked) return;
    const timer = window.setTimeout(() => void persist(), 900);
    return () => window.clearTimeout(timer);
  }, [articleId, body, description, dirty, effectiveSlug, excerpt, heroAlt, heroImage, keyTakeaway, persist, saveLocked, saveRetry, tags, title, topic]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const uploadImage = useCallback(async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    const response = await fetch('/api/admin/news/images', { method: 'POST', body: form });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.url) throw new Error(data?.error ?? t('Image upload failed'));
    return data.url as string;
  }, [t]);

  const uploadHeroImage = useCallback(async (file: File) => {
    const url = await uploadImage(file);
    setHeroImage(uploadedImageTarget('hero', '', url).heroImage);
    markDirty();
    return url;
  }, [markDirty, uploadImage]);

  const handleBodyChange = useCallback((value: string) => {
    setEditorError(null);
    setField(setBody, value);
  }, [setField]);

  const saveLabel = saveState === 'saving'
    ? t('Saving…')
    : saveState === 'dirty'
      ? t('Unsaved changes')
      : saveState === 'error' || saveState === 'conflict'
        ? t('Needs attention')
        : t('All changes saved');

  return (
    <div className="flex flex-col gap-gb-3xl">
      <AdminHeading
        title={articleId ? t('Edit article') : t('New article')}
        description={articleId ? t('Update your story, then preview it before publishing.') : t('Create a clear, engaging GLOWBAL News story.')}
        action={
          <Link
            href="/admin/news"
            className="inline-flex items-center gap-gb-md rounded-gb-md px-gb-md py-gb-xs text-gb-sm font-semibold text-fg-tertiary transition-colors hover:bg-surface-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <KitIcon art={ICONS.arrowLeft} frame={16} className="shrink-0" />
            {t('Back to News')}
          </Link>
        }
      />

      <div className="sticky top-gb-md z-20 flex flex-wrap items-center justify-between gap-gb-lg rounded-gb-xl border border-line bg-surface/95 px-gb-xl py-gb-md shadow-gb-xs backdrop-blur">
        <div className="flex items-center gap-gb-md text-gb-sm text-fg-tertiary" aria-live="polite">
          <span className={`h-2 w-2 rounded-full ${saveState === 'saved' ? 'bg-tier-safe' : saveState === 'saving' ? 'bg-tier-recommend' : 'bg-brand'}`} aria-hidden="true" />
          {saveLabel}
        </div>
        <div className="flex flex-wrap items-center gap-gb-md">
          {articleId ? (
            <Button variant="secondary" disabled={saving || saveLocked} onClick={() => void persist(undefined, true)}>
              {t('Preview')}
            </Button>
          ) : null}
          <Button variant="secondary" disabled={saving || saveLocked} onClick={() => void persist('draft')}>
            {t('Save draft')}
          </Button>
          <Button disabled={saving || saveLocked} onClick={() => void persist('published')}>
            {t('Publish')}
          </Button>
        </div>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {saveState === 'conflict' ? (
        <Alert tone="error">
          {t('Another admin updated this article. Reload the page before saving again.')}
        </Alert>
      ) : null}
      {publishErrors.length > 0 ? (
        <ul className="list-disc rounded-gb-lg border border-line-error bg-surface-error px-gb-2xl py-gb-lg pl-10 text-gb-sm text-fg-error">
          {publishErrors.map((item) => <li key={item}>{t(item)}</li>)}
        </ul>
      ) : null}

      <div className="grid gap-gb-3xl lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-gb-3xl">
          <Panel className="flex flex-col gap-gb-2xl">
            <PanelHeader title={t('Story')} description={t('Write for people first. The public article will keep the same formatting.')} />
            <Input
              name="title"
              label={t('Title')}
              value={title}
              onChange={(event) => setField(setTitle, event.target.value)}
              placeholder={t('A clear headline your reader can understand')}
            />
            <Textarea
              name="description"
              label={t('Description')}
              rows={2}
              value={description}
              onChange={(event) => setField(setDescription, event.target.value)}
              placeholder={t('Summarize the story in one sentence.')}
            />
            <Textarea
              name="key_takeaway"
              label={t('Key takeaway')}
              rows={2}
              value={keyTakeaway}
              onChange={(event) => setField(setKeyTakeaway, event.target.value)}
              placeholder={t('The one idea readers should remember.')}
            />
          </Panel>

          <Panel className="flex flex-col gap-gb-xl">
            <PanelHeader title={t('Article body')} description={t('{minutes} min read · formatting toolbar enabled', { minutes: readingMinutes })} />
            <ClientVisualMarkdownEditor markdown={body} onChange={handleBodyChange} onImageUpload={uploadImage} onError={setEditorError} />
            {editorError ? <p role="alert" className="text-gb-sm text-fg-error">{t('The article body could not be read. Review it before saving.')}</p> : null}
            <p className="text-gb-xs text-fg-muted">{t('Use the image button to upload an inline image. Add descriptive alt text in the image dialog.')}</p>
          </Panel>

          <details className="group rounded-gb-xl border border-line bg-surface">
            <summary className="cursor-pointer list-none px-gb-2xl py-gb-xl text-gb-sm font-semibold text-fg focus-visible:outline-2 focus-visible:outline-brand">
              <span className="inline-flex items-center gap-gb-md">
                <KitIcon art={ICONS.chevronDown} frame={16} className="transition-transform group-open:rotate-180" />
                {t('Advanced GEO settings')}
              </span>
            </summary>
            <div className="border-t border-line px-gb-2xl pb-gb-2xl pt-gb-xl">
              {articleId && article ? <ArticleLinksEditor articleId={article.id} candidates={candidates} /> : <p className="text-gb-sm text-fg-muted">{t('Save the draft first to add related articles.')}</p>}
            </div>
          </details>
        </div>

        <aside className="flex flex-col gap-gb-xl">
          <Panel padding="sm" className="flex flex-col gap-gb-2xl">
            <PanelHeader title={t('Publishing')} description={t('These details help readers find and trust the story.')} />
            <div className="flex items-center justify-between rounded-gb-md bg-surface-muted px-gb-lg py-gb-md text-gb-sm">
              <span className="text-fg-tertiary">{t('Status')}</span>
              <Badge variant={status === 'published' ? 'safe-chip' : status === 'archived' ? 'neutral-chip' : 'brand-chip'}>{t(status.charAt(0).toUpperCase() + status.slice(1))}</Badge>
            </div>
            <Select name="topic" label={t('Topic')} value={topic} onChange={(event) => setField(setTopic, event.target.value)}>
              <option value="">{t('Choose a topic')}</option>
              {TOPICS.map((item) => <option key={item} value={item}>{t(item)}</option>)}
            </Select>
            <Input
              name="tags"
              label={t('Tags')}
              hint={t('Separate tags with commas.')}
              value={tags}
              onChange={(event) => setField(setTags, event.target.value)}
              placeholder={t('UK, Computer Science')}
            />
            <Textarea
              name="excerpt"
              label={t('Card excerpt')}
              hint={t('Shown on News cards and search results.')}
              rows={3}
              value={excerpt}
              onChange={(event) => setField(setExcerpt, event.target.value)}
            />
          </Panel>

          <Panel padding="sm" className="flex flex-col gap-gb-xl">
            <PanelHeader title={t('Hero image')} description={t('A strong image gives the story a clear entry point.')} />
            <label className="group relative flex aspect-[16/9] cursor-pointer items-center justify-center overflow-hidden rounded-gb-lg border border-dashed border-line-strong bg-surface-muted text-center transition hover:border-brand">
              {heroImage ? <Image src={heroImage} alt={heroAlt || t('Hero image preview')} fill unoptimized className="object-cover" sizes="320px" /> : <span className="px-gb-xl text-gb-sm text-fg-muted">{t('Click to upload a hero image')}</span>}
              <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadHeroImage(file).catch((uploadError: Error) => setError(uploadError.message)); }} />
            </label>
            <Input
              name="hero_alt"
              label={t('Hero image alt text')}
              value={heroAlt}
              onChange={(event) => setField(setHeroAlt, event.target.value)}
              placeholder={t('Describe what the image shows')}
              hint={t('Required before publishing.')}
            />
          </Panel>

          <Panel padding="sm" className="flex flex-col gap-gb-xl">
            <PanelHeader title={t('Search preview')} description={t('Control the URL and search snippet without touching code.')} />
            <Input
              name="slug"
              label={t('Article URL')}
              value={effectiveSlug}
              onChange={(event) => { setSlugTouched(true); setField(setSlug, event.target.value); }}
              hint={`/news/${effectiveSlug || 'your-article'}`}
              className="font-mono text-gb-sm"
            />
            <button type="button" onClick={() => setShowAdvanced((value) => !value)} className="text-left text-gb-sm font-semibold text-fg-tertiary hover:text-fg focus-visible:outline-2 focus-visible:outline-brand" aria-expanded={showAdvanced}>
              {showAdvanced ? t('Hide technical metadata') : t('Show technical metadata')}
            </button>
            {showAdvanced ? <Textarea name="meta_notes" label={t('Internal notes')} rows={3} value={typeof meta.internalNotes === 'string' ? meta.internalNotes : ''} onChange={(event) => { setMeta((value) => ({ ...value, internalNotes: event.target.value })); markDirty(); }} /> : null}
          </Panel>
        </aside>
      </div>
    </div>
  );
}
