'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { HoverPrefetchLink } from '@/components/hover-prefetch-link';
import { useLanguage } from '@/lib/i18n';
import type { GeoGuide } from '@/lib/geo-content';

type Props = {
  guides: GeoGuide[];
  topics: string[];
};

/* ─────────────────────────────────────────────────────────────────────────
   ICONS
───────────────────────────────────────────────────────────────────────── */

type IconProps = { className?: string };

function TopicIcon({ topic, className }: { topic: string; className?: string }) {
  const common = {
    className: className ?? 'h-4 w-4',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (topic) {
    case 'Universities':
      return (<svg {...common}><path d="M3 21h18" /><path d="M5 21V9l7-5 7 5v12" /><path d="M9 21v-6h6v6" /></svg>);
    case 'Applications':
      return (<svg {...common}><path d="M14 3v5h5" /><path d="M5 3h9l5 5v13H5z" /><path d="M9 13h6M9 17h6" /></svg>);
    case 'Scholarships':
      return (<svg {...common}><path d="M22 9 12 5 2 9l10 4 10-4Z" /><path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5" /></svg>);
    case 'Student life':
      return (<svg {...common}><path d="M17 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9.5" cy="7" r="3.5" /><path d="M22 20v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.5a4 4 0 0 1 0 7" /></svg>);
    case 'Visas & immigration':
      return (<svg {...common}><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7Z" /></svg>);
    case 'Careers':
      return (<svg {...common}><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>);
    case 'All topics':
    default:
      return (<svg {...common}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>);
  }
}

function SearchIcon({ className }: IconProps) {
  return (<svg className={className ?? 'h-5 w-5'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>);
}

function BookmarkIcon({ className }: IconProps) {
  return (<svg className={className ?? 'h-4 w-4'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z" /></svg>);
}

function ClockIcon({ className }: IconProps) {
  return (<svg className={className ?? 'h-3.5 w-3.5'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>);
}

function GridIcon({ className }: IconProps) {
  return (<svg className={className ?? 'h-4 w-4'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>);
}

function ListIcon({ className }: IconProps) {
  return (<svg className={className ?? 'h-4 w-4'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>);
}

/* ─────────────────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────────────────── */

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T12:00:00Z`));
}

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

const topicBadgeClasses: Record<string, string> = {
  Universities: 'bg-emerald-100 text-emerald-700',
  Applications: 'bg-blue-100 text-blue-700',
  Scholarships: 'bg-pink-100 text-pink-700',
  'Student life': 'bg-cyan-100 text-cyan-700',
  'Visas & immigration': 'bg-amber-100 text-amber-700',
  Careers: 'bg-violet-100 text-violet-700',
};

function topicBadge(topic: string) {
  return topicBadgeClasses[topic] ?? 'bg-slate-100 text-slate-600';
}

/* ─────────────────────────────────────────────────────────────────────────
   HERO ILLUSTRATION
───────────────────────────────────────────────────────────────────────── */

function HeroIllustration() {
  const nodes: Array<{ key: string; top: string; left: string; tone: string; icon: React.JSX.Element }> = [
    { key: 'cap', top: '6%', left: '34%', tone: 'text-violet-500', icon: <TopicIcon topic="Scholarships" className="h-6 w-6" /> },
    { key: 'doc', top: '30%', left: '92%', tone: 'text-indigo-500', icon: <TopicIcon topic="Applications" className="h-6 w-6" /> },
    { key: 'book', top: '78%', left: '20%', tone: 'text-cyan-500', icon: <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M2 4.5A2.5 2.5 0 0 1 4.5 2H12v18H4.5A2.5 2.5 0 0 0 2 22.5Z" /><path d="M22 4.5A2.5 2.5 0 0 0 19.5 2H12v18h7.5a2.5 2.5 0 0 1 2.5 2.5Z" /></svg> },
    { key: 'bag', top: '76%', left: '88%', tone: 'text-violet-500', icon: <TopicIcon topic="Careers" className="h-6 w-6" /> },
  ];

  return (
    <div className="relative hidden h-[300px] items-center justify-center lg:flex">
      {/* soft glow backdrop */}
      <div className="absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_30%_30%,rgba(255,77,140,0.10),transparent_30%),radial-gradient(circle_at_75%_35%,rgba(0,180,216,0.14),transparent_32%),radial-gradient(circle_at_58%_82%,rgba(125,95,255,0.12),transparent_30%)]" />

      {/* orbit rings + sparkles */}
      <svg className="absolute inset-0 h-full w-full text-fuchsia-300/50" viewBox="0 0 400 300" fill="none" preserveAspectRatio="xMidYMid meet">
        <ellipse cx="200" cy="150" rx="150" ry="120" stroke="currentColor" strokeWidth="1.4" strokeDasharray="3 7" opacity="0.55" />
        <ellipse cx="200" cy="150" rx="110" ry="86" stroke="currentColor" strokeWidth="1.4" strokeDasharray="3 7" opacity="0.4" />
        {[[60, 60], [350, 70], [44, 230], [360, 235], [200, 24]].map(([cx, cy]) => (
          <g key={`${cx}-${cy}`} stroke="currentColor" strokeWidth="1.6" opacity="0.7">
            <path d={`M${cx - 5} ${cy} h10`} /><path d={`M${cx} ${cy - 5} v10`} />
          </g>
        ))}
      </svg>

      {/* globe */}
      <div className="relative flex h-44 w-44 items-center justify-center rounded-full bg-[radial-gradient(circle_at_34%_28%,#eaf1ff,#a9c4ff_46%,#6d7bff_72%,#5b63ff_100%)] shadow-[0_28px_60px_rgba(88,86,214,0.28)]">
        <svg className="h-44 w-44 text-white/55" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1">
          <circle cx="50" cy="50" r="38" />
          <ellipse cx="50" cy="50" rx="16" ry="38" />
          <ellipse cx="50" cy="50" rx="32" ry="38" />
          <path d="M14 38h72M14 62h72M18 26h64M18 74h64" />
        </svg>
        {/* continents */}
        <svg className="absolute h-32 w-32 text-white/85" viewBox="0 0 100 100" fill="currentColor">
          <path d="M30 34c6-3 14-2 16 2s-3 8-8 9-12 0-13-4 0-5 5-7Z" opacity="0.85" />
          <path d="M55 44c7-1 13 3 12 8s-8 9-14 8-9-6-6-11 3-4 8-5Z" opacity="0.8" />
          <path d="M40 62c4-1 8 1 8 4s-4 5-8 4-5-3-3-6Z" opacity="0.7" />
        </svg>
      </div>

      {/* floating icon nodes */}
      {nodes.map((node) => (
        <div
          key={node.key}
          className={classNames('absolute flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl border border-white bg-white shadow-[0_14px_34px_rgba(15,23,42,0.12)]', node.tone)}
          style={{ top: node.top, left: node.left }}
        >
          {node.icon}
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   PAGE
───────────────────────────────────────────────────────────────────────── */

export default function NewsPageClient({ guides, topics }: Props) {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [activeTopic, setActiveTopic] = useState('All topics');
  const [view, setView] = useState<'grid' | 'list'>('grid');

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

  const visibleTopics = topics.slice(0, 7);
  const overflowTopics = topics.slice(7);
  const cards = featured ? latest : filteredGuides;

  return (
    <main className="app-page-shell" data-no-auto-translate>
      <div className="mx-auto w-full max-w-[84rem] space-y-6">
        {/* HERO */}
        <section className="overflow-hidden rounded-[2rem] border border-white/80 bg-white/90 px-6 py-7 shadow-[0_24px_80px_rgba(15,23,42,0.08)] md:px-10 md:py-9">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-fuchsia-500">{t('Glowbal News & Guides')}</p>
              <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-slate-900 md:text-6xl md:leading-[1.05]">
                {t('Insights to help you study abroad')}{' '}
                <span className="bg-[linear-gradient(110deg,#ff4d8c,#ff2d7e)] bg-clip-text text-transparent">{t('smarter')}</span>
              </h1>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
                {t('Expert insights, real student stories, and practical guides to help you plan, apply, and succeed.')}
              </p>

              <div className="mt-7 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                <label className="group flex min-h-14 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 shadow-sm transition focus-within:border-cyan-300 focus-within:shadow-[0_0_0_4px_rgba(34,211,238,0.12)]">
                  <SearchIcon className="h-5 w-5 text-slate-400" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t('Search articles, topics or universities...')}
                    className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                  />
                </label>
                <button className="flex min-h-14 items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 shadow-sm">
                  <span>{t(activeTopic)}</span>
                  <svg className="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                </button>
              </div>
            </div>

            <HeroIllustration />
          </div>
        </section>

        {/* TOPIC FILTERS */}
        <section className="flex flex-wrap items-center gap-3 rounded-[1.6rem] border border-white/80 bg-white/80 p-3 shadow-[0_20px_60px_rgba(15,23,42,0.05)]">
          {visibleTopics.map((topic) => {
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
                <TopicIcon topic={topic} className="h-4 w-4" />
                {t(topic)}
              </button>
            );
          })}
          {overflowTopics.length > 0 ? (
            <button type="button" className="ml-auto inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 hover:border-slate-300">
              {t('More')}
              <svg className="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
            </button>
          ) : null}
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            {/* FEATURED */}
            {featured ? (
              <section className="rounded-[2rem] border border-white/80 bg-white/95 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.08)] md:p-5">
                <div className="grid gap-6 lg:grid-cols-[0.95fr_1.15fr] lg:items-center">
                  <div className="relative aspect-[5/4] overflow-hidden rounded-[1.5rem] bg-slate-100">
                    <Image src={featured.heroImage} alt={featured.title} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 40vw" />
                    <div className="absolute left-4 top-4 rounded-full bg-white/92 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-pink-500">{t('Featured')}</div>
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                      <span>{formatDate(featured.publishedAt)}</span>
                      <span>•</span>
                      <span>{t('{minutes} min read', { minutes: featured.readingTimeMinutes })}</span>
                      <span>•</span>
                      <span className="font-medium text-cyan-700">{t(featured.topic)}</span>
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
                        {t('Read full guide')} <span aria-hidden>→</span>
                      </Link>
                      <button className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-600 hover:border-slate-300">
                        <BookmarkIcon className="h-4 w-4" /> {t('Save for later')}
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            {/* LATEST ARTICLES */}
            <section>
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-semibold tracking-tight text-slate-900">{t('Latest articles')}</h3>
                  <p className="mt-1 text-sm text-slate-500">{t('Fresh insights and expert advice')}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600">
                    {t('Latest first')}
                    <svg className="h-3.5 w-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                  </button>
                  <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1">
                    <button
                      type="button"
                      aria-label="Grid view"
                      onClick={() => setView('grid')}
                      className={classNames('flex h-8 w-8 items-center justify-center rounded-full transition', view === 'grid' ? 'bg-pink-50 text-pink-600' : 'text-slate-400 hover:text-slate-600')}
                    >
                      <GridIcon className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="List view"
                      onClick={() => setView('list')}
                      className={classNames('flex h-8 w-8 items-center justify-center rounded-full transition', view === 'list' ? 'bg-pink-50 text-pink-600' : 'text-slate-400 hover:text-slate-600')}
                    >
                      <ListIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {cards.length === 0 ? (
                <div className="rounded-[1.6rem] border border-dashed border-slate-300 bg-white/80 p-8 text-slate-600">
                  {t('No articles match that search yet.')}
                </div>
              ) : view === 'grid' ? (
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                  {cards.map((guide) => (
                    <article key={guide.slug} className="group flex flex-col overflow-hidden rounded-[1.5rem] border border-white/80 bg-white/95 shadow-[0_20px_60px_rgba(15,23,42,0.06)] transition hover:-translate-y-1 hover:shadow-[0_28px_70px_rgba(15,23,42,0.10)]">
                      <div className="relative aspect-[16/11] bg-slate-100">
                        <Image src={guide.heroImage} alt={guide.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 22vw" />
                        <span className={classNames('absolute bottom-3 left-3 rounded-full px-2.5 py-1 text-[11px] font-semibold', topicBadge(guide.topic))}>{t(guide.topic)}</span>
                      </div>
                      <div className="flex flex-1 flex-col p-4">
                        <div className="text-xs text-slate-500">{formatDate(guide.publishedAt)} • {t('{minutes} min read', { minutes: guide.readingTimeMinutes })}</div>
                        <h4 className="mt-2 text-[15px] font-semibold leading-6 tracking-tight text-slate-900">
                          <Link href={`/guides/${guide.slug}`} className="break-words hover:text-pink-600">{guide.title}</Link>
                        </h4>
                        <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{guide.excerpt}</p>
                        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
                          <button className="inline-flex items-center gap-1.5 font-medium text-slate-500 hover:text-pink-600">
                            <BookmarkIcon className="h-4 w-4" /> {t('Save')}
                          </button>
                          <Link href={`/guides/${guide.slug}`} className="font-medium text-pink-600 opacity-0 transition group-hover:opacity-100">{t('Read')} →</Link>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {cards.map((guide) => (
                    <article key={guide.slug} className="flex gap-4 overflow-hidden rounded-[1.5rem] border border-white/80 bg-white/95 p-3 shadow-[0_20px_60px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5">
                      <div className="relative aspect-[4/3] w-44 shrink-0 overflow-hidden rounded-[1.1rem] bg-slate-100">
                        <Image src={guide.heroImage} alt={guide.title} fill className="object-cover" sizes="176px" />
                        <span className={classNames('absolute bottom-2 left-2 rounded-full px-2.5 py-1 text-[11px] font-semibold', topicBadge(guide.topic))}>{t(guide.topic)}</span>
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col justify-center">
                        <div className="text-xs text-slate-500">{formatDate(guide.publishedAt)} • {t('{minutes} min read', { minutes: guide.readingTimeMinutes })}</div>
                        <h4 className="mt-1.5 text-lg font-semibold leading-7 tracking-tight text-slate-900">
                          <Link href={`/guides/${guide.slug}`} className="hover:text-pink-600">{guide.title}</Link>
                        </h4>
                        <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-slate-600">{guide.excerpt}</p>
                        <div className="mt-3 flex items-center gap-4 text-sm">
                          <Link href={`/guides/${guide.slug}`} className="font-medium text-pink-600 hover:text-pink-700">{t('Read article')} →</Link>
                          <button className="inline-flex items-center gap-1.5 font-medium text-slate-500 hover:text-pink-600">
                            <BookmarkIcon className="h-4 w-4" /> {t('Save')}
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {cards.length > 0 ? (
                <div className="mt-8 flex justify-center">
                  <Link href="/guides" className="inline-flex items-center gap-2 rounded-full border border-pink-200 bg-white px-6 py-3 text-sm font-semibold text-pink-600 shadow-sm transition hover:bg-pink-50">
                    {t('View all articles')}
                  </Link>
                </div>
              ) : null}
            </section>
          </div>

          {/* SIDEBAR */}
          <aside className="space-y-5">
            <section className="rounded-[1.8rem] border border-white/80 bg-white/95 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">{t('Trending now')}</h3>
                <Link href="/guides" className="text-sm font-medium text-pink-600">{t('View all')}</Link>
              </div>
              <div className="space-y-4">
                {trending.map((guide, index) => (
                  <Link key={guide.slug} href={`/guides/${guide.slug}`} className="group grid grid-cols-[24px_minmax(0,1fr)_64px] items-start gap-3">
                    <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-pink-500 text-xs font-semibold text-white">{index + 1}</div>
                    <div>
                      <div className="text-sm font-semibold leading-6 text-slate-900 group-hover:text-pink-600">{guide.title}</div>
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                        <ClockIcon className="h-3.5 w-3.5" />
                        {formatDate(guide.publishedAt)} • {t('{minutes} min read', { minutes: guide.readingTimeMinutes })}
                      </div>
                    </div>
                    <div className="relative aspect-square overflow-hidden rounded-2xl bg-slate-100">
                      <Image src={guide.heroImage} alt={guide.title} fill className="object-cover" sizes="64px" />
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            <NewsletterCard />
          </aside>
        </div>
      </div>
    </main>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   NEWSLETTER CARD
───────────────────────────────────────────────────────────────────────── */

export function NewsletterCard() {
  const { t } = useLanguage();
  const [email, setEmail] = React.useState('');
  const [status, setStatus] = React.useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = React.useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes('@')) {
      setStatus('error');
      setMessage('Please enter a valid email address');
      return;
    }

    setStatus('loading');
    setMessage('');

    try {
      const response = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'news_page' }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        setMessage(data.alreadySubscribed ? 'You\'re already subscribed!' : 'Successfully subscribed! Check your email.');
        setEmail('');
      } else {
        setStatus('error');
        setMessage(data.error || 'Something went wrong. Please try again.');
      }
    } catch (error) {
      setStatus('error');
      setMessage('Failed to subscribe. Please try again.');
    }
  };
  return (
    <section className="relative overflow-hidden rounded-[1.8rem] border border-pink-100 bg-[linear-gradient(135deg,rgba(255,77,140,0.12),rgba(0,180,216,0.08))] p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
      <div className="pointer-events-none absolute -right-3 -top-3 text-3xl opacity-80" aria-hidden>✦</div>
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm">
          <svg className="h-6 w-6 text-pink-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{t('Stay updated')}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">{t('Get the latest study abroad tips, scholarships and guides straight to your inbox.')}</p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="mt-4">
        <div className="flex gap-2">
          <input 
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={status === 'loading' || status === 'success'}
            className="min-w-0 flex-1 rounded-2xl border border-white/80 bg-white px-4 py-3 text-sm outline-none disabled:opacity-50" 
            placeholder={t('Enter your email')}
            required
          />
          <button 
            type="submit"
            disabled={status === 'loading' || status === 'success'}
            className="rounded-2xl bg-pink-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === 'loading' ? t('Subscribing...') : status === 'success' ? t('✓ Subscribed') : t('Subscribe')}
          </button>
        </div>
        {message && (
          <p className={`mt-2 text-xs ${status === 'error' ? 'text-red-600' : 'text-green-600'}`}>
            {message}
          </p>
        )}
      </form>
    </section>
  );
}
