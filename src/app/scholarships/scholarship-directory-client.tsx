'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Card, EmptyState, Pagination } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';
import { getFocusUniversity, setFocusUniversity } from '@/lib/selection-cache';
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
  focusUniversity?: { id: number; name: string; country: string | null } | null;
  // Scholarship ids already in the user's saved bucket (user_scholarships).
  savedScholarshipIds?: number[];
};

type SortKey = 'relevance' | 'deadline' | 'name';

export function ScholarshipDirectoryClient({
  scholarships,
  savedUniversityIds,
  savedCountries,
  applications,
  existingScholarships,
  focusUniversity: focusUniversityProp = null,
  savedScholarshipIds = [],
}: Props) {
  const { t } = useLanguage();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [tab, setTab] = useState<'directory' | 'ai'>('directory');

  // The chosen university that scopes this page. Seeded from the ?university=
  // param (focusUniversityProp); when absent we restore the last-chosen one
  // from localStorage so it survives navigation (Universities → News →
  // Scholarships). When the param IS present we cache it for future visits.
  const [focusUniversity, setFocusUniversityState] =
    useState<{ id: number; name: string; country: string | null } | null>(focusUniversityProp);
  useEffect(() => {
    if (focusUniversityProp) {
      setFocusUniversity({
        id: focusUniversityProp.id,
        name: focusUniversityProp.name,
        country: focusUniversityProp.country ?? '',
      });
    } else {
      const cached = getFocusUniversity();
      if (cached) setFocusUniversityState(cached);
    }
    // Run once on mount; the param is fixed for the page's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Saved-scholarship bucket (persists to user_scholarships + user_universities).
  const [savedIds, setSavedIds] = useState<Set<number>>(() => new Set(savedScholarshipIds));
  const [lastSavedUniversityId, setLastSavedUniversityId] = useState<number | null>(focusUniversity?.id ?? null);

  const toggleSave = async (s: DirectoryScholarship) => {
    const universityId = focusUniversity?.id ?? s.universityIds[0] ?? null;
    const willSave = !savedIds.has(s.id);
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (willSave) next.add(s.id);
      else next.delete(s.id);
      return next;
    });
    if (willSave && universityId != null) setLastSavedUniversityId(universityId);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth');
        return;
      }
      if (willSave) {
        // Save the scholarship to the bucket...
        await supabase
          .from('user_scholarships')
          .upsert(
            { user_id: user.id, scholarship_id: s.id, university_id: universityId },
            { onConflict: 'user_id,scholarship_id', ignoreDuplicates: true },
          );
        // ...and idempotently add its university to My Universities.
        if (universityId != null) {
          await supabase
            .from('user_universities')
            .upsert(
              { user_id: user.id, university_id: universityId, status: 'interested' },
              { onConflict: 'user_id,university_id', ignoreDuplicates: true },
            );
        }
      } else {
        await supabase.from('user_scholarships').delete().eq('user_id', user.id).eq('scholarship_id', s.id);
      }
    } catch {
      // Revert optimistic update on failure.
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (willSave) next.delete(s.id);
        else next.add(s.id);
        return next;
      });
    }
  };

  const goToApply = () => {
    const focus = focusUniversity?.id ?? lastSavedUniversityId;
    router.push(focus != null ? `/apply?focus=${focus}` : '/apply');
  };

  // Filters
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<string>('all');
  const [funding, setFunding] = useState<Set<string>>(new Set());
  const [country, setCountry] = useState<string>('all');
  const [sort, setSort] = useState<SortKey>('relevance');
  const [selected, setSelected] = useState<DirectoryScholarship | null>(null);

  // Pagination for the full directory: 9 cards per page (3 columns × 3 rows).
  const [page, setPage] = useState(1);
  const resultsTopRef = useRef<HTMLDivElement>(null);

  // Deep-link focus: split the directory into "at this university" + "same country".
  const [focusActive, setFocusActive] = useState(true);
  const focusIds = useMemo(() => {
    if (!focusUniversity) return null;
    const set = new Set<number>();
    for (const s of scholarships) if (s.universityIds.includes(focusUniversity.id)) set.add(s.id);
    return set;
  }, [scholarships, focusUniversity]);
  const focusHasMatches = !!focusIds && focusIds.size > 0;

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
  }, [scholarships, query, scope, country, funding, sort, matchedIds]);

  // Reset to the first page whenever the result set changes (filters/search/sort).
  useEffect(() => setPage(1), [query, scope, country, funding, sort]);

  const SCHOLARSHIPS_PER_PAGE = 9; // 3 columns × 3 rows
  const pageCount = Math.max(1, Math.ceil(filtered.length / SCHOLARSHIPS_PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const paged = filtered.slice(
    (currentPage - 1) * SCHOLARSHIPS_PER_PAGE,
    currentPage * SCHOLARSHIPS_PER_PAGE,
  );
  const goToPage = (p: number) => {
    setPage(p);
    resultsTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // When deep-linked from a university, split the filtered list into two sections.
  const sectioned = !!focusUniversity && focusActive && focusHasMatches;
  const focusCountry = focusUniversity?.country ?? null;
  const sectionAtUni = useMemo(
    () => (sectioned && focusIds ? filtered.filter((s) => focusIds.has(s.id)) : []),
    [sectioned, focusIds, filtered],
  );
  const sectionSameCountry = useMemo(
    () =>
      sectioned && focusCountry
        ? filtered.filter(
            (s) =>
              !focusIds!.has(s.id) &&
              (s.country === focusCountry || s.universityCountries.includes(focusCountry)),
          )
        : [],
    [sectioned, focusCountry, focusIds, filtered],
  );

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

  const renderGrid = (items: DirectoryScholarship[]) => (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((s) => (
        <ScholarshipDirectoryCard
          key={s.id}
          scholarship={s}
          matched={matchedIds.has(s.id)}
          saved={savedIds.has(s.id)}
          onOpen={() => setSelected(s)}
          onToggleSave={() => toggleSave(s)}
          t={t}
        />
      ))}
    </div>
  );

  return (
    // Extra bottom padding when the floating "Continue to Apply" bar is shown,
    // so it doesn't overlap the pagination control at the end of the list.
    <div className={`space-y-6 ${savedIds.size > 0 ? 'pb-28' : ''}`}>
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

          {sectioned ? (
            /* Deep-linked from a university → two labelled sections. */
            <div className="space-y-8">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-slate-500">
                  {t('Funding picked for {name}', { name: focusUniversity!.name })}
                </p>
                <button
                  type="button"
                  onClick={() => setFocusActive(false)}
                  className="shrink-0 text-xs font-medium text-pink-600 hover:text-pink-700"
                >
                  {t('Show all scholarships')}
                </button>
              </div>

              <section>
                <SectionBanner>{t('Scholarships at {name}', { name: focusUniversity!.name })}</SectionBanner>
                {renderGrid(sectionAtUni)}
              </section>

              {sectionSameCountry.length > 0 && (
                <section>
                  <SectionBanner>
                    {focusCountry
                      ? t('Other scholarships in {country}', { country: focusCountry })
                      : t('Other scholarships')}
                  </SectionBanner>
                  {renderGrid(sectionSameCountry)}
                </section>
              )}
            </div>
          ) : (
            <>
              {/* Focus uni had no linked scholarships → note + full directory. */}
              {focusUniversity && focusActive && !focusHasMatches && (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-pink-200 bg-pink-50/70 px-3 py-2 text-sm">
                  <span className="text-slate-600">
                    {t('No scholarships are linked to {name} yet — showing the full directory.', {
                      name: focusUniversity.name,
                    })}
                  </span>
                  <button
                    type="button"
                    onClick={() => setFocusActive(false)}
                    className="ml-auto text-xs font-medium text-pink-600 hover:text-pink-700"
                  >
                    {t('Dismiss')}
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
                <div ref={resultsTopRef} className="scroll-mt-4">
                  {renderGrid(paged)}
                  <Pagination page={currentPage} pageCount={pageCount} onChange={goToPage} />
                </div>
              )}
            </>
          )}
        </>
      )}

      {selected && (
        <ScholarshipDetailModal
          scholarship={selected}
          saved={savedIds.has(selected.id)}
          onToggleSave={() => toggleSave(selected)}
          onClose={() => setSelected(null)}
          t={t}
        />
      )}

      {/* Sticky "Continue to Apply" bar — appears once anything is saved. */}
      {savedIds.size > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-4 rounded-full border border-pink-200 bg-white/95 py-2 pl-5 pr-2 shadow-[0_10px_30px_rgba(255,77,140,0.25)] backdrop-blur">
            <span className="text-sm font-semibold text-slate-700">
              {t('{count} scholarship(s) saved', { count: savedIds.size })}
            </span>
            <button
              type="button"
              onClick={goToApply}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] px-5 text-sm font-semibold text-white shadow-[0_6px_18px_rgba(255,77,140,0.3)] transition hover:-translate-y-0.5"
            >
              {t('Continue to Apply')}
              <span aria-hidden>→</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   SECTION BANNER
───────────────────────────────────────────────────────────────────────── */

function SectionBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 inline-flex items-center rounded-lg bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] px-4 py-2 text-sm font-bold text-white shadow-[0_4px_14px_rgba(255,77,140,0.25)]">
      {children}
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
  saved,
  onOpen,
  onToggleSave,
  t,
}: {
  scholarship: DirectoryScholarship;
  matched: boolean;
  saved: boolean;
  onOpen: () => void;
  onToggleSave: () => void;
  t: Translate;
}) {
  return (
    <Card size="md" padding="md" interactive className="group relative flex cursor-pointer flex-col" onClick={onOpen}>
      {/* Save heart — top-right corner, matching the university cards */}
      <button
        type="button"
        aria-pressed={saved}
        aria-label={saved ? t('Saved to My Universities') : t('Save to My Universities')}
        onClick={(e) => {
          e.stopPropagation();
          onToggleSave();
        }}
        className={`absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-300 ${
          saved ? 'border-pink-200 bg-pink-50 text-pink-600' : 'border-slate-200 bg-white text-slate-400 hover:border-pink-200 hover:text-pink-500'
        }`}
      >
        <HeartIcon filled={saved} />
      </button>

      {/* Header */}
      <div className="mb-3 pr-9">
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <Badge tone="info" size="sm">
            {t(SCHOLARSHIP_SCOPE_LABELS[s.scope])}
          </Badge>
          {matched && (
            <Badge tone="match" size="sm">
              {t('For you')}
            </Badge>
          )}
        </div>
        <h3 className="text-base font-semibold leading-snug text-slate-900 line-clamp-2 transition group-hover:text-pink-600">{s.name}</h3>
        <p className="mt-1 truncate text-xs text-slate-400">
          {s.countryFlag && <span className="mr-1">{s.countryFlag}</span>}
          {s.provider || s.country || t(SCHOLARSHIP_SCOPE_LABELS[s.scope])}
        </p>
      </div>

      {/* Amount / coverage */}
      {(s.amountLabel || s.coverage) && (
        <div className="mb-3 rounded-2xl bg-pink-50 px-3.5 py-2.5">
          {s.amountLabel ? (
            <p className="text-base font-bold text-pink-700">{s.amountLabel}</p>
          ) : (
            <AutoTranslate
              as="p"
              className="text-sm font-semibold text-pink-700 line-clamp-2"
              text={s.coverage}
            />
          )}
          {s.amountLabel && s.coverage && (
            <AutoTranslate as="p" className="mt-0.5 text-[11px] text-pink-500/80 line-clamp-1" text={s.coverage} />
          )}
        </div>
      )}

      {/* Funding-type tags */}
      {s.funding_type.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {s.funding_type.slice(0, 2).map((ft) => (
            <Badge key={ft} tone="neutral" size="sm">
              {t(FUNDING_TYPE_LABELS[ft as keyof typeof FUNDING_TYPE_LABELS] ?? ft)}
            </Badge>
          ))}
        </div>
      )}

      {/* Eligibility preview */}
      {s.eligibility && (
        <AutoTranslate
          as="p"
          className="mb-3 text-xs leading-relaxed text-slate-500 line-clamp-2"
          text={s.eligibility}
        />
      )}

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3">
        {s.deadlineLabel ? (
          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
            {s.deadlineLabel}
          </span>
        ) : (
          <span />
        )}
        <span className="text-xs font-semibold text-pink-600 transition group-hover:translate-x-0.5">{t('View details')} →</span>
      </div>
    </Card>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill={filled ? '#ec4899' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   DETAIL MODAL
───────────────────────────────────────────────────────────────────────── */

function ScholarshipDetailModal({
  scholarship: s,
  saved,
  onToggleSave,
  onClose,
  t,
}: {
  scholarship: DirectoryScholarship;
  saved: boolean;
  onToggleSave: () => void;
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
        <div className="-mx-1 -mt-1 mb-1 rounded-2xl bg-[linear-gradient(135deg,#FFE4F1,#F3E8FF)] px-4 py-3 pr-10">
          <h2 className="text-lg font-bold text-slate-900">{s.name}</h2>
          <p className="mt-1 text-sm text-slate-500">
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

        {/* Actions */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-pressed={saved}
            onClick={onToggleSave}
            className={`inline-flex h-11 items-center justify-center gap-2 rounded-full border-2 border-pink-500 px-5 text-sm font-semibold transition ${
              saved ? 'bg-pink-50 text-pink-600 hover:bg-pink-100' : 'bg-white text-pink-600 hover:bg-pink-50'
            }`}
          >
            <HeartIcon filled={saved} />
            {saved ? t('Saved to My Universities') : t('Save to My Universities')}
          </button>
          {s.source_url && (
            <a
              href={s.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-700"
            >
              {t('Official link')} <span aria-hidden>→</span>
            </a>
          )}
        </div>
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
