import Image from 'next/image';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getGeoGuide, listGeoGuides, listLinkedPublishedGuides, listRelatedGeoGuides } from '@/lib/geo-content';
import type { GeoGuide } from '@/lib/geo-content';
import { NewsletterCard } from '@/components/news/newsletter-card';
import { SITE_URL } from '@/lib/site-url';
import { getLocaleText, localizePath, type Locale } from '@/lib/i18n/locale';
import { serializeJsonLd } from '@/lib/seo/json-ld';
import { buildLocaleAlternates } from '@/lib/seo/alternates';
import { ArticleBody } from './article-body';

function formatDate(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-GB', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T12:00:00Z`));
}

const accentClasses: Record<string, string> = {
  pink: 'bg-pink-50 text-pink-600',
  cyan: 'bg-cyan-50 text-cyan-700',
  violet: 'bg-violet-50 text-violet-700',
  amber: 'bg-amber-50 text-amber-700',
  emerald: 'bg-emerald-50 text-emerald-700',
};

const tagPalette = [
  'bg-emerald-100 text-emerald-700',
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-amber-100 text-amber-700',
  'bg-cyan-100 text-cyan-700',
];

// Articles published after build (or edited in the CMS) are rendered
// on-demand and cached; this also revalidates on a 5-minute window.
export const revalidate = 300;

/** schema.org JSON-LD: Article + Breadcrumb (+ FAQ passthrough), wired to the
 *  GEO graph via relatedLink — explicit structure for AI search engines. */
function buildGuideJsonLd(guide: GeoGuide, related: GeoGuide[], locale: Locale) {
  const url = `${SITE_URL}${localizePath(`/news/${guide.slug}`, locale)}`;
  const image = guide.heroImage
    ? (guide.heroImage.startsWith('http') ? guide.heroImage : `${SITE_URL}${guide.heroImage}`)
    : undefined;

  const publishedDate = guide.publishedAt.slice(0, 10);
  const modifiedDate = (guide.updatedAt || guide.publishedAt).slice(0, 10);

  const graph: Record<string, unknown>[] = [
    {
      '@type': 'Article',
      headline: guide.title,
      description: guide.description || guide.excerpt,
      ...(image ? { image: [image] } : {}),
      datePublished: publishedDate,
      dateModified: modifiedDate,
      author: { '@type': 'Organization', name: 'GlowBal', url: SITE_URL },
      publisher: {
        '@type': 'Organization',
        name: 'GlowBal',
        url: SITE_URL,
        logo: {
          '@type': 'ImageObject',
          url: `${SITE_URL}/glowbal-logo.png`,
        },
      },
      mainEntityOfPage: url,
      ...(guide.tags.length ? { keywords: guide.tags.join(', ') } : {}),
      ...(related.length ? { relatedLink: related.map((r) => `${SITE_URL}${localizePath(`/news/${r.slug}`, locale)}`) } : {}),
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'GlowBal News', item: `${SITE_URL}${localizePath('/news', locale)}` },
        { '@type': 'ListItem', position: 2, name: guide.topic, item: `${SITE_URL}${localizePath('/news', locale)}` },
        { '@type': 'ListItem', position: 3, name: guide.title, item: url },
      ],
    },
  ];

  // Pass through a pipeline/admin-supplied FAQ schema block if present.
  const faq = (guide.metadata as { schema?: { faq?: Record<string, unknown> } } | undefined)?.schema?.faq;
  if (faq && typeof faq === 'object') graph.push(faq);

  return { '@context': 'https://schema.org', '@graph': graph };
}

export async function generateStaticParams() {
  const guides = await listGeoGuides();
  return guides.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const guide = await getGeoGuide(slug);
  if (!guide) return { title: 'Article not found | GlowBal' };
  const md = guide.metadata as { title?: string; metaDescription?: string; heroImage?: string } | undefined;
  const title = md?.title || guide.title;
  const description = md?.metaDescription || guide.description;
  const canonicalUrl = `${SITE_URL}/news/${slug}`;
  const heroImg = md?.heroImage || (guide.heroImage ? (guide.heroImage.startsWith('http') ? guide.heroImage : `${SITE_URL}${guide.heroImage}`) : undefined);

  return {
    title: `${title} | GlowBal`,
    description,
    alternates: buildLocaleAlternates(`/news/${slug}`),
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: 'article',
      publishedTime: guide.publishedAt,
      modifiedTime: guide.updatedAt || guide.publishedAt,
      images: heroImg ? [{ url: heroImg, alt: title }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: heroImg ? [heroImg] : undefined,
    },
  };
}

