'use client';

import Link from 'next/link';
import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { officialWebsite } from '@/features/universities/domain';
import { useExplorer, type ExplorerUniversity } from '@/lib/explorer-context';
import type { UniversityScholarship } from '@/lib/explorer-utils';
import { FUNDING_TYPE_LABELS } from '@/lib/scholarships';
import { AutoTranslate } from '@/lib/use-auto-translate';
import { FadeInImage } from './fade-in-image';
import { COUNTRY_FLAGS } from './explorer-constants';

/* ─────────────────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────────────────── */

function extractFoundedYear(uni: ExplorerUniversity): number | null {
  const haystack = `${uni.notes ?? ''} ${uni.specific_insight ?? ''} ${uni.strengths ?? ''}`;
  const match = haystack.match(/\b(?:founded|established)\s+(?:in\s+)?(\d{3,4})\b/i);
  if (match) {
    const year = parseInt(match[1], 10);
    if (year > 800 && year <= new Date().getFullYear()) return year;
  }
  return null;
}

// The lookup itself now lives in features/universities/domain/websites.ts so the
// saved list (/my-universities) shares one copy of it.
function guessWebsite(uni: ExplorerUniversity): string | null {
  return officialWebsite(uni.name);
}

/**
 * Build the destination for "Find a Course". This ALWAYS returns a usable URL
 * to the university's course/programs search:
 *   - if we know the official site, a Google site-search constrained to it
 *   - otherwise a Google search for "<university> courses programs"
 * so the button never dead-ends regardless of which university it is.
 */
function buildCourseSearchUrl(uni: ExplorerUniversity): string {
  const keywords = 'courses programs catalogue';
  const site = guessWebsite(uni);
  if (site) {
    const domain = site.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return `https://www.google.com/search?q=${encodeURIComponent(`${uni.name} ${keywords}`)}+site%3A${encodeURIComponent(domain)}`;
  }
  return `https://www.google.com/search?q=${encodeURIComponent(`${uni.name} ${keywords}`)}`;
}

function deriveWhyBullets(uni: ExplorerUniversity): string[] {
  const out: string[] = [];
  const splitter = /[,;·]+/;
  const fromStrengths = (uni.strengths ?? '')
    .split(splitter)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 2);
  for (const s of fromStrengths) out.push(s);
  if (uni.industry_connections?.trim()) out.push(`Industry connections: ${uni.industry_connections.split(splitter)[0].trim()}`);
  if (uni.employability?.trim()) out.push(`Employability: ${uni.employability.split(splitter)[0].trim()}`);
  if (uni.scholarship && !/none|n\/a|—/i.test(uni.scholarship)) {
    out.push(`Scholarships available — ${uni.scholarship.split(splitter)[0].trim().toLowerCase()}`);
  }
  return out
    .map((s) => s.replace(/^(strong|excellent|leading|world-class)\s+/i, '').trim())
    .filter(Boolean)
    .map((s) => (s.length > 110 ? `${s.slice(0, 108).trim()}…` : s))
    .slice(0, 5);
}

