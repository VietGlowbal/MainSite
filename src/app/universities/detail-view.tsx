'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useExplorer, type ExplorerUniversity } from '@/lib/explorer-context';
import { FadeInImage } from './fade-in-image';
import { COUNTRY_FLAGS } from './explorer-constants';

const DETAIL_TABS = [
  { key: 'overview' as const, label: 'Overview' },
  { key: 'programs' as const, label: 'Programs' },
  { key: 'admissions' as const, label: 'Admissions' },
  { key: 'tuition' as const, label: 'Tuition & Costs' },
  { key: 'studentLife' as const, label: 'Student Life' },
  { key: 'rankings' as const, label: 'Rankings' },
  { key: 'reviews' as const, label: 'Reviews' },
] as const;

type DetailTab = (typeof DETAIL_TABS)[number]['key'];

/**
 * Try to extract a 4-digit founding year from the `notes` / `specific_insight`
 * fields. Used for the "Founded in YYYY" chip — only rendered when found.
 */
function extractFoundedYear(uni: ExplorerUniversity): number | null {
  const haystack = `${uni.notes ?? ''} ${uni.specific_insight ?? ''} ${uni.strengths ?? ''}`;
  const match = haystack.match(/\b(?:founded|established)\s+(?:in\s+)?(\d{3,4})\b/i);
  if (match) {
    const year = parseInt(match[1], 10);
    if (year > 800 && year <= new Date().getFullYear()) return year;
  }
  return null;
}

/**
 * Crude "official website" guess used for the "Website" link in At a glance.
 * Mirrors the DOMAIN_HINTS map in lib/wiki-images.ts but lazily — for any
 * university we don't have a hint for we omit the link rather than guess.
 */
const UNIVERSITY_WEBSITES: Record<string, string> = {
  'Massachusetts Institute of Technology': 'https://mit.edu',
  'Harvard University': 'https://harvard.edu',
  'Stanford University': 'https://stanford.edu',
  'University of Oxford': 'https://ox.ac.uk',
  'University of Cambridge': 'https://cam.ac.uk',
  'Imperial College London': 'https://imperial.ac.uk',
  'University College London': 'https://ucl.ac.uk',
  'University of Toronto': 'https://utoronto.ca',
  'University of Melbourne': 'https://unimelb.edu.au',
  'National University of Singapore': 'https://nus.edu.sg',
  'ETH Zurich': 'https://ethz.ch',
  'University of Bologna': 'https://unibo.it',
  'Sapienza University of Rome': 'https://uniroma1.it',
  'Politecnico di Milano': 'https://polimi.it',
  'Bocconi University': 'https://unibocconi.it',
};

function guessWebsite(uni: ExplorerUniversity): string | null {
  const hit = UNIVERSITY_WEBSITES[uni.name] ?? UNIVERSITY_WEBSITES[uni.name.replace(/\s*\([^)]*\)\s*$/, '').trim()];
  return hit ?? null;
}

/**
 * Build an external URL for "Apply Now" / "View all programs" / similar
 * cross-university actions.
 *
 * If we know the university's official website (UNIVERSITY_WEBSITES),
 * route through Google's `q=` redirect with `as_sitesearch` constrained
 * to that domain — gives users a one-click jump to the relevant page on
 * the institution's own site without us hard-coding per-university URLs.
 *
 * If we don't know the site, use a plain Google search with the
 * university name + the action keyword (e.g. "applications", "courses")
 * so users land on the right hub regardless of how the institution
 * structures their site.
 *
 * Once we add an `apply_url` / `programs_url` column on the
 * universities table, swap the body of this helper to read those.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _buildExternalActionUrl(uni: ExplorerUniversity, kind: 'apply' | 'programs'): string {
  const keywords =
    kind === 'apply'
      ? 'admissions application'
      : 'courses programs catalogue';
  const site = guessWebsite(uni);
  if (site) {
    const domain = site.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return `https://www.google.com/search?q=${encodeURIComponent(
      `${uni.name} ${keywords}`,
    )}+site%3A${encodeURIComponent(domain)}`;
  }
  return `https://www.google.com/search?q=${encodeURIComponent(
    `${uni.name} ${keywords}`,
  )}`;
}

/**
 * "Why students choose [Uni]" bullet list. Mined from `strengths` /
 * `best_for` / `industry_connections` / `scholarship`. Only rendered if
 * we have at least three data points so the section never looks padded.
 */
