'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, EmptyState } from '@/components/ui';
import { useLanguage } from '@/lib/i18n';
import { AutoTranslate } from '@/lib/use-auto-translate';
import {
  FUNDING_TYPES,
  FUNDING_TYPE_LABELS,
  SCHOLARSHIP_SCOPES,
  SCHOLARSHIP_SCOPE_LABELS,
} from '@/lib/scholarships';
import { scorePersonalMatch, type DirectoryScholarship } from '@/lib/scholarships-data';
import { ScholarshipDashboard } from './scholarship-dashboard';

/* Shapes mirror ScholarshipDashboard's props (which doesn't export them). */
type Application = {
  id: string;
  university_name: string;
  course_name: string;
  degree_level: string | null;
  subject: string | null;
  country: string | null;
  country_flag: string | null;
  intake: string | null;
  deadline: string | null;
  status: string;
};
type ExistingScholarship = {
  id: string;
  application_id: string;
  title: string;
  description: string | null;
  url: string | null;
  confidence: string;
};

type Props = {
  scholarships: DirectoryScholarship[];
  savedUniversityIds: number[];
  savedCountries: string[];
  applications: Application[];
  existingScholarships: ExistingScholarship[];
  // Set when deep-linked from a university detail page (?university=<id>).
  focusUniversity?: { id: number; name: string } | null;
};

type SortKey = 'relevance' | 'deadline' | 'name';

