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
  Career: '▣',
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
      const haystack = `${guide.title} ${guide.excerpt} ${guide.topic}`.toLowerCase();
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
  const popularGuides = [...guides].slice(0, 3);

  return (
    <main className="app-page-shell">
      <div className="app-page-container space-y-8">
        <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/75 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur md:p-8">
          <div className="grid gap-8 lg:grid-cols-[1.55fr_0.85fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-600">Glowbal editorial</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl">
                <span className="glowbal-wordmark">Glowbal</span> News &amp; Guides
              </h1>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
                Expert insights, real student stories, and generated study-abroad guides to help students stay ahead of the curve.
              </p>

              <div className="mt-6 flex flex-col gap-3 md:flex-row">
                <label className="group flex min-h-14 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 shadow-sm transition focus-within:border-cyan-300 focus-within:shadow-[0_0_0_4px_rgba(34,211,238,0.12)]">
                  <svg className="h-5 w-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search articles, topics or universities..."
                    className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                  />
                </label>
                <div className="flex min-h-14 items-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 shadow-sm md:min-w-44">
                  {activeTopic}
                </div>
              </div>
            </div>

            <div className="relative hidden min-h-[230px] items-center justify-center lg:flex">
              <div className="absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_30%_30%,rgba(255,77,140,0.14),transparent_26%),radial-gradient(circle_at_75%_35%,rgba(0,180,216,0.18),transparent_24%),radial-gradient(circle_at_58%_82%,rgba(30,42,120,0.12),transparent_26%)]" />
              <div className="relative flex h-48 w-48 items-center justify-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#dff5ff,#9dd6ff_48%,#2f6bff_70%,#1e2a78_100%)] shadow-[0_24px_50px_rgba(30,42,120,0.18)]">
                <div className="absolute inset-5 rounded-full border border-white/30" />
                <div className="absolute inset-10 rounded-full border border-white/20" />
                <div className="h-28 w-28 rounded-full bg-white/18 blur-2xl" />
              </div>
              {['🎓', '📘', '📝', '🧳'].map((emoji, index) => (
                <div
                  key={emoji}
                  className="absolute flex h-14 w-14 items-center justify-center rounded-full border border-white/80 bg-white text-xl shadow-lg"
                  style={{
                    top: ['10%', '58%', '16%', '58%'][index],
                    left: ['6%', '18%', '76%', '80%'][index],
                  }}
                >
                  {emoji}
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="flex flex-wrap gap-3">
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
                    : 'border-white/80 bg-white/85 text-slate-600 hover:border-slate-200 hover:text-slate-900'
                )}
              >
                <span>{topicIcons[topic] ?? '•'}</span>
                {topic}
              </button>
            );
          })}
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-8">
            {featured ? (
              <section className="overflow-hidden rounded-[2rem] border border-white/75 bg-white/90 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.08)] md:p-5">
                <div className="grid gap-6 lg:grid-cols-[1.05fr_1.35fr] lg:items-center">
                  <div className="relative overflow-hidden rounded-[1.6rem] bg-slate-100 aspect-[16/11]">
                    <Image src={featured.heroImage} alt={featured.title} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 44vw" />
                    <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-pink-500">Featured article</div>
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                      <span>{formatDate(featured.publishedAt)}</span>
                      <span>•</span>
                      <span>{featured.readingTimeMinutes} min read</span>
                      <span>•</span>
                      <span>{featured.topic}</span>
                    </div>
                    <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
                      <Link href={`/guides/${featured.slug}`} className="hover:text-pink-600">{featured.title}</Link>
                    </h2>
                    <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">{featured.excerpt}</p>
                    <div className="mt-6 flex flex-wrap items-center gap-4">
                      <Link href={`/guides/${featured.slug}`} className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(110deg,#ff4d8c,#ff3b3b,#00c8e6)] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_28px_rgba(255,77,140,0.24)] transition hover:-translate-y-0.5">
                        Read full guide <span aria-hidden>→</span>
                      </Link>
                      <span className="text-sm text-slate-500">{featured.status === 'published' ? 'Published live' : 'Draft live for testing'}</span>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            <section>
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-semibold tracking-tight text-slate-900">Latest articles</h3>
                  <p className="mt-1 text-sm text-slate-500">{filteredGuides.length} articles matching your view</p>
                </div>
              </div>

              {filteredGuides.length === 0 ? (
                <div className="rounded-[1.6rem] border border-dashed border-slate-300 bg-white/80 p-8 text-slate-600">
                  No articles match that search yet.
                </div>
              ) : (
                <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
                  {(featured ? latest : filteredGuides).map((guide) => (
                    <article key={guide.slug} className="overflow-hidden rounded-[1.75rem] border border-white/80 bg-white/90 shadow-[0_20px_60px_rgba(15,23,42,0.06)] transition hover:-translate-y-1">
                      <div className="relative aspect-[16/10] bg-slate-100">
                        <Image src={guide.heroImage} alt={guide.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" />
                        <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-cyan-700">{guide.topic}</span>
                      </div>
                      <div className="p-5">
                        <div className="text-sm text-slate-500">{formatDate(guide.publishedAt)} • {guide.readingTimeMinutes} min read</div>
                        <h4 className="mt-3 line-clamp-2 text-xl font-semibold tracking-tight text-slate-900">
                          <Link href={`/guides/${guide.slug}`} className="hover:text-pink-600">{guide.title}</Link>
                        </h4>
                        <p className="mt-3 line-clamp-3 text-sm leading-7 text-slate-600">{guide.excerpt}</p>
                        <div className="mt-4 flex items-center justify-between text-sm">
                          <Link href={`/guides/${guide.slug}`} className="font-medium text-slate-900 hover:text-pink-600">Read article</Link>
                          <span className="text-slate-400">{guide.status === 'published' ? 'published' : 'draft live'}</span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-5">
            <section className="rounded-[1.8rem] border border-white/80 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
              <h3 className="text-lg font-semibold text-slate-900">Trending now</h3>
              <div className="mt-4 space-y-4">
                {trending.map((guide, index) => (
                  <Link key={guide.slug} href={`/guides/${guide.slug}`} className="grid grid-cols-[24px_minmax(0,1fr)_72px] items-center gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-pink-500 text-xs font-semibold text-white">{index + 1}</div>
                    <div>
                      <div className="line-clamp-2 text-sm font-medium text-slate-900">{guide.title}</div>
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
              <p className="mt-2 text-sm leading-6 text-slate-600">Get the latest study abroad tips, scholarship news and fresh guides straight to your inbox.</p>
              <div className="mt-4 flex gap-2">
                <input className="min-w-0 flex-1 rounded-2xl border border-white/80 bg-white px-4 py-3 text-sm outline-none" placeholder="Enter your email" />
                <button className="rounded-2xl bg-pink-500 px-4 py-3 text-sm font-semibold text-white">Subscribe</button>
              </div>
            </section>

            <section className="rounded-[1.8rem] border border-white/80 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
              <h3 className="text-lg font-semibold text-slate-900">Popular guides</h3>
              <div className="mt-4 space-y-4">
                {popularGuides.map((guide) => (
                  <Link key={guide.slug} href={`/guides/${guide.slug}`} className="flex items-center gap-3">
                    <div className="relative h-14 w-14 overflow-hidden rounded-2xl bg-slate-100">
                      <Image src={guide.heroImage} alt={guide.title} fill className="object-cover" sizes="56px" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-900">{guide.title}</div>
                      <div className="mt-1 text-xs text-slate-500">{guide.topic}</div>
                    </div>
                  </Link>
                ))}
              </div>
              <Link href="/guides" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-pink-600">Explore all guides <span aria-hidden>→</span></Link>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