export default async function GuidePage({ params, locale = 'en' }: { params: Promise<{ slug: string }>; locale?: Locale }) {
  const { slug } = await params;
  const guide = await getGeoGuide(slug);
  if (!guide) notFound();

  // Prefer the explicit GEO graph (editor-curated links); fall back to the
  // topic heuristic when an article has no outgoing edges yet.
  const linked = await listLinkedPublishedGuides(guide.slug, ['related', 'next', 'cluster'], 3);
  const related = linked.length ? linked : await listRelatedGeoGuides(guide.slug, guide.topic, 3);

  const jsonLd = buildGuideJsonLd(guide, related, locale);
  const t = (source: string, vars?: Record<string, string | number>) => getLocaleText(locale, source, vars);

  return (
    <main className="app-page-shell" data-no-auto-translate>
      <script
        type="application/ld+json"
        // Structured data helps AI search + Google understand and surface the
        // article and its place in the GEO graph.
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <div className="app-page-container grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-[2rem] border border-white/80 bg-white/95 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] md:p-8">
          <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <Link href={localizePath('/news', locale)} className="hover:text-pink-600">{t('GlowBal News')}</Link>
            <span>›</span>
            <button className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{guide.topic}</button>
            <span>›</span>
            <span className="text-slate-800">{guide.title}</span>
          </nav>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <span className="rounded-full bg-pink-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-pink-600">{t(guide.topic)}</span>
              <span>{formatDate(guide.publishedAt, locale)}</span>
              <span>•</span>
              <span>{t('{minutes} min read', { minutes: guide.readingTimeMinutes })}</span>
              <span>•</span>
              <span className="inline-flex items-center gap-1.5">
                {t('By Glowbal Editorial Team')}
                <svg className="h-4 w-4 text-cyan-500" viewBox="0 0 24 24" fill="currentColor" aria-label="Verified">
                  <path d="m12 1.6 2.3 2.05 3.05-.36 1.27 2.8 2.8 1.27-.36 3.05L23.4 12l-2.05 2.3.36 3.05-2.8 1.27-1.27 2.8-3.05-.36L12 22.4l-2.3-2.05-3.05.36-1.27-2.8-2.8-1.27.36-3.05L.6 12l2.05-2.3-.36-3.05 2.8-1.27L6.36 2.6l3.05.36L12 1.6Z" />
                  <path d="m8.4 12 2.4 2.4 4.8-4.8" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 text-sm">
              <button className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-slate-600 transition hover:border-slate-300">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z" /></svg>
                {t('Save')}
              </button>
              <button className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-slate-600 transition hover:border-slate-300">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></svg>
                {t('Share')}
              </button>
              <button aria-label="More actions" className="flex h-[42px] w-[42px] items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>
              </button>
            </div>
          </div>

          <h1 className="mt-6 max-w-4xl text-4xl font-semibold tracking-tight text-slate-900 md:text-[3.35rem] md:leading-[1.1]">{guide.title}</h1>
          {guide.description ? <p className="mt-4 max-w-3xl text-xl leading-9 text-slate-600">{guide.description}</p> : null}

          {guide.tags.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {guide.tags.map((tag, index) => (
                <span key={tag} className={`rounded-full px-3 py-1.5 text-sm font-medium ${tagPalette[index % tagPalette.length]}`}>{tag}</span>
              ))}
            </div>
          ) : null}

          <div className="relative mt-7 aspect-[16/8.5] overflow-hidden rounded-[1.7rem] bg-slate-100">
            <Image src={guide.heroImage} alt={guide.title} fill className="object-cover" sizes="(max-width: 1280px) 100vw, 70vw" />
          </div>

          {guide.keyTakeaway ? (
            <section className="mt-6 flex gap-4 rounded-[1.7rem] bg-[linear-gradient(135deg,rgba(125,95,255,0.08),rgba(255,77,140,0.07))] p-5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white text-2xl shadow-sm">✦</div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{t('Key takeaway')}</h2>
                <p className="mt-1 text-lg leading-8 text-slate-600">{guide.keyTakeaway}</p>
              </div>
            </section>
          ) : null}

          <ArticleBody content={guide.content} />

          {guide.supportCards.length > 0 ? (
            <section className="mt-10">
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900">{t('Why this matters')}</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                {guide.supportCards.map((card, index) => {
                  const asset = guide.supportAssets[index];
                  return (
                    <article key={card.title} className="rounded-[1.4rem] border border-slate-200 bg-white p-5 shadow-sm">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-full ${accentClasses[card.accent] ?? accentClasses.pink}`}>
                        {asset ? (
                          <Image src={asset.assetPath} alt={card.title} width={28} height={28} className="h-7 w-7" />
                        ) : (
                          <span className="text-lg">✦</span>
                        )}
                      </div>
                      <h3 className="mt-4 text-xl font-semibold text-slate-900">{card.title}</h3>
                      <p className="mt-2 text-slate-600 leading-7">{card.description}</p>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-5">
          {guide.toc.length > 0 ? (
            <section className="rounded-[1.8rem] border border-white/80 bg-white/95 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
              <h2 className="text-lg font-semibold text-slate-900">{t('On this page')}</h2>
              <ol className="mt-4 space-y-3 text-sm text-slate-600">
                {guide.toc.map((item, index) => (
                  <li key={item.id} className="flex gap-3">
                    <span className={index === 0 ? 'text-pink-500 font-semibold' : 'text-slate-400'}>{index + 1}.</span>
                    <a href={`#${item.id}`} className={index === 0 ? 'text-pink-500' : 'hover:text-slate-900'}>{item.title}</a>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <section className="rounded-[1.8rem] border border-white/80 bg-white/95 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
            <h2 className="text-lg font-semibold text-slate-900">{t('Related articles')}</h2>
            <div className="mt-4 space-y-4">
              {related.map((item) => (
                <Link key={item.slug} href={localizePath(`/news/${item.slug}`, locale)} className="flex items-center gap-3">
                  <div className="relative h-16 w-16 overflow-hidden rounded-2xl bg-slate-100">
                    <Image src={item.heroImage} alt={item.title} fill className="object-cover" sizes="64px" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold leading-6 text-slate-900">{item.title}</div>
                    <div className="mt-1 text-xs text-slate-500">{t('{minutes} min read', { minutes: item.readingTimeMinutes })}</div>
                  </div>
                </Link>
              ))}
            </div>
            <Link href={localizePath('/news', locale)} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-pink-600">{t('View all articles')} <span aria-hidden>→</span></Link>
          </section>

          <NewsletterCard />
        </aside>
      </div>
    </main>
  );
}
