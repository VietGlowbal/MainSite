'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { GeoArticle } from '@/lib/geo-cms';
import { ArticleBody } from '@/app/news/[slug]/article-body';
import { useNewsCopy } from '../../news-copy';

export function NewsPreviewClient({ article }: { article: GeoArticle }) {
  const t = useNewsCopy();
  const alt = typeof article.meta?.heroImageAlt === 'string' ? article.meta.heroImageAlt : article.title;
  const banner = t('Preview — this {status} article is not visible to the public yet.', { status: t(article.status.charAt(0).toUpperCase() + article.status.slice(1)) });

  return (
    <main className="mx-auto max-w-gb-desktop px-gb-xl py-gb-3xl md:px-gb-4xl md:py-gb-5xl" data-no-auto-translate>
      <div className="mb-gb-xl flex flex-wrap items-center justify-between gap-gb-lg rounded-gb-lg border border-line bg-tier-recommend px-gb-xl py-gb-lg text-gb-sm text-fg">
        <span><strong>{t('Preview')}</strong> — {banner.replace(`${t('Preview')} — `, '')}</span>
        <Link href={`/admin/news/${article.id}/edit`} className="font-semibold text-fg-brand hover:underline">{t('Back to editor')}</Link>
      </div>
      <article className="mx-auto max-w-gb-width-xl rounded-gb-2xl border border-line bg-surface px-gb-2xl py-gb-3xl shadow-gb-xs md:px-gb-5xl md:py-gb-5xl">
        <div className="flex flex-wrap items-center gap-gb-md text-gb-sm text-fg-muted">
          <span className="rounded-full bg-brand-subtle px-gb-md py-gb-xs font-semibold text-fg-brand">{t(article.topic)}</span>
          <span>{t('{minutes} min read', { minutes: article.reading_time_minutes ?? 4 })}</span>
        </div>
        <h1 className="mt-gb-xl font-display text-gb-display-md font-semibold tracking-gb-display-tight text-fg">{article.title || t('Untitled article')}</h1>
        {article.description ? <p className="mt-gb-lg text-gb-xl leading-relaxed text-fg-secondary">{article.description}</p> : null}
        {article.hero_image ? <div className="relative mt-gb-3xl aspect-[16/8.5] overflow-hidden rounded-gb-xl bg-surface-muted"><Image src={article.hero_image} alt={alt} fill unoptimized className="object-cover" sizes="(max-width: 768px) 100vw, 768px" /></div> : null}
        {article.key_takeaway ? <aside className="mt-gb-2xl rounded-gb-xl bg-brand-subtle px-gb-2xl py-gb-xl"><h2 className="text-gb-lg font-semibold text-fg">{t('Key takeaway')}</h2><p className="mt-gb-sm text-gb-md text-fg-secondary">{article.key_takeaway}</p></aside> : null}
        <ArticleBody content={article.body} />
      </article>
    </main>
  );
}