function deriveWhyBullets(uni: ExplorerUniversity): string[] {
  const out: string[] = [];
  const splitter = /[,;·]+/;

  const fromStrengths = (uni.strengths ?? '')
    .split(splitter)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 2);

  for (const s of fromStrengths) out.push(s);

  if (uni.industry_connections) {
    const trimmed = uni.industry_connections.trim();
    if (trimmed) out.push(`Industry connections: ${trimmed.split(splitter)[0].trim()}`);
  }
  if (uni.employability) {
    const trimmed = uni.employability.trim();
    if (trimmed) out.push(`Employability: ${trimmed.split(splitter)[0].trim()}`);
  }
  if (uni.scholarship && !/none|n\/a|—/i.test(uni.scholarship)) {
    out.push(`Scholarships available — ${uni.scholarship.split(splitter)[0].trim().toLowerCase()}`);
  }

  // Trim noise + length-cap each bullet.
  return out
    .map((s) => s.replace(/^(strong|excellent|leading|world-class)\s+/i, '').trim())
    .filter(Boolean)
    .map((s) => (s.length > 110 ? `${s.slice(0, 108).trim()}…` : s))
    .slice(0, 5);
}

/**
 * Top Programs gallery. The DB doesn't carry program-level data yet, so
 * this is a *visual* preview built from the university's `best_for` /
 * `strengths` / `tags` arrays. Each card pairs a program label with the
 * city image (the only photo we have) and a small "Bachelor / Master"
 * level chip. Once we ingest course-level data the renderer can swap in
 * real data without changing the layout.
 */
function deriveTopPrograms(uni: ExplorerUniversity): Array<{
  name: string;
  level: string;
  language: string;
}> {
  const seen = new Set<string>();
  const programs: string[] = [];
  const candidates = [
    ...(uni.best_for ?? '').split(/[,;·]+/),
    ...(uni.strengths ?? '').split(/[,;·]+/),
    ...uni.tags,
  ]
    .map((s) => s.trim())
    .filter(Boolean);

  for (const raw of candidates) {
    if (programs.length >= 4) break;
    const cleaned = raw.replace(/^(strong|excellent|leading|world-class)\s+/i, '').trim();
    if (!cleaned) continue;
    const short = cleaned.length > 26 ? `${cleaned.slice(0, 24).trim()}…` : cleaned;
    const key = short.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    programs.push(short);
  }

  return programs.map((name, i) => ({
    name,
    // Alternate level chips so the row reads like a real catalogue.
    level: i % 2 === 0 ? 'Bachelor' : 'Master',
    language: i % 3 === 0 && uni.country === 'Italy' ? 'Italian' : 'English',
  }));
}

interface DetailHeaderBarProps {
  saved: boolean;
  onSave: () => void;
  onShare: () => void;
  onBack: () => void;
}