function shortName(name: string): string {
  return name
    .replace(/^The\s+/i, '')
    .replace(/^University of /i, '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim();
}

/* ─────────────────────────────────────────────────────────────────────────
   HEADER BAR
───────────────────────────────────────────────────────────────────────── */

function DetailHeaderBar({
  saved,
  onSave,
  onShare,
  onBack,
}: {
  saved: boolean;
  onSave: () => void;
  onShare: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 text-sm">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-slate-500 transition hover:text-slate-900"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
        </svg>
        Back to search results
      </button>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onShare}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          Share
        </button>
        <button
          type="button"
          onClick={onSave}
          aria-pressed={saved}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
            saved ? 'bg-pink-50 text-pink-700 hover:bg-pink-100' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill={saved ? '#ec4899' : 'none'} stroke={saved ? '#ec4899' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          {saved ? 'Saved' : 'Save'}
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   HERO
───────────────────────────────────────────────────────────────────────── */

function DetailHero({
  university,
  saved,
  onToggleSave,
}: {
  university: ExplorerUniversity;
  saved: boolean;
  onToggleSave: () => void;
}) {
  const flag = COUNTRY_FLAGS[university.country] ?? '🎓';
  const founded = extractFoundedYear(university);

  return (
    <section className="relative overflow-hidden rounded-[1.75rem] border border-black/5 shadow-[0_12px_32px_rgba(22,33,62,0.10)]">
      <div className="relative h-[360px] w-full md:h-[420px]" style={{ background: `linear-gradient(135deg, ${university.color}, #1a1a2e)` }}>
        {university.image_url ? (
          <FadeInImage src={university.image_url} alt={`${university.name} campus`} className="absolute inset-0 h-full w-full object-cover" />
        ) : null}
        <div aria-hidden className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(15,23,42,0.20) 0%, rgba(15,23,42,0.06) 25%, rgba(15,23,42,0.78) 100%)' }} />

        <button
          type="button"
          onClick={onToggleSave}
          aria-pressed={saved}
          aria-label={saved ? 'Remove from saved' : 'Save university'}
          className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-slate-500 shadow-sm backdrop-blur transition hover:scale-110 hover:text-pink-500 md:right-7 md:top-7"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill={saved ? '#ec4899' : 'none'} stroke={saved ? '#ec4899' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>

        <div className="absolute bottom-0 left-0 right-0 p-5 md:p-7">
          <div className="flex max-w-[680px] flex-col gap-3">
            {university.logo_url ? (
              <div className="flex h-20 w-20 items-center justify-center rounded-[1.25rem] border border-white/40 bg-white/95 p-2.5 shadow-[0_10px_24px_rgba(15,23,42,0.18)] backdrop-blur md:h-24 md:w-24 md:p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={university.logo_url} alt={`${university.name} crest`} className="h-full w-full object-contain" />
              </div>
            ) : null}

            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white drop-shadow md:text-[2rem]">{university.name}</h1>
              {university.local_name ? <p className="mt-1 text-sm text-white/80 md:text-base">{university.local_name}</p> : null}
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-medium text-white/85 md:text-sm">
                <span className="inline-flex items-center gap-1.5"><span aria-hidden>{flag}</span>{university.location}</span>
                {university.type ? <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-1 w-1 rounded-full bg-white/50" />{university.type} University</span> : null}
                {founded ? <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-1 w-1 rounded-full bg-white/50" />Founded in {founded}</span> : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {university.match_score != null ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50/95 px-3 py-1 text-xs font-bold text-amber-700 shadow-sm backdrop-blur">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                  {university.match_score}% match
                </span>
              ) : null}
              {university.qs_rank ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50/95 px-3 py-1 text-xs font-bold text-sky-700 shadow-sm backdrop-blur">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="8" r="6" /><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" /></svg>
                  #{university.qs_rank} QS World Ranking
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   STICKY ACTION TOOLBAR (section links + page actions, under the hero)
───────────────────────────────────────────────────────────────────────── */

function DetailToolbar({
  items,
  website,
  saved,
  onSave,
  onShare,
  onFindCourse,
}: {
  items: { id: string; label: string }[];
  website: string | null;
  saved: boolean;
  onSave: () => void;
  onShare: () => void;
  onFindCourse: () => void;
}) {
  return (
    <nav
      aria-label="University sections and actions"
      className="sticky top-2 z-30 rounded-2xl border border-slate-200 bg-white/95 shadow-[0_6px_18px_rgba(15,23,42,0.06)] backdrop-blur"
    >
      <div className="flex flex-col gap-2 p-2 lg:flex-row lg:items-center">
        {/* Section anchor links */}
        {items.length > 1 ? (
          <ul className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {items.map((it) => (
              <li key={it.id}>
                <a
                  href={`#${it.id}`}
                  className="block shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  {it.label}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <span className="flex-1" />
        )}

        {/* Page actions */}
        <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={onShare}
            aria-label="Share"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onSave}
            aria-pressed={saved}
            className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition ${
              saved ? 'bg-pink-50 text-pink-700 hover:bg-pink-100' : 'border border-slate-200 bg-white text-slate-700 hover:border-pink-300 hover:text-pink-600'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill={saved ? '#ec4899' : 'none'} stroke={saved ? '#ec4899' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            {saved ? 'Saved' : 'Save'}
          </button>
          {website ? (
            <a
              href={website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 transition hover:border-pink-300 hover:text-pink-600"
            >
              Official site
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
            </a>
          ) : null}
          <button
            type="button"
            onClick={onFindCourse}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] px-4 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(255,77,140,0.25)] transition hover:-translate-y-0.5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /></svg>
            View courses
          </button>
        </div>
      </div>
    </nav>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   AT-A-GLANCE CIRCLES — clickable stat badges that jump to a detail section
───────────────────────────────────────────────────────────────────────── */

/**
 * Compact a verbose money/stat string into something that fits inside a small
 * circle. Pulls the leading currency symbol and the first one or two numbers
 * and abbreviates thousands to "k" — e.g.
 *   "€10,000–15,000/yr ≈ $11,000–17,000" → "€10k–15k"
 *   "$57,054"                            → "$57k"
 * Falls back to a clamped version of the original when it can't parse a number.
 */
function compactAmount(value: string): string {
  const currency = value.match(/[$€£¥₫]/)?.[0] ?? '';
  const nums = (value.match(/\d[\d,]*/g) ?? [])
    .map((s) => Number(s.replace(/,/g, '')))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (nums.length === 0) return value.length > 8 ? `${value.slice(0, 7)}…` : value;
  const k = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`);
  if (nums.length >= 2) return `${currency}${k(nums[0])}–${k(nums[1])}`;
  return `${currency}${k(nums[0])}`;
}

function GlanceCircles({ university, website }: { university: ExplorerUniversity; website: string | null }) {
  const circles: Array<{ value: string; full: string; label: string; href: string }> = [];
  if (university.qs_rank) {
    circles.push({
      value: `#${university.qs_rank}`,
      full: `#${university.qs_rank} QS World Ranking`,
      label: 'QS Ranking',
      href: '#rankings',
    });
  }
  if (university.tuition_usd) {
    circles.push({
      value: compactAmount(university.tuition_usd),
      full: university.tuition_usd,
      label: 'Tuition fee',
      href: '#funding',
    });
  }
  if (circles.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-6 py-1 sm:justify-start sm:gap-10">
      {circles.map((c) => (
        <a
          key={c.label}
          href={c.href}
          title={c.full}
          aria-label={`${c.label} ${c.value} — jump to details`}
          className="group flex h-32 w-32 flex-col items-center justify-center rounded-full border-2 border-pink-200 bg-gradient-to-br from-pink-50 to-white text-center shadow-[0_8px_22px_rgba(255,77,140,0.16)] transition hover:-translate-y-1 hover:border-pink-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-300 focus-visible:ring-offset-2 sm:h-36 sm:w-36"
        >
          <span className="px-2 text-2xl font-bold leading-tight text-pink-600 sm:text-[1.7rem]">{c.value}</span>
          <span className="mt-1 px-3 text-xs font-medium text-slate-600">{c.label}</span>
        </a>
      ))}
      {website ? (
        <a
          href={website}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-slate-400 transition hover:text-pink-600"
        >
          Visit official website ↗
        </a>
      ) : null}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   SCHOLARSHIP BANNER — full-width CTA to this university's scholarships
───────────────────────────────────────────────────────────────────────── */

function ScholarshipBanner({ university }: { university: ExplorerUniversity }) {
  return (
    <Link
      href={`/scholarships?university=${university.id}`}
      className="group relative flex items-center justify-between gap-4 overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] px-6 py-7 shadow-[0_10px_28px_rgba(255,77,140,0.28)] transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-300 focus-visible:ring-offset-2 md:px-8 md:py-8"
    >
      <span aria-hidden className="pointer-events-none absolute -right-4 -top-6 text-[6.5rem] opacity-20 transition group-hover:scale-110">🎓</span>
      <span className="relative text-lg font-bold leading-snug text-white md:text-2xl">
        Are you interested? Let&apos;s discover scholarship for this university!
      </span>
      <span aria-hidden className="relative shrink-0 text-2xl font-bold text-white transition group-hover:translate-x-1 md:text-3xl">→</span>
    </Link>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   RELOCATED CARDS — moved out of the old right rail into the main column
───────────────────────────────────────────────────────────────────────── */

function WhyChooseCard({ university, whyBullets }: { university: ExplorerUniversity; whyBullets: string[] }) {
  if (whyBullets.length < 3) return null;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_14px_rgba(15,23,42,0.04)]">
      <h3 className="text-base font-semibold text-slate-900">Why students choose {shortName(university.name)}</h3>
      <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
        {whyBullets.map((bullet, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600">
            <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </span>
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MentorCard({ university }: { university: ExplorerUniversity }) {
  return (
    <div className="rounded-2xl border border-pink-100 bg-gradient-to-br from-pink-50/60 to-cyan-50/50 p-5">
      <h3 className="text-base font-semibold text-slate-900">Talk to someone who studied here</h3>
      <p className="mt-1 text-sm leading-relaxed text-slate-500">
        Book a 1-on-1 with a current student or alum for honest advice on applications and campus life.
      </p>
      <Link
        href={`/mentors?university=${university.id}`}
        className="mt-3 inline-flex items-center gap-1 rounded-full border border-pink-300 bg-white px-4 py-1.5 text-xs font-semibold text-pink-600 transition hover:bg-pink-50"
      >
        Find a mentor
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
      </Link>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   SECTION PRIMITIVES
───────────────────────────────────────────────────────────────────────── */

function SectionCard({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_4px_14px_rgba(15,23,42,0.04)]">
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2.5 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="max-w-[60%] text-right text-sm font-medium text-slate-900">
        <AutoTranslate text={value} />
      </span>
    </div>
  );
}

function DetailHighlightTile({
  icon,
  value,
  label,
  accent,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  accent: 'pink' | 'amber' | 'emerald';
}) {
  const ACCENT = {
    pink: { bg: 'from-pink-50 to-pink-100/40', iconBg: 'bg-pink-100/70', iconText: 'text-pink-600' },
    amber: { bg: 'from-amber-50 to-amber-100/40', iconBg: 'bg-amber-100/70', iconText: 'text-amber-600' },
    emerald: { bg: 'from-emerald-50 to-emerald-100/40', iconBg: 'bg-emerald-100/70', iconText: 'text-emerald-600' },
  } as const;
  const a = ACCENT[accent];
  return (
    <div className={`flex items-center gap-3 rounded-2xl border border-slate-200 bg-gradient-to-br ${a.bg} p-4 shadow-[0_4px_14px_rgba(15,23,42,0.04)]`} title={value}>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${a.iconBg} ${a.iconText}`}>{icon}</span>
      <div className="min-w-0">
        <p className="line-clamp-2 text-sm font-semibold text-slate-900">{value}</p>
        <p className="text-[0.7rem] text-slate-500">{label}</p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   SECTIONS
───────────────────────────────────────────────────────────────────────── */

function AboutSection({ university }: { university: ExplorerUniversity }) {
  const facts: Array<{ label: string; value: string }> = [];
  if (university.international_environment) facts.push({ label: 'International environment', value: university.international_environment });
  if (university.teaching_style) facts.push({ label: 'Teaching style', value: university.teaching_style });
  if (university.housing) facts.push({ label: 'Housing', value: university.housing });
  if (university.type) facts.push({ label: 'Institution type', value: `${university.type} University` });

  return (
    <SectionCard id="about" title={`About ${shortName(university.name)}`}>
      {university.description ? (
        <p className="text-sm leading-relaxed text-slate-600">
          <AutoTranslate text={university.description} />
        </p>
      ) : (
        <p className="text-sm leading-relaxed text-slate-500">
          We&apos;re still gathering an editorial summary for {university.name}. Check the official
          website for the latest information.
        </p>
      )}

      {facts.length > 0 ? (
        <div className="mt-4 border-t border-slate-100 pt-2">
          {facts.map((f) => <InfoRow key={f.label} label={f.label} value={f.value} />)}
        </div>
      ) : null}
    </SectionCard>
  );
}

function AdmissionsSection({ university }: { university: ExplorerUniversity }) {
  const tiles = [
    {
      accent: 'emerald' as const,
      label: 'Acceptance rate',
      value: university.accept_rate ?? '—',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 17 9 11 13 15 21 7" /><polyline points="14 7 21 7 21 14" /></svg>,
    },
    {
      accent: 'pink' as const,
      label: 'Application deadline',
      value: university.application_deadline ?? '—',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
    },
    {
      accent: 'amber' as const,
      label: 'Admission difficulty',
      value: university.admission_difficulty ?? '—',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4l3-9 4 18 3-9h4" /></svg>,
    },
  ];

  return (
    <SectionCard id="admissions" title="Admissions & requirements">
      <div className="grid gap-3 sm:grid-cols-3">
        {tiles.map((t) => <DetailHighlightTile key={t.label} {...t} />)}
      </div>

      {university.requirements.length > 0 ? (
        <ul className="mt-5 space-y-2.5">
          {university.requirements.map((req) => (
            <li key={req} className="flex items-start gap-2.5 text-sm text-slate-600">
              <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </span>
              <AutoTranslate text={req} />
            </li>
          ))}
        </ul>
      ) : null}
    </SectionCard>
  );
}

function CareersSection({ university }: { university: ExplorerUniversity }) {
  const rows: Array<{ label: string; value: string }> = [];
  if (university.industry_connections) rows.push({ label: 'Industry connections', value: university.industry_connections });
  if (university.internship_coop) rows.push({ label: 'Internships & co-op', value: university.internship_coop });
  if (university.employability) rows.push({ label: 'Employability', value: university.employability });
  if (university.best_for) rows.push({ label: 'Best for', value: university.best_for });
  if (rows.length === 0) return null;
  return (
    <SectionCard id="careers" title="Careers & outcomes">
      <div className="border-t border-slate-100">
        {rows.map((r) => <InfoRow key={r.label} label={r.label} value={r.value} />)}
      </div>
    </SectionCard>
  );
}

function RankingsSection({ university }: { university: ExplorerUniversity }) {
  const ranks: Array<{ label: string; value: string }> = [];
  if (university.qs_rank) ranks.push({ label: 'QS World Ranking', value: `#${university.qs_rank}` });
  if (university.the_rank) ranks.push({ label: 'THE Ranking', value: `#${university.the_rank}` });
  if (ranks.length === 0) return null;
  return (
    <SectionCard id="rankings" title="Rankings">
      <div className="grid gap-3 sm:grid-cols-2">
        {ranks.map((r) => (
          <div key={r.label} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">{r.value}</p>
            <p className="mt-1 text-xs text-slate-500">{r.label}</p>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function LocationSection({ university }: { university: ExplorerUniversity }) {
  return (
    <SectionCard id="location" title="Campus & location">
      <p className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-slate-400">
          <path d="M20 10c0 7-8 13-8 13s-8-6-8-13a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" />
        </svg>
        {university.location}
      </p>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <p className="text-sm leading-relaxed text-slate-600">
          <AutoTranslate
            text={
              university.specific_insight ??
              `${shortName(university.name)} is based in ${university.location}, blending academic life with the local culture, food, and pace of the city.`
            }
          />
        </p>
        <div
          className="aspect-[16/10] overflow-hidden rounded-2xl border border-slate-200"
          style={{
            background: university.image_url
              ? `url(${university.image_url}) center/cover`
              : `linear-gradient(135deg, ${university.color}, #1a1a2e)`,
          }}
          aria-hidden
        />
      </div>
    </SectionCard>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   COSTS & FUNDING (real scholarship data)
───────────────────────────────────────────────────────────────────────── */

function FundingSection({ university }: { university: ExplorerUniversity }) {
  const scholarships = university.scholarships ?? [];
  const legacyNote =
    university.scholarship && !/none|n\/a|^—$/i.test(university.scholarship.trim()) ? university.scholarship : null;

  return (
    <SectionCard id="funding" title="Costs & funding">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Tuition (intl.)', value: university.tuition_usd },
          { label: 'Living cost', value: university.living_cost_usd },
          { label: 'Housing', value: university.housing },
          { label: 'Acceptance', value: university.accept_rate },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl bg-slate-50 px-3 py-2.5 text-center">
            <p className="text-sm font-semibold text-slate-900">{stat.value || '—'}</p>
            <p className="text-[11px] text-slate-400">{stat.label}</p>
          </div>
        ))}
      </div>

      {legacyNote ? (
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          <span className="font-semibold text-slate-700">Scholarship note: </span>
          <AutoTranslate text={legacyNote} />
        </p>
      ) : null}

      <div className="mt-5 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">
          Scholarships available here{scholarships.length > 0 ? ` (${scholarships.length})` : ''}
        </h3>
        <Link href="/scholarships" className="text-xs font-medium text-pink-600 hover:text-pink-700">Browse all →</Link>
      </div>

      {scholarships.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          No curated scholarships are linked to this university yet. Explore the full directory for
          country and provider scholarships you may be eligible for.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {scholarships.map((s) => <ScholarshipMiniCard key={s.id} scholarship={s} />)}
        </div>
      )}
    </SectionCard>
  );
}

function ScholarshipMiniCard({ scholarship: s }: { scholarship: UniversityScholarship }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-900">{s.name}</h4>
        {s.amountLabel ? <span className="shrink-0 text-sm font-bold text-slate-900">{s.amountLabel}</span> : null}
      </div>
      {s.fundingType.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {s.fundingType.slice(0, 3).map((ft) => (
            <span key={ft} className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600">
              {FUNDING_TYPE_LABELS[ft as keyof typeof FUNDING_TYPE_LABELS] ?? ft}
            </span>
          ))}
        </div>
      ) : null}
      {!s.amountLabel && s.coverage ? <AutoTranslate as="p" className="mt-1.5 text-xs text-slate-600 line-clamp-1" text={s.coverage} /> : null}
      {s.eligibility ? <AutoTranslate as="p" className="mt-1.5 text-xs leading-relaxed text-slate-500 line-clamp-2" text={s.eligibility} /> : null}
      <div className="mt-2 flex items-center justify-between">
        {s.deadlineLabel ? <span className="text-[10px] text-slate-400">Deadline: {s.deadlineLabel}</span> : <span />}
        {s.sourceUrl ? (
          <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] font-medium text-pink-600 hover:text-pink-700">Official link →</a>
        ) : null}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   MAIN
───────────────────────────────────────────────────────────────────────── */

export function DetailView() {
  const { selectedUniversityId, setView, universities, addToShortlist, removeFromShortlist, isShortlisted, showToast, isLoggedIn } = useExplorer();
  return (
    <DetailViewBody
      key={selectedUniversityId ?? 'none'}
      selectedUniversityId={selectedUniversityId}
      setView={setView}
      universities={universities}
      addToShortlist={addToShortlist}
      removeFromShortlist={removeFromShortlist}
      isShortlisted={isShortlisted}
      showToast={showToast}
      isLoggedIn={isLoggedIn}
    />
  );
}

function DetailViewBody({
  selectedUniversityId,
  setView,
  universities,
  addToShortlist,
  removeFromShortlist,
  isShortlisted,
  showToast,
  isLoggedIn,
}: {
  selectedUniversityId: number | null;
  setView: ReturnType<typeof useExplorer>['setView'];
  universities: ExplorerUniversity[];
  addToShortlist: ReturnType<typeof useExplorer>['addToShortlist'];
  removeFromShortlist: ReturnType<typeof useExplorer>['removeFromShortlist'];
  isShortlisted: ReturnType<typeof useExplorer>['isShortlisted'];
  showToast: ReturnType<typeof useExplorer>['showToast'];
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const university = universities.find((u) => u.id === selectedUniversityId);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [selectedUniversityId]);

  const website = useMemo(() => (university ? guessWebsite(university) : null), [university]);
  const whyBullets = useMemo(() => (university ? deriveWhyBullets(university) : []), [university]);

  if (!university) {
    return (
      <div className="p-8 text-center text-slate-400">
        University not found.{' '}
        <button type="button" onClick={() => setView('browse')} className="text-[#00b4d8] underline">Back to Browse</button>
      </div>
    );
  }

  const saved = isShortlisted(university.id);

  const handleSave = async () => {
    if (!isLoggedIn) {
      router.push('/onboarding');
      return;
    }
    if (saved) {
      await removeFromShortlist(university.id);
      showToast('Removed from your shortlist');
    } else {
      await addToShortlist(university.id);
      showToast(`Nice — ${university.name} is on your university journey`);
    }
  };

  // Navigate to Apply page with university context and open course search modal
  const handleFindCourse = () => {
    router.push(`/apply?universityId=${university.id}&openCourseSearch=true`);
  };

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await (navigator as Navigator & { share?: (d: { title: string; url: string }) => Promise<void> }).share?.({ title: university.name, url });
        return;
      } catch { /* cancelled */ }
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url);
        showToast('Link copied to clipboard');
      } catch {
        showToast('Could not copy link');
      }
    }
  };

  // Build the section nav from sections that will actually render.
  const hasCareers = !!(university.industry_connections || university.internship_coop || university.employability || university.best_for);
  const hasRankings = !!(university.qs_rank || university.the_rank);
  const navItems = [
    { id: 'about', label: 'About' },
    { id: 'admissions', label: 'Admissions' },
    { id: 'funding', label: 'Costs & funding' },
    ...(hasCareers ? [{ id: 'careers', label: 'Careers' }] : []),
    ...(hasRankings ? [{ id: 'rankings', label: 'Rankings' }] : []),
    { id: 'location', label: 'Location' },
  ];

  return (
    <div className="w-full px-4 pb-12 md:px-6">
      <DetailHeaderBar saved={saved} onBack={() => setView('browse')} onShare={handleShare} onSave={handleSave} />

      <DetailHero university={university} saved={saved} onToggleSave={handleSave} />

      <div className="mt-4">
        <DetailToolbar
          items={navItems}
          website={website}
          saved={saved}
          onSave={handleSave}
          onShare={handleShare}
          onFindCourse={handleFindCourse}
        />
      </div>

      <div className="mt-5 space-y-5">
        <AboutSection university={university} />
        <GlanceCircles university={university} website={website} />
        <ScholarshipBanner university={university} />
        <AdmissionsSection university={university} />
        <FundingSection university={university} />
        {hasCareers ? <CareersSection university={university} /> : null}
        {hasRankings ? <RankingsSection university={university} /> : null}
        <LocationSection university={university} />
        <WhyChooseCard university={university} whyBullets={whyBullets} />
        <MentorCard university={university} />
      </div>

      {/* Bottom CTA */}
      <section className="mt-8 overflow-hidden rounded-2xl border border-pink-100 bg-gradient-to-r from-pink-50 to-white p-6 shadow-[0_4px_14px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h3 className="text-base font-semibold text-slate-900 md:text-lg">Ready to study at {shortName(university.name)}?</h3>
            <p className="mt-1 text-sm text-slate-500">Search for courses and start building your application with GlowBal&apos;s AI-powered course selector.</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {university.id === 97 ? (
              <Link
                href="/universities/vinuni"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#7B2FBE,#FF3D9A)] px-6 text-sm font-semibold text-white shadow-[0_8px_22px_rgba(123,47,190,0.32)] transition hover:-translate-y-0.5"
              >
                Explore VinUni Full Experience
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
              </Link>
            ) : null}
            <button
              type="button"
              onClick={handleFindCourse}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] px-6 text-sm font-semibold text-white shadow-[0_8px_22px_rgba(255,77,140,0.28)] transition hover:-translate-y-0.5"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /></svg>
              View courses at this university
            </button>
            <Link href="/apply" className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-6 text-sm font-semibold text-slate-700 transition hover:border-pink-300 hover:text-pink-600">
              Paste a course link
            </Link>
          </div>
        </div>
      </section>

      <p className="mt-6 text-center text-xs text-slate-400">
        All data is for informational purposes only and subject to change. Please check the
        university&apos;s official website for the most up-to-date information.
      </p>
    </div>
  );
}
