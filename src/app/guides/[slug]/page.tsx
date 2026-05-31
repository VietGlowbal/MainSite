import Image from 'next/image';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getGeoGuide, listGeoGuides, listRelatedGeoGuides } from '@/lib/geo-content';

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-');
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T12:00:00Z`));
}

const accentClasses: Record<string, string> = {
  pink: 'bg-pink-50 text-pink-600',
  cyan: 'bg-cyan-50 text-cyan-700',
  violet: 'bg-violet-50 text-violet-700',
  amber: 'bg-amber-50 text-amber-700',
  emerald: 'bg-emerald-50 text-emerald-700',
};

export async function generateStaticParams() {
  return listGeoGuides().map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGeoGuide(slug);
  if (!guide) return {};
  const md = guide.metadata as { title?: string; metaDescription?: string; heroImage?: string } | undefined;
  return {
    title: md?.title || guide.title,
    description: md?.metaDescription || guide.description,
    openGraph: {
      title: md?.title || guide.title,
      description: md?.metaDescription || guide.description,
      images: md?.heroImage ? [md.heroImage] : undefined,
    },
  };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGeoGuide(slug);
  if (!guide) notFound();
  const related = listRelatedGeoGuides(guide.slug, guide.topic, 3);

  return (
    <main className="app-page-shell">
      <div className="app-page-container grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-[2rem] border border-white/80 bg-white/95 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] md:p-8">
          <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <Link href="/news" className="hover:text-pink-600">Glowbal News</Link>
            <span>›</span>
            <button className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{guide.topic}</button>
            <span>›</span>
            <span className="text-slate-800">{guide.title}</span>
          </nav>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <span className="rounded-full bg-pink-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-pink-600">{guide.topic}</span>
              <span>{formatDate(guide.publishedAt)}</span>
              <span>•</span>
              <span>{guide.readingTimeMinutes} min read</span>
              <span>•</span>
              <span>By Glowbal Editorial Team</span>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <button className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-slate-600">Save</button>
              <button className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-slate-600">Share</button>
              <button className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-slate-600">•••</button>
            </div>
          </div>

          <h1 className="mt-6 max-w-4xl text-4xl font-semibold tracking-tight text-slate-900 md:text-[3.35rem] md:leading-[1.1]">{guide.title}</h1>
          {guide.description ? <p className="mt-4 max-w-3xl text-xl leading-9 text-slate-600">{guide.description}</p> : null}

          {guide.tags.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {guide.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-600">{tag}</span>
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
                <h2 className="text-lg font-semibold text-slate-900">Key takeaway</h2>
                <p className="mt-1 text-lg leading-8 text-slate-600">{guide.keyTakeaway}</p>
              </div>
            </section>
          ) : null}

          <article className="prose prose-slate mt-10 max-w-none prose-headings:scroll-mt-24 prose-headings:text-slate-900 prose-h2:mt-12 prose-h2:text-[2rem] prose-h2:font-semibold prose-h3:text-xl prose-p:text-[1.08rem] prose-p:leading-8 prose-a:text-cyan-700" >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h2: ({ children }) => {
                  const flattened = Array.isArray(children) ? children.join(' ') : String(children);
                  return <h2 id={slugify(flattened)}>{children}</h2>;
                },
              }}
            >
              {guide.content}
            </ReactMarkdown>
          </article>

          {guide.supportCards.length > 0 ? (
            <section className="mt-10">
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900">Why this matters</h2>
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
              <h2 className="text-lg font-semibold text-slate-900">On this page</h2>
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
            <h2 className="text-lg font-semibold text-slate-900">Related articles</h2>
            <div className="mt-4 space-y-4">
              {related.map((item) => (
                <Link key={item.slug} href={`/guides/${item.slug}`} className="flex items-center gap-3">
                  <div className="relative h-16 w-16 overflow-hidden rounded-2xl bg-slate-100">
                    <Image src={item.heroImage} alt={item.title} fill className="object-cover" sizes="64px" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold leading-6 text-slate-900">{item.title}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.readingTimeMinutes} min read</div>
                  </div>
                </Link>
              ))}
            </div>
            <Link href="/news" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-pink-600">View all articles <span aria-hidden>→</span></Link>
          </section>

          <section className="rounded-[1.8rem] border border-pink-100 bg-[linear-gradient(135deg,rgba(255,77,140,0.12),rgba(0,180,216,0.08))] p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
            <h2 className="text-lg font-semibold text-slate-900">Stay updated</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Get the latest study abroad tips, scholarships and guides straight to your inbox.</p>
            <div className="mt-4 flex gap-2">
              <input className="min-w-0 flex-1 rounded-2xl border border-white/80 bg-white px-4 py-3 text-sm outline-none" placeholder="Enter your email" />
              <button className="rounded-2xl bg-pink-500 px-4 py-3 text-sm font-semibold text-white">Subscribe</button>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