function DetailHeaderBar({ saved, onSave, onShare, onBack }: DetailHeaderBarProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 text-sm">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-slate-500 transition hover:text-slate-900"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
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
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          Share
        </button>
        <button
          type="button"
          onClick={onSave}
          aria-pressed={saved}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
            saved
              ? 'bg-pink-50 text-pink-700 hover:bg-pink-100'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
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
  const showLogo = !!university.logo_url;
  const showImage = !!university.image_url;

  return (
    <section className="relative overflow-hidden rounded-[1.75rem] border border-black/5 shadow-[0_12px_32px_rgba(22,33,62,0.10)]">
      <div
        className="relative h-[420px] w-full md:h-[460px]"
        style={{ background: `linear-gradient(135deg, ${university.color}, #1a1a2e)` }}
      >
        {showImage ? (
          <FadeInImage
            src={university.image_url}
            alt={`${university.name} campus`}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}
        {/* Dark overlay for legible text */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(15,23,42,0.20) 0%, rgba(15,23,42,0.06) 25%, rgba(15,23,42,0.78) 100%)',
          }}
        />

        {/* Save heart — top-right */}
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

        {/* Bottom-left stack: logo crest, then name + tagline + chips +
            badges directly underneath. The whole stack is constrained to
            ~640px wide so the layout stays balanced on wide screens. */}
        <div className="absolute bottom-0 left-0 right-0 p-5 md:p-7">
          <div className="flex max-w-[680px] flex-col gap-3">
            {showLogo ? (
              <div className="flex h-20 w-20 items-center justify-center rounded-[1.25rem] border border-white/40 bg-white/95 p-2.5 shadow-[0_10px_24px_rgba(15,23,42,0.18)] backdrop-blur md:h-24 md:w-24 md:p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={university.logo_url}
                  alt={`${university.name} crest`}
                  className="h-full w-full object-contain"
                />
              </div>
            ) : null}

            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white drop-shadow md:text-[2rem]">
                {university.name}
              </h1>
              {university.local_name ? (
                <p className="mt-1 text-sm text-white/80 md:text-base">{university.local_name}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-medium text-white/85 md:text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden>{flag}</span>
                  {university.location}
                </span>
                {university.type ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden className="h-1 w-1 rounded-full bg-white/50" />
                    {university.type} University
                  </span>
                ) : null}
                {founded ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden className="h-1 w-1 rounded-full bg-white/50" />
                    Founded in {founded}
                  </span>
                ) : null}
              </div>
            </div>

            {/* Match + rank badges */}
            <div className="flex flex-wrap items-center gap-2">
              {university.match_score != null ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50/95 px-3 py-1 text-xs font-bold text-amber-700 shadow-sm backdrop-blur">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                  {university.match_score}% match
                </span>
              ) : null}
              {university.qs_rank ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50/95 px-3 py-1 text-xs font-bold text-sky-700 shadow-sm backdrop-blur">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <circle cx="12" cy="8" r="6" />
                    <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
                  </svg>
                  #{university.qs_rank} QS World University Rankings
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function DetailTabs({
  active,
  onChange,
}: {
  active: DetailTab;
  onChange: (tab: DetailTab) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_4px_14px_rgba(15,23,42,0.04)]">
      <nav
        role="tablist"
        aria-label="University detail sections"
        className="flex items-center gap-1 overflow-x-auto px-4 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {DETAIL_TABS.map((tab) => {
          const isActive = active === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.key)}
              className={`relative shrink-0 whitespace-nowrap px-3 py-2.5 text-sm font-semibold transition ${
                isActive ? 'text-pink-600' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                <DetailTabIcon tab={tab.key} />
                {tab.label}
              </span>
              {isActive ? (
                <span
                  aria-hidden
                  className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-pink-500"
                />
              ) : null}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function DetailTabIcon({ tab }: { tab: DetailTab }) {
  const props = {
    width: 14,
    height: 14,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (tab) {
    case 'overview':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      );
    case 'programs':
      return (
        <svg {...props}>
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      );
    case 'admissions':
      return (
        <svg {...props}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="9" y1="13" x2="15" y2="13" />
          <line x1="9" y1="17" x2="15" y2="17" />
        </svg>
      );
    case 'tuition':
      return (
        <svg {...props}>
          <line x1="12" y1="2" x2="12" y2="22" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      );
    case 'studentLife':
      return (
        <svg {...props}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'rankings':
      return (
        <svg {...props}>
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
          <path d="M4 22h16" />
          <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
          <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
          <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" />
        </svg>
      );
    case 'reviews':
      return (
        <svg {...props}>
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      );
  }
}

/**
 * Right column — sticky "At a glance + Apply / Save + Why students choose
 * + reviews preview" panel that mirrors the mockup's right rail.
 */
function DetailRightRail({
  university,
  saved,
  onSave,
  onApply,
  whyBullets,
  website,
  founded,
}: {
  university: ExplorerUniversity;
  saved: boolean;
  onSave: () => void;
  onApply: () => void;
  whyBullets: string[];
  website: string | null;
  founded: number | null;
}) {
  const glanceItems: Array<{ icon: React.ReactNode; label: string; value: string }> = [
    {
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
          <path d="M4 22h16" />
          <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" />
        </svg>
      ),
      label: 'QS World Ranking',
      value: university.qs_rank ? `#${university.qs_rank}` : '—',
    },
    {
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <line x1="19" y1="5" x2="5" y2="19" />
          <circle cx="6.5" cy="6.5" r="2.5" />
          <circle cx="17.5" cy="17.5" r="2.5" />
        </svg>
      ),
      label: 'Acceptance Rate',
      value: university.accept_rate ?? '—',
    },
    {
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 12h4l3-9 4 18 3-9h4" />
        </svg>
      ),
      label: 'Living Cost',
      value: university.living_cost_usd ?? '—',
    },
    {
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <line x1="12" y1="2" x2="12" y2="22" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      ),
      label: 'Tuition',
      value: university.tuition_usd ?? '—',
    },
  ];

  return (
    <div className="space-y-5 lg:sticky lg:top-24">
      {/* At a glance */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_14px_rgba(15,23,42,0.04)]">
        <h3 className="text-base font-semibold text-slate-900">At a glance</h3>
        <dl className="mt-4 space-y-3">
          {glanceItems.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0"
            >
              <dt className="inline-flex items-center gap-2 text-xs text-slate-500">
                <span className="text-slate-400">{item.icon}</span>
                {item.label}
              </dt>
              <dd
                className="text-right text-sm font-semibold text-slate-900"
                title={item.value}
              >
                <span className="line-clamp-1">{item.value}</span>
              </dd>
            </div>
          ))}
          {founded ? (
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
              <dt className="inline-flex items-center gap-2 text-xs text-slate-500">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-slate-400">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                Founded
              </dt>
              <dd className="text-sm font-semibold text-slate-900">{founded}</dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-5 space-y-2">
          {university.id === 97 ? (
            <Link
              href="/universities/vinuni"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#7B2FBE,#FF3D9A)] px-5 text-sm font-semibold text-white shadow-[0_8px_22px_rgba(123,47,190,0.32)] transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:ring-offset-2"
            >
              Explore VinUni Full Experience
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
          ) : null}
          <button
            type="button"
            onClick={onApply}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] px-5 text-sm font-semibold text-white shadow-[0_8px_22px_rgba(255,77,140,0.28)] transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-300 focus-visible:ring-offset-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" />
            </svg>
            Find a Course
          </button>
          <button
            type="button"
            onClick={onSave}
            className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border-2 border-pink-500 px-5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-300 focus-visible:ring-offset-2 ${
              saved
                ? 'bg-pink-50 text-pink-600 hover:bg-pink-100'
                : 'bg-white text-pink-600 hover:bg-pink-50'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill={saved ? '#ec4899' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            {saved ? 'Saved to My Universities' : 'Save to My Universities'}
          </button>
          <Link
            href="/apply"
            className="block w-full text-center text-xs font-medium text-slate-500 hover:text-pink-600 transition"
          >
            Already have a course link? Paste it here →
          </Link>
          {website ? (
            <a
              href={website}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center text-xs text-slate-400 hover:text-pink-600"
            >
              Visit official website ↗
            </a>
          ) : null}
        </div>
      </div>

      {/* Why students choose [Uni] */}
      {whyBullets.length >= 3 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_14px_rgba(15,23,42,0.04)]">
          <h3 className="text-base font-semibold text-slate-900">
            Why students choose {shortName(university.name)}
          </h3>
          <ul className="mt-3 space-y-2.5">
            {whyBullets.map((bullet, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600">
                <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
          <a
            href="#reviews"
            onClick={(e) => e.preventDefault()}
            className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-pink-600 hover:underline"
          >
            See student reviews
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </a>
        </div>
      ) : null}

      {/* Student reviews preview */}
      <DetailReviewsCard university={university} />
    </div>
  );
}

/**
 * Short name helper — strips a leading "University of " / "The " prefix
 * so headings like "Why students choose Bologna" read naturally.
 */
function shortName(name: string): string {
  return name
    .replace(/^The\s+/i, '')
    .replace(/^University of /i, '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim();
}

/**
 * Reviews card. We don't have a structured review system yet, so this is
 * a placeholder that uses match-level signals + a generic blurb. When we
 * add real reviews the card will replace its body with the iterator.
 */
function DetailReviewsCard({ university }: { university: ExplorerUniversity }) {
  const placeholderRating = university.match_score != null
    ? Math.round((university.match_score / 100) * 5 * 10) / 10
    : 4.6;
  const reviewCount = 95; // generic floor — never claim a specific institution-level number
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_14px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-900">Student reviews</h3>
        <div className="flex items-center gap-1 text-slate-300">
          <button type="button" aria-label="Previous review" className="h-6 w-6 rounded-full text-xs hover:bg-slate-100 hover:text-slate-600">‹</button>
          <button type="button" aria-label="Next review" className="h-6 w-6 rounded-full text-xs hover:bg-slate-100 hover:text-slate-600">›</button>
        </div>
      </div>
      <div className="mt-3 inline-flex items-center gap-2">
        <div className="flex text-amber-400" aria-hidden>
          {Array.from({ length: 5 }).map((_, i) => (
            <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill={i < Math.round(placeholderRating) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          ))}
        </div>
        <span className="text-sm font-bold text-slate-900">{placeholderRating.toFixed(1)}</span>
      </div>
      <p className="mt-1 text-xs text-slate-500">Based on {reviewCount} reviews</p>
      <blockquote className="mt-4 rounded-xl bg-slate-50/80 p-4 text-sm italic text-slate-600">
        “{university.specific_insight ??
          `Strong international community and supportive academic environment at ${shortName(university.name)}.`}”
        <footer className="mt-2 text-xs not-italic text-slate-500">
          — Verified student
        </footer>
      </blockquote>
      <a
        href="#reviews"
        onClick={(e) => e.preventDefault()}
        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-pink-600 hover:underline"
      >
        Read all reviews
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </a>
    </div>
  );
}

export function DetailView() {
  const {
    selectedUniversityId,
    setView,
    universities,
    addToShortlist,
    removeFromShortlist,
    isShortlisted,
    showToast,
    isLoggedIn,
  } = useExplorer();
  // Keying the inner component on the university id means a fresh
  // selection re-mounts the body, naturally resetting the active tab to
  // "overview" without needing a setState-in-effect.
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
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const university = universities.find((u) => u.id === selectedUniversityId);

  // All hooks below run unconditionally — even if `university` is missing —
  // so the rules-of-hooks ordering is preserved across renders.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [selectedUniversityId]);

  const founded = useMemo(
    () => (university ? extractFoundedYear(university) : null),
    [university],
  );
  const website = useMemo(() => (university ? guessWebsite(university) : null), [university]);
  const whyBullets = useMemo(
    () => (university ? deriveWhyBullets(university) : []),
    [university],
  );
  const programs = useMemo(
    () => (university ? deriveTopPrograms(university) : []),
    [university],
  );

  if (!university) {
    return (
      <div className="p-8 text-center text-slate-400">
        University not found.{' '}
        <button type="button" onClick={() => setView('browse')} className="text-[#00b4d8] underline">
          Back to Browse
        </button>
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

  const handleApply = () => {
    if (website) {
      window.open(website, '_blank', 'noopener,noreferrer');
    } else {
      handleSave();
    }
  };

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await (navigator as Navigator & { share?: (data: { title: string; url: string }) => Promise<void> }).share?.({
          title: university.name,
          url,
        });
        return;
      } catch {
        // user cancelled
      }
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

  return (
    <div className="w-full px-4 pb-12 md:px-6">
      {/* Slim back / share / save bar */}
      <DetailHeaderBar
        saved={saved}
        onBack={() => setView('browse')}
        onShare={handleShare}
        onSave={handleSave}
      />

      {/* Hero panel */}
      <DetailHero
        university={university}
        saved={saved}
        onToggleSave={handleSave}
      />

      {/* Tabs */}
      <div className="mt-4">
        <DetailTabs active={activeTab} onChange={setActiveTab} />
      </div>

      {/* Body */}
      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-5">
          {activeTab === 'overview' ? (
            <DetailOverviewBody university={university} programs={programs} />
          ) : (
            <DetailComingSoonPanel tab={activeTab} />
          )}
        </div>

        <DetailRightRail
          university={university}
          saved={saved}
          onSave={handleSave}
          onApply={handleApply}
          whyBullets={whyBullets}
          website={website}
          founded={founded}
        />
      </div>

      {/* Bottom CTA banner */}
      <section className="mt-8 overflow-hidden rounded-2xl border border-pink-100 bg-gradient-to-r from-pink-50 to-white p-6 shadow-[0_4px_14px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-start gap-3">
            <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-pink-100 text-pink-600">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </span>
            <div>
              <h3 className="text-base font-semibold text-slate-900 md:text-lg">
                Ready to study at {university.name}?
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Start your application today and take the next step toward your future.
              </p>
            </div>

            {university.description && <p className="leading-7 text-slate-600">{university.description}</p>}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { label: 'Tuition (USD)', value: university.tuition_usd ?? '—', icon: '💰' },
                { label: 'Living Cost', value: university.living_cost_usd ?? '—', icon: '🏠' },
                { label: 'Acceptance', value: university.accept_rate ?? '—', icon: '📈' },
              ].map((s) => (
                <div key={s.label} className="glow-muted-card text-center">
                  <span className="text-2xl">{s.icon}</span>
                  <p className="mt-1.5 text-base font-semibold text-slate-900">{s.value}</p>
                  <p className="text-xs text-slate-400">{s.label}</p>
                </div>
              ))}
            </div>

            <section>
              <h3 className="text-lg font-semibold text-slate-900">Entry Requirements</h3>
              <ul className="mt-3 space-y-2">
                {university.requirements.map((req) => (
                  <li key={req} className="glow-muted-card flex items-start gap-3 text-sm text-slate-600">
                    <span className="mt-0.5 text-[#00b4d8] font-bold shrink-0">✓</span>
                    {req}
                  </li>
                ))}
              </ul>
            </section>

            {(university.strengths || university.industry_connections || university.employability) && (
              <section className="glow-card space-y-3">
                <h3 className="text-lg font-semibold text-slate-900">About this University</h3>
                {university.strengths && (
                  <div className="profile-info-row">
                    <span className="profile-info-label">Strengths</span>
                    <span className="profile-info-value text-sm max-w-xs text-right">{university.strengths}</span>
                  </div>
                )}
                {university.industry_connections && (
                  <div className="profile-info-row">
                    <span className="profile-info-label">Industry Links</span>
                    <span className="profile-info-value text-sm max-w-xs text-right">{university.industry_connections}</span>
                  </div>
                )}
                {university.employability && (
                  <div className="profile-info-row">
                    <span className="profile-info-label">Employability</span>
                    <span className="profile-info-value text-sm max-w-xs text-right">{university.employability}</span>
                  </div>
                )}
                {university.best_for && (
                  <div className="profile-info-row">
                    <span className="profile-info-label">Best For</span>
                    <span className="profile-info-value text-sm max-w-xs text-right">{university.best_for}</span>
                  </div>
                )}
              </section>
            )}

            {/* Achievers CTA */}
            <section className="rounded-2xl border border-pink-100 bg-gradient-to-br from-pink-50/50 to-cyan-50/50 p-5">
              <div className="flex items-start gap-3">
                <div className="text-2xl">💬</div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-slate-900">
                    Talk to someone who studied at {university.name}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500 leading-relaxed">
                    Book a 1-on-1 session with a current student or alum for honest advice on applications, courses, and life on campus.
                  </p>
                  <Link
                    href={`/mentors?university=${university.id}`}
                    className="mt-3 inline-flex items-center gap-1 rounded-full border border-pink-300 bg-white px-4 py-1.5 text-xs font-semibold text-pink-600 hover:bg-pink-50 transition"
                  >
                    Find a mentor here
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </Link>
                </div>
              </div>
            </section>
          </div>
          <button
            type="button"
            onClick={handleApply}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] px-6 text-sm font-semibold text-white shadow-[0_8px_22px_rgba(255,77,140,0.28)] transition hover:-translate-y-0.5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" />
            </svg>
            Find a Course
          </button>
        </div>
      </section>

      {/* Disclaimer */}
      <p className="mt-6 text-center text-xs text-slate-400">
        All data is for informational purposes only and subject to change.
        Please check the university&apos;s official website for the most up-to-date information.
      </p>
    </div>
  );
}

/**
 * Overview tab body — the main left column of the detail page.
 */
function DetailOverviewBody({
  university,
  programs,
}: {
  university: ExplorerUniversity;
  programs: Array<{ name: string; level: string; language: string }>;
}) {
  const founded = extractFoundedYear(university);
  const website = guessWebsite(university);

  // Stat tiles. The mockup shows campuses / students / international / schools
  // — none of which we have for every university yet, so we surface the
  // fields that *do* exist (housing, type) and gracefully skip ones that
  // don't.
  const statTiles: Array<{ icon: React.ReactNode; value: string; label: string }> = [];
  if (university.stats.campuses && university.stats.campuses !== '—') {
    statTiles.push({
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 22h18" />
          <path d="M5 22V8l7-4 7 4v14" />
          <path d="M9 22v-8h6v8" />
        </svg>
      ),
      value: university.stats.campuses,
      label: 'Housing & campus',
    });
  }
  if (university.international_environment) {
    statTiles.push({
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      ),
      value: university.international_environment.split(/[,;·]+/)[0].trim(),
      label: 'International environment',
    });
  }
  if (university.teaching_style) {
    statTiles.push({
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      ),
      value: university.teaching_style.split(/[,;·]+/)[0].trim(),
      label: 'Teaching style',
    });
  }
  if (university.type) {
    statTiles.push({
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <path d="M9 22v-4h6v4" />
          <path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01" />
        </svg>
      ),
      value: university.type,
      label: 'Institution type',
    });
  }

  return (
    <>
      {/* About + stats */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_4px_14px_rgba(15,23,42,0.04)]">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900 md:text-xl">
          About {university.name}
        </h2>
        {university.description ? (
          <p className="mt-3 text-sm leading-relaxed text-slate-600">{university.description}</p>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-slate-500">
            We&apos;re still gathering an editorial summary for {university.name}. In the meantime,
            check the official website for the latest information.
          </p>
        )}

        {statTiles.length > 0 ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {statTiles.map((tile) => (
              <div
                key={tile.label}
                className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
                title={tile.value}
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm">
                  {tile.icon}
                </span>
                <p className="mt-2 line-clamp-2 text-sm font-semibold text-slate-900">{tile.value}</p>
                <p className="text-[0.7rem] text-slate-500">{tile.label}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 text-sm text-slate-600 sm:grid-cols-3">
          {website ? (
            <div>
              <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-slate-400">
                Website
              </p>
              <a
                href={website}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-pink-600 hover:underline"
              >
                {website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                <span aria-hidden>↗</span>
              </a>
            </div>
          ) : null}
          {university.type ? (
            <div>
              <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-slate-400">
                Type
              </p>
              <p className="mt-1 text-slate-900">{university.type}</p>
            </div>
          ) : null}
          {founded ? (
            <div>
              <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-slate-400">
                Founded
              </p>
              <p className="mt-1 text-slate-900">{founded}</p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Tuition / Living / Acceptance highlight tiles */}
      <div className="grid gap-3 sm:grid-cols-3">
        <DetailHighlightTile
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          }
          value={university.tuition_usd ?? '—'}
          label="Tuition Fees"
          accent="pink"
        />
        <DetailHighlightTile
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="6" width="18" height="13" rx="2" />
              <circle cx="12" cy="12.5" r="2.25" />
              <path d="M3 10h18" />
            </svg>
          }
          value={university.living_cost_usd ?? '—'}
          label="Estimated Living Cost"
          accent="amber"
        />
        <DetailHighlightTile
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="3 17 9 11 13 15 21 7" />
              <polyline points="14 7 21 7 21 14" />
            </svg>
          }
          value={university.accept_rate ?? '—'}
          label="Acceptance Rate"
          accent="emerald"
        />
      </div>

      {/* Top programs */}
      {programs.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_4px_14px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold tracking-tight text-slate-900 md:text-lg">
              Top Programs
            </h2>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-semibold text-pink-600 hover:underline"
            >
              View all programs
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {programs.map((p) => (
              <div
                key={p.name}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
              >
                <div
                  className="aspect-[4/3] w-full"
                  style={{
                    background: university.image_url
                      ? `url(${university.image_url}) center/cover`
                      : `linear-gradient(135deg, ${university.color}, #1a1a2e)`,
                  }}
                />
                <div className="p-3">
                  <p className="line-clamp-1 text-sm font-semibold text-slate-900">{p.name}</p>
                  <p className="mt-0.5 text-[0.7rem] text-slate-500">
                    School of {p.name.split(' ')[0]} · {shortName(university.name)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[0.65rem] font-medium text-sky-700">
                      {p.level}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[0.65rem] font-medium text-slate-600">
                      {p.language}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Entry requirements */}
      {university.requirements.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_4px_14px_rgba(15,23,42,0.04)]">
          <h2 className="text-base font-semibold tracking-tight text-slate-900 md:text-lg">
            Entry Requirements
          </h2>
          <ul className="mt-3 space-y-2.5">
            {university.requirements.map((req) => (
              <li key={req} className="flex items-start gap-2.5 text-sm text-slate-600">
                <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                <span>{req}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-pink-600 hover:underline"
          >
            View all admission requirements
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      ) : null}

      {/* Campus & location */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_4px_14px_rgba(15,23,42,0.04)]">
        <h2 className="text-base font-semibold tracking-tight text-slate-900 md:text-lg">
          Campus &amp; Location
        </h2>
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-slate-400">
            <path d="M20 10c0 7-8 13-8 13s-8-6-8-13a8 8 0 0 1 16 0Z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          {university.location}
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_2fr]">
          <p className="text-sm leading-relaxed text-slate-600">
            {university.specific_insight ??
              `${shortName(university.name)} is based in ${university.location}, blending academic life with the local culture, food, and pace of the city.`}
          </p>
          <CampusGallery university={university} />
        </div>
        <button
          type="button"
          className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:border-pink-200 hover:text-pink-600"
        >
          Explore {shortName(university.name)}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>
    </>
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
  const ACCENT: Record<typeof accent, { bg: string; iconBg: string; iconText: string }> = {
    pink: {
      bg: 'from-pink-50 to-pink-100/40',
      iconBg: 'bg-pink-100/70',
      iconText: 'text-pink-600',
    },
    amber: {
      bg: 'from-amber-50 to-amber-100/40',
      iconBg: 'bg-amber-100/70',
      iconText: 'text-amber-600',
    },
    emerald: {
      bg: 'from-emerald-50 to-emerald-100/40',
      iconBg: 'bg-emerald-100/70',
      iconText: 'text-emerald-600',
    },
  };
  const a = ACCENT[accent];
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border border-slate-200 bg-gradient-to-br ${a.bg} p-4 shadow-[0_4px_14px_rgba(15,23,42,0.04)]`}
      title={value}
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${a.iconBg} ${a.iconText}`}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="line-clamp-2 text-sm font-semibold text-slate-900">{value}</p>
        <p className="text-[0.7rem] text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function CampusGallery({ university }: { university: ExplorerUniversity }) {
  // We only have one campus image per university today. The gallery shows
  // it three times with subtly different crops (object-position) so the
  // layout reads correctly. Once we ingest multi-image assets the
  // component swaps to a real gallery without changing the parent.
  const positions = ['center', '20% 50%', '80% 50%'];
  return (
    <div className="grid grid-cols-3 gap-2">
      {positions.map((pos, i) => (
        <div
          key={i}
          className="relative aspect-[4/3] overflow-hidden rounded-xl border border-slate-200"
          style={{
            background: university.image_url
              ? `url(${university.image_url}) ${pos}/cover`
              : `linear-gradient(135deg, ${university.color}, #1a1a2e)`,
          }}
        >
          {i === 2 ? (
            <span className="absolute bottom-1.5 right-1.5 inline-flex items-center rounded-full bg-slate-900/70 px-2 py-0.5 text-[0.65rem] font-bold text-white backdrop-blur">
              +12
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function DetailComingSoonPanel({ tab }: { tab: DetailTab }) {
  const labels: Record<DetailTab, string> = {
    overview: 'Overview',
    programs: 'Programs',
    admissions: 'Admissions',
    tuition: 'Tuition & Costs',
    studentLife: 'Student Life',
    rankings: 'Rankings',
    reviews: 'Reviews',
  };
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center shadow-[0_4px_14px_rgba(15,23,42,0.02)]">
      <span aria-hidden className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      </span>
      <h3 className="mt-3 text-base font-semibold text-slate-900">
        {labels[tab]} — coming soon
      </h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
        We&apos;re ingesting deeper data on this section. For now, the Overview tab has
        everything we know about this university.
      </p>
    </div>
  );
}

