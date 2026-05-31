'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { GeoGuide } from '@/lib/geo-content';

type Props = {
  guides: GeoGuide[];
  topics: string[];
};

const topicIcons: Record<string, string> = {
  'All topics': '◈',
  Applications: '✦',
  Scholarships: '◌',
  'Student life': '◎',
  'Visas & immigration': '✈',
  Universities: '⌂',
  Careers: '↗',
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T12:00:00Z`));
}

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export default function NewsPageClient({ guides, topics }: Props) {
  const [query, setQuery] = useState('');
  const [activeTopic, setActiveTopic] = useState('All topics');

  const filteredGuides = useMemo(() => {
    return guides.filter((guide) => {
      const matchesTopic = activeTopic === 'All topics' || guide.topic === activeTopic;
      const haystack = `${guide.title} ${guide.excerpt} ${guide.topic} ${guide.tags.join(' ')}`.toLowerCase();
      const matchesQuery = query.trim().length === 0 || haystack.includes(query.toLowerCase());
      return matchesTopic && matchesQuery;
    });
  }, [guides, activeTopic, query]);

  const featured = filteredGuides[0] ?? guides[0] ?? null;
  const latest = filteredGuides.slice(featured ? 1 : 0);
  const trending = [...(filteredGuides.length ? filteredGuides : guides)]
    .sort((a, b) => {
      const topicWeight = (guide: GeoGuide) => (guide.topic === 'Applications' ? 4 : guide.topic === 'Visas & immigration' ? 3 : guide.topic === 'Scholarships' ? 2 : 1);
      return topicWeight(b) - topicWeight(a) || b.readingTimeMinutes - a.readingTimeMinutes || b.publishedAt.localeCompare(a.publishedAt);
    })
    .slice(0, 5);

  return (
    <main className="app-page-shell">
      <div className="app-page-container space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/80 bg-white/90 px-6 py-7 shadow-[0_24px_80px_rgba(15,23,42,0.08)] md:px-8 md:py-9">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-fuchsia-500">Glowbal News &amp; Guides</p>
              <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-slate-900 md:text-6xl md:leading-[1.05]">
                Insights to help you study abroad <span className="glowbal-wordmark">smarter</span>
              </h1>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
                Expert insights, real student stories, and practical guides to help you plan, apply, and succeed.
              </p>

              <div className="mt-7 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                <label className="group flex min-h-14 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 shadow-sm transition focus-within:border-cyan-300 focus-within:shadow-[0_0_0_4px_rgba(34,211,238,0.12)]">
                  <svg className="h-5 w-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search articles, topics or universities..."
                    className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                  />
                </label>
                <button className="flex min-h-14 items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 shadow-sm">
                  <span>{activeTopic}</span>
                  <span>⌄</span>
                </button>
              </div>
            </div>

            <div className="relative hidden min-h-[240px] items-center justify-center lg:flex">
              <div className="absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_30%_30%,rgba(255,77,140,0.12),transparent_24%),radial-gradient(circle_at_75%_35%,rgba(0,180,216,0.18),transparent_25%),radial-gradient(circle_at_58%_82%,rgba(125,95,255,0.12),transparent_24%)]" />
              <div className="relative flex h-56 w-56 items-center justify-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#e7efff,#a9c4ff_48%,#5f76ff_70%,#635bff_100%)] shadow-[0_28px_60px_rgba(88,86,214,0.18)]">
                <div className="absolute inset-4 rounded-full border border-white/35" />
                <div className="absolute inset-10 rounded-full border border-white/20" />
                <span className="text-[5rem]">🌍</span>
              </div>
              {[
                { emoji: '🎓', top: '12%', left: '12%' },
                { emoji: '📘', top: '58%', left: '18%' },
                { emoji: '📝', top: '16%', left: '80%' },
                { emoji: '💼', top: '60%', left: '82%' },
              ].map((item) => (
                <div key={item.emoji} className="absolute flex h-16 w-16 items-center justify-center rounded-full border border-white/85 bg-white text-2xl shadow-lg" style={{ top: item.top, left: item.left }}>
                  {item.emoji}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="flex flex-wrap gap-3 rounded-[1.6rem] border border-white/80 bg-white/80 p-3 shadow-[0_20px_60px_rgba(15,23,42,0.05)]">
          {topics.map((topic) => {
            const active = activeTopic === topic;
            return (
              <button
                key={topic}
                type="button"
                onClick={() => setActiveTopic(topic)}
                className={classNames(
                  'inline-flex items-center gap-2 rounded-full border px-4 py-3 text-sm font-medium transition',
                  active
                    ? 'border-pink-200 bg-pink-50 text-pink-600 shadow-[0_8px_24px_rgba(255,77,140,0.14)]'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                )}
              >
                <span>{topicIcons[topic] ?? '•'}</span>
                {topic}
              </button>
            );
          })}
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            {featured ? (
              <section className="rounded-[2rem] border border-white/80 bg-white/95 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.08)] md:p-5">
                <div className="grid gap-6 lg:grid-cols-[0.95fr_1.15fr] lg:items-center">
                  <div className="relative overflow-hidden rounded-[1.5rem] bg-slate-100 aspect-[5/4]">
                    <Image src={featured.heroImage} alt={featured.title} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 40vw" />
                    <div className="absolute left-4 top-4 rounded-full bg-white/92 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-pink-500">Featured</div>
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                      <span>{formatDate(featured.publishedAt)}</span>
                      <span>•</span>
                      <span>{featured.readingTimeMinutes} min read</span>
                      <span>•</span>
                      <span className="font-medium text-cyan-700">{featured.topic}</span>
                    </div>
                    <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 md:text-[3.15rem] md:leading-[1.08]">
                      <Link href={`/guides/${featured.slug}`} className="hover:text-pink-600">{featured.title}</Link>
                    </h2>
                    <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">{featured.excerpt}</p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {featured.tags.slice(0, 4).map((tag) => (
                        <span key={tag} className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-600">{tag}</span>
                      ))}
                    </div>
                    <div className="mt-6 flex flex-wrap items-center gap-4">
                      <Link href={`/guides/${featured.slug}`} className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(110deg,#ff4d8c,#ff3b3b,#00c8e6)] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_28px_rgba(255,77,140,0.24)] transition hover:-translate-y-0.5">
                        Read full guide <span aria-hidden>→</span>
                      </Link>
                      <button className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-600">Save for later</button>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            <section>
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-semibold tracking-tight text-slate-900">Latest articles</h3>
                  <p className="mt-1 text-sm text-slate-500">Fresh insights and expert advice</p>
                </div>
                <button className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600">Latest first</button>
              </div>

              {filteredGuides.length === 0 ? (
                <div className="rounded-[1.6rem] border border-dashed border-slate-300 bg-white/80 p-8 text-slate-600">
                  No articles match that search yet.
                </div>
              ) : (
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {(featured ? latest : filteredGuides).map((guide) => (
                    <article key={guide.slug} className="overflow-hidden rounded-[1.6rem] border border-white/80 bg-white/95 shadow-[0_20px_60px_rgba(15,23,42,0.06)] transition hover:-translate-y-1">
                      <div className="relative aspect-[16/10] bg-slate-100">
                        <Image src={guide.heroImage} alt={guide.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" />
                        <span className="absolute left-4 top-4 rounded-full bg-white/92 px-3 py-1 text-xs font-semibold text-cyan-700">{guide.topic}</span>
                      </div>
                      <div className="p-5">
                        <div className="text-sm text-slate-500">{formatDate(guide.publishedAt)} • {guide.readingTimeMinutes} min read</div>
                        <h4 className="mt-3 min-h-[5.75rem] text-xl font-semibold leading-8 tracking-tight text-slate-900">
                          <Link href={`/guides/${guide.slug}`} className="hover:text-pink-600 break-words">{guide.title}</Link>
                        </h4>
                        <p className="mt-3 min-h-[5.5rem] text-sm leading-7 text-slate-600">{guide.excerpt}</p>
                        <div className="mt-4 flex items-center justify-between text-sm">
                          <Link href={`/guides/${guide.slug}`} className="font-medium text-slate-900 hover:text-pink-600">Read article</Link>
                          <span className="text-slate-400">Save</span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-5">
            <section className="rounded-[1.8rem] border border-white/80 bg-white/95 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">Trending now</h3>
                <Link href="/guides" className="text-sm font-medium text-pink-600">View all</Link>
              </div>
              <div className="space-y-4">
                {trending.map((guide, index) => (
                  <Link key={guide.slug} href={`/guides/${guide.slug}`} className="grid grid-cols-[24px_minmax(0,1fr)_72px] items-start gap-3">
                    <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-pink-500 text-xs font-semibold text-white">{index + 1}</div>
                    <div>
                      <div className="text-sm font-semibold leading-6 text-slate-900">{guide.title}</div>
                      <div className="mt-1 text-xs text-slate-500">{formatDate(guide.publishedAt)} • {guide.readingTimeMinutes} min read</div>
                    </div>
                    <div className="relative aspect-square overflow-hidden rounded-2xl bg-slate-100">
                      <Image src={guide.heroImage} alt={guide.title} fill className="object-cover" sizes="72px" />
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            <section className="rounded-[1.8rem] border border-pink-100 bg-[linear-gradient(135deg,rgba(255,77,140,0.12),rgba(0,180,216,0.08))] p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
              <h3 className="text-lg font-semibold text-slate-900">Stay updated</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">Get the latest study abroad tips, scholarships and guides straight to your inbox.</p>
              <div className="mt-4 flex gap-2">
                <input className="min-w-0 flex-1 rounded-2xl border border-white/80 bg-white px-4 py-3 text-sm outline-none" placeholder="Enter your email" />
                <button className="rounded-2xl bg-pink-500 px-4 py-3 text-sm font-semibold text-white">Subscribe</button>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