export function ScholarshipDirectoryClient({
  scholarships,
  savedUniversityIds,
  savedCountries,
  applications,
  existingScholarships,
  focusUniversity = null,
}: Props) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<'directory' | 'ai'>('directory');

  // Filters
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<string>('all');
  const [funding, setFunding] = useState<Set<string>>(new Set());
  const [country, setCountry] = useState<string>('all');
  const [sort, setSort] = useState<SortKey>('relevance');
  const [selected, setSelected] = useState<DirectoryScholarship | null>(null);

  // Deep-link focus: scope the directory to one university's scholarships.
  const [focusActive, setFocusActive] = useState(true);
  const focusIds = useMemo(() => {
    if (!focusUniversity) return null;
    const set = new Set<number>();
    for (const s of scholarships) if (s.universityIds.includes(focusUniversity.id)) set.add(s.id);
    return set;
  }, [scholarships, focusUniversity]);
  const focusHasMatches = !!focusIds && focusIds.size > 0;
  const focusFilterOn = focusActive && focusHasMatches;

  // Personalization: which scholarships match the user's saved universities.
  const matchedIds = useMemo(() => {
    const set = new Set<number>();
    for (const s of scholarships) {
      if (scorePersonalMatch(s, savedUniversityIds, savedCountries).matched) set.add(s.id);
    }
    return set;
  }, [scholarships, savedUniversityIds, savedCountries]);

  // Facets present in the data (so we never show an empty filter chip).
  const scopesPresent = useMemo(
    () => SCHOLARSHIP_SCOPES.filter((sc) => scholarships.some((s) => s.scope === sc)),
    [scholarships],
  );
  const fundingPresent = useMemo(
    () => FUNDING_TYPES.filter((ft) => scholarships.some((s) => s.funding_type.includes(ft))),
    [scholarships],
  );
  const countriesPresent = useMemo(
    () => [...new Set(scholarships.map((s) => s.country).filter((c): c is string => !!c))].sort(),
    [scholarships],
  );

  const hasActiveFilters = query.trim() !== '' || scope !== 'all' || funding.size > 0 || country !== 'all';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = scholarships.filter((s) => {
      if (focusFilterOn && focusIds && !focusIds.has(s.id)) return false;
      if (q && !s.name.toLowerCase().includes(q)) return false;
      if (scope !== 'all' && s.scope !== scope) return false;
      if (country !== 'all' && s.country !== country) return false;
      if (funding.size > 0 && !s.funding_type.some((ft) => funding.has(ft))) return false;
      return true;
    });

    rows.sort((a, b) => {
      if (sort === 'deadline') {
        if (a.deadlineSortValue !== b.deadlineSortValue) return a.deadlineSortValue - b.deadlineSortValue;
        return a.name.localeCompare(b.name);
      }
      if (sort === 'relevance') {
        const am = matchedIds.has(a.id) ? 0 : 1;
        const bm = matchedIds.has(b.id) ? 0 : 1;
        if (am !== bm) return am - bm;
      }
      return a.name.localeCompare(b.name);
    });
    return rows;
  }, [scholarships, query, scope, country, funding, sort, matchedIds, focusFilterOn, focusIds]);

  const toggleFunding = (ft: string) =>
    setFunding((prev) => {
      const next = new Set(prev);
      if (next.has(ft)) next.delete(ft);
      else next.add(ft);
      return next;
    });

  const clearFilters = () => {
    setQuery('');
    setScope('all');
    setFunding(new Set());
    setCountry('all');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t('Scholarships')}</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          {t('Browse curated scholarships and find funding you can apply for.')}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-full bg-slate-100 p-1 w-fit">
        <button
          type="button"
          onClick={() => setTab('directory')}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
            tab === 'directory' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {t('Directory')}
        </button>
        <button
          type="button"
          onClick={() => setTab('ai')}
          className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
            tab === 'ai' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <SparklesIcon />
          {t('Match my courses (AI)')}
        </button>
      </div>

      {tab === 'ai' ? (
        <ScholarshipDashboard applications={applications} existingScholarships={existingScholarships} />
      ) : (
        <>
          {/* Filter bar */}
          <Card size="md" padding="sm" flat className="space-y-3">
            {/* Search */}
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <SearchIcon />
              </span>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('Search scholarships by name')}
                className="w-full rounded-full border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:border-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-100"
              />
            </div>

            {/* Scope chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-semibold text-slate-400">{t('Scope')}:</span>
              <FilterChip active={scope === 'all'} onClick={() => setScope('all')}>
                {t('All')} ({scholarships.length})
              </FilterChip>
              {scopesPresent.map((sc) => (
                <FilterChip key={sc} active={scope === sc} onClick={() => setScope(sc)}>
                  {t(SCHOLARSHIP_SCOPE_LABELS[sc])} ({scholarships.filter((s) => s.scope === sc).length})
                </FilterChip>
              ))}
            </div>

            {/* Funding type chips (multi) */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-semibold text-slate-400">{t('Funding type')}:</span>
              {fundingPresent.map((ft) => (
                <FilterChip key={ft} active={funding.has(ft)} onClick={() => toggleFunding(ft)}>
                  {t(FUNDING_TYPE_LABELS[ft])}
                </FilterChip>
              ))}
            </div>

            {/* Country + sort + clear */}
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                {t('Country')}:
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 focus:outline-none"
                >
                  <option value="all">{t('All countries')}</option>
                  {countriesPresent.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                {t('Sort by')}:
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 focus:outline-none"
                >
                  <option value="relevance">{t('Relevance')}</option>
                  <option value="deadline">{t('Deadline (soonest)')}</option>
                  <option value="name">{t('Name (A–Z)')}</option>
                </select>
              </label>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="ml-auto text-xs font-medium text-pink-600 hover:text-pink-700"
                >
                  {t('Clear filters')}
                </button>
              )}
            </div>
          </Card>

          {/* University focus chip (deep-linked from a university page) */}
          {focusUniversity && focusActive && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-pink-200 bg-pink-50/70 px-3 py-2 text-sm">
              {focusHasMatches ? (
                <span className="font-medium text-pink-700">
                  {t('Showing scholarships for {name}', { name: focusUniversity.name })}
                </span>
              ) : (
                <span className="text-slate-600">
                  {t('No scholarships are linked to {name} yet — showing the full directory.', {
                    name: focusUniversity.name,
                  })}
                </span>
              )}
              <button
                type="button"
                onClick={() => setFocusActive(false)}
                className="ml-auto text-xs font-medium text-pink-600 hover:text-pink-700"
              >
                {focusHasMatches ? t('Show all') : t('Dismiss')}
              </button>
            </div>
          )}

          {/* Personalized note */}
          {sort === 'relevance' && matchedIds.size > 0 && !hasActiveFilters && (
            <p className="flex items-center gap-2 text-xs font-medium text-pink-600">
              <span className="inline-block h-2 w-2 rounded-full bg-pink-500" />
              {t('Matched to your saved universities')}
            </p>
          )}

          {/* Results */}
          {filtered.length === 0 ? (
            <EmptyState
              icon="🔍"
              title={t('No scholarships match these filters')}
              action={
                hasActiveFilters ? (
                  <Button variant="secondary" onClick={clearFilters}>
                    {t('Clear filters')}
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((s) => (
                <ScholarshipDirectoryCard
                  key={s.id}
                  scholarship={s}
                  matched={matchedIds.has(s.id)}
                  onOpen={() => setSelected(s)}
                  t={t}
                />
              ))}
            </div>
          )}
        </>
      )}

      {selected && <ScholarshipDetailModal scholarship={selected} onClose={() => setSelected(null)} t={t} />}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   FILTER CHIP
───────────────────────────────────────────────────────────────────────── */

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
        active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {children}
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   CARD
───────────────────────────────────────────────────────────────────────── */

type Translate = (en: string, vars?: Record<string, string | number>) => string;

function ScholarshipDirectoryCard({
  scholarship: s,
  matched,
  onOpen,
  t,
}: {
  scholarship: DirectoryScholarship;
  matched: boolean;
  onOpen: () => void;
  t: Translate;
}) {
  return (
    <Card size="md" padding="sm" interactive className="flex cursor-pointer flex-col" onClick={onOpen}>
      {/* Header */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900 line-clamp-2">{s.name}</h3>
          <p className="mt-0.5 truncate text-xs text-slate-400">
            {s.countryFlag && <span className="mr-1">{s.countryFlag}</span>}
            {s.provider || s.country || t(SCHOLARSHIP_SCOPE_LABELS[s.scope])}
          </p>
        </div>
        {matched && (
          <Badge tone="match" size="sm">
            {t('For you')}
          </Badge>
        )}
      </div>

      {/* Amount / coverage */}
      {(s.amountLabel || s.coverage) && (
        <div className="mb-3 rounded-lg bg-gradient-to-r from-pink-50 to-violet-50 px-3 py-2">
          {s.amountLabel ? (
            <p className="text-sm font-bold text-slate-900">{s.amountLabel}</p>
          ) : (
            <AutoTranslate
              as="p"
              className="text-sm font-semibold text-slate-800 line-clamp-2"
              text={s.coverage}
            />
          )}
          {s.amountLabel && s.coverage && (
            <AutoTranslate as="p" className="text-[11px] text-slate-500 line-clamp-1" text={s.coverage} />
          )}
        </div>
      )}

      {/* Badges */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        <Badge tone="info" size="sm">
          {t(SCHOLARSHIP_SCOPE_LABELS[s.scope])}
        </Badge>
        {s.funding_type.slice(0, 2).map((ft) => (
          <Badge key={ft} tone="neutral" size="sm">
            {t(FUNDING_TYPE_LABELS[ft as keyof typeof FUNDING_TYPE_LABELS] ?? ft)}
          </Badge>
        ))}
      </div>

      {/* Eligibility preview */}
      {s.eligibility && (
        <AutoTranslate
          as="p"
          className="mb-3 text-xs leading-relaxed text-slate-500 line-clamp-2"
          text={s.eligibility}
        />
      )}

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between border-t border-slate-50 pt-2">
        {s.deadlineLabel ? (
          <span className="text-[10px] text-slate-400">
            {t('Deadline')}: {s.deadlineLabel}
          </span>
        ) : (
          <span />
        )}
        <span className="text-[11px] font-medium text-pink-600">{t('View details')} →</span>
      </div>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   DETAIL MODAL
───────────────────────────────────────────────────────────────────────── */

function ScholarshipDetailModal({
  scholarship: s,
  onClose,
  t,
}: {
  scholarship: DirectoryScholarship;
  onClose: () => void;
  t: Translate;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm sm:p-8"
      onClick={onClose}
      role="presentation"
    >
      <Card
        size="lg"
        className="relative my-auto w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
        >
          ✕
        </button>

        {/* Header */}
        <div className="pr-10">
          <h2 className="text-lg font-bold text-slate-900">{s.name}</h2>
          <p className="mt-1 text-sm text-slate-400">
            {s.countryFlag && <span className="mr-1">{s.countryFlag}</span>}
            {[s.provider, s.country].filter(Boolean).join(' · ') || t(SCHOLARSHIP_SCOPE_LABELS[s.scope])}
          </p>
        </div>

        {/* Badges */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge tone="info" size="sm">
            {t(SCHOLARSHIP_SCOPE_LABELS[s.scope])}
          </Badge>
          {s.funding_type.map((ft) => (
            <Badge key={ft} tone="neutral" size="sm">
              {t(FUNDING_TYPE_LABELS[ft as keyof typeof FUNDING_TYPE_LABELS] ?? ft)}
            </Badge>
          ))}
        </div>

        {/* Key facts */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {(s.amountLabel || s.coverage) && (
            <Fact label={t('Coverage')}>
              {s.amountLabel && <span className="font-semibold text-slate-900">{s.amountLabel}</span>}
              {s.coverage && <AutoTranslate as="span" className="block text-slate-600" text={s.coverage} />}
            </Fact>
          )}
          {(s.slots != null || s.slots_text) && (
            <Fact label={t('Slots')}>
              {s.slots != null ? String(s.slots) : <AutoTranslate text={s.slots_text} />}
            </Fact>
          )}
          {s.deadlineLabel && <Fact label={t('Deadline')}>{s.deadlineLabel}</Fact>}
          {s.ranking_note && (
            <Fact label={t('Ranking / acceptance')}>
              <AutoTranslate text={s.ranking_note} />
            </Fact>
          )}
        </div>

        {/* Long-form sections */}
        <div className="mt-4 space-y-4">
          <Section label={t('Eligibility')} text={s.eligibility} />
          <Section label={t('Conditions')} text={s.conditions} />
          <Section label={t('Insight')} text={s.insight} />
        </div>

        {/* Applicable universities */}
        {s.universities.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {t('Applicable universities')}
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {s.universities.map((u) => (
                <span
                  key={u.id}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700"
                >
                  {u.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Official link */}
        {s.source_url && (
          <div className="mt-6">
            <a
              href={s.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
            >
              {t('Official link')} <span aria-hidden>→</span>
            </a>
          </div>
        )}
      </Card>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-0.5 text-sm text-slate-700">{children}</div>
    </div>
  );
}

function Section({ label, text }: { label: string; text: string | null }) {
  if (!text) return null;
  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</h3>
      <AutoTranslate as="p" className="whitespace-pre-line text-sm leading-relaxed text-slate-600" text={text} />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   ICONS
───────────────────────────────────────────────────────────────────────── */

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  );
}
