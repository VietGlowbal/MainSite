'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { clearFocusUniversity, getFocusUniversity, setFocusUniversity } from '@/lib/selection-cache';
import { TID, testId } from '@/shared/lib/testids';
import { useLanguage } from '@/lib/i18n';
import { getLocaleText, localizePath, type Locale } from '@/lib/i18n/locale';
import { AutoTranslate } from '@/lib/use-auto-translate';
import {
  FUNDING_TYPES,
  FUNDING_TYPE_LABELS,
  SCHOLARSHIP_SCOPE_LABELS,
} from '@/lib/scholarship-constants';
import type { DirectoryScholarship } from '@/lib/scholarships-data';
import {
  parseScholarshipSearchParams,
  scholarshipSearchParams,
  type Page,
  type ScholarshipFacets,
  type ScholarshipDegree,
  type ScholarshipMajor,
  type ScholarshipQueryState,
  type ScholarshipSort,
} from '@/features/scholarships/directory-query';
import { scorePersonalMatch, scholarshipSaveDestination } from '@/features/scholarships/domain';
import type { ScholarshipDirectoryResponse } from '@/features/scholarships/directory-loader';
import { useDebouncedSearchField } from '@/shared/hooks/use-debounced-search-field';
import { useDirectoryNavigation } from '@/shared/hooks/use-directory-navigation';
import {
  ScholarshipUniversityPicker,
  type ScholarshipUniversityOption,
} from './scholarship-university-picker';
import { usePlusStatus } from '@/features/plus';

const ScholarshipDashboard = dynamic(
  () => import('./scholarship-dashboard').then((module) => module.ScholarshipDashboard),
  {
    loading: () => (
      <div
        className="min-h-[420px] animate-pulse rounded-2xl border border-line bg-surface"
        aria-label="Loading course matches"
      />
    ),
  },
);

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

const RESTORING_FOCUS_KEY = 'glowbal-restoring-focus-university';

type Props = {
  queryState: ScholarshipQueryState;
  directoryPage: Page<DirectoryScholarship> | null;
  focusPage: Page<DirectoryScholarship> | null;
  countryPage: Page<DirectoryScholarship> | null;
  facets: ScholarshipFacets;
  savedUniversityIds: number[];
  savedCountries: string[];
  applications: Application[];
  existingScholarships: ExistingScholarship[];
  // Set when deep-linked from a university detail page (?university=<id>).
  focusUniversity?: { id: number; name: string; country: string | null } | null;
  // Only rows whose scholarship and university are both present in My Portal.
  savedScholarships?: Array<{ scholarshipId: number; universityId: number }>;
  canonicalSearch: string;
  isPlus?: boolean;
  locale?: Locale;
};

const MAJOR_FILTERS: ReadonlyArray<{ value: ScholarshipMajor; label: string }> = [
  { value: 'business', label: 'Business & economics' },
  { value: 'stem', label: 'STEM' },
  { value: 'arts', label: 'Arts & humanities' },
  { value: 'health', label: 'Health & medicine' },
  { value: 'law', label: 'Law' },
];

const DEGREE_FILTERS: ReadonlyArray<{ value: ScholarshipDegree; label: string }> = [
  { value: 'undergraduate', label: 'Undergraduate' },
  { value: 'postgraduate', label: 'Postgraduate' },
  { value: 'doctoral', label: 'Doctoral / PhD' },
];

function scholarshipHref(state: ScholarshipQueryState, patch: Partial<ScholarshipQueryState>, locale: Locale = 'en') {
  const params = scholarshipSearchParams(state, patch);
  return localizePath(params.size > 0 ? `/scholarships?${params}` : '/scholarships', locale);
}

function scholarshipPrefetchHrefs(data: ScholarshipDirectoryResponse, locale: Locale) {
  const hrefs: string[] = [];
  if (data.directoryPage?.hasMore || data.focusPage?.hasMore) {
    hrefs.push(scholarshipHref(data.query, { page: data.query.page + 1 }, locale));
  }
  if (data.countryPage?.hasMore) {
    hrefs.push(scholarshipHref(data.query, { countryPage: data.query.countryPage + 1 }, locale));
  }
  return hrefs;
}

export function ScholarshipDirectoryClient({
  queryState: initialQueryState,
  directoryPage: initialDirectoryPage,
  focusPage: initialFocusPage,
  countryPage: initialCountryPage,
  facets,
  savedUniversityIds,
  savedCountries,
  applications,
  existingScholarships,
  focusUniversity: initialFocusUniversity = null,
  savedScholarships = [],
  canonicalSearch,
  isPlus: initialIsPlus,
  locale = 'en',
}: Props) {
  const { t: contextT } = useLanguage();
  const t = locale === 'vi'
    ? (source: string, vars?: Record<string, string | number>) => getLocaleText(locale, source, vars)
    : contextT;
  const { isPlus } = usePlusStatus(initialIsPlus);
  const router = useRouter();
  const initialDirectory = useMemo<ScholarshipDirectoryResponse>(() => ({
    query: initialQueryState,
    directoryPage: initialDirectoryPage,
    focusPage: initialFocusPage,
    countryPage: initialCountryPage,
    focusUniversity: initialFocusUniversity,
    canonicalSearch,
  }), [
    canonicalSearch,
    initialCountryPage,
    initialDirectoryPage,
    initialFocusPage,
    initialFocusUniversity,
    initialQueryState,
  ]);
  const getPrefetchHrefs = useCallback((data: ScholarshipDirectoryResponse) => scholarshipPrefetchHrefs(data, locale), [locale]);
  const directory = useDirectoryNavigation({
    pathname: localizePath('/scholarships', locale),
    endpoint: '/api/directory/scholarships',
    initialData: initialDirectory,
    getPrefetchHrefs,
  });
  const publicData = initialQueryState.view === 'directory' ? directory.data : initialDirectory;
  const queryState = publicData.query;
  const directoryPage = publicData.directoryPage;
  const focusPage = publicData.focusPage;
  const countryPage = publicData.countryPage;
  const focusUniversityProp = publicData.focusUniversity;
  const tab = queryState.view;

  // The chosen university that scopes this page. Seeded from the ?university=
  // param (focusUniversityProp); when absent we restore the last-chosen one
  // from localStorage so it survives navigation (Universities → News →
  // Scholarships). When the param IS present we cache it for future visits.
  const focusUniversity = focusUniversityProp;
  useEffect(() => {
    if (focusUniversityProp) {
      sessionStorage.removeItem(RESTORING_FOCUS_KEY);
      setFocusUniversity({
        id: focusUniversityProp.id,
        name: focusUniversityProp.name,
        country: focusUniversityProp.country ?? '',
      });
    } else {
      if (sessionStorage.getItem(RESTORING_FOCUS_KEY)) {
        sessionStorage.removeItem(RESTORING_FOCUS_KEY);
        clearFocusUniversity();
        return;
      }
      const cached = getFocusUniversity();
      if (cached) {
        sessionStorage.setItem(RESTORING_FOCUS_KEY, String(cached.id));
        const params = scholarshipSearchParams(queryState, { universityId: cached.id });
        router.replace(localizePath(`/scholarships?${params}`, locale));
      }
    }
    // Run once on mount; the param is fixed for the page's lifetime.
  }, [focusUniversityProp, locale, queryState, router]);

  // A scholarship is "saved to My Universities" only when it has a concrete
  // destination university. Keeping the destination in state (instead of only
  // the scholarship id) makes Continue to Apply deterministic as well.
  const [savedDestinations, setSavedDestinations] = useState<Map<number, number>>(
    () => new Map(savedScholarships.map((row) => [row.scholarshipId, row.universityId])),
  );
  const savedIds = useMemo(
    () => new Set(savedDestinations.keys()),
    [savedDestinations],
  );
  const [savingIds, setSavingIds] = useState<Set<number>>(() => new Set());
  const initialDestination =
    savedScholarships.find((row) => row.universityId === focusUniversity?.id)?.universityId ??
    savedScholarships.at(-1)?.universityId ??
    null;
  const [lastSavedUniversityId, setLastSavedUniversityId] = useState<number | null>(
    initialDestination,
  );
  const [pendingSave, setPendingSave] = useState<{
    scholarship: DirectoryScholarship;
    mode: 'linked' | 'directory';
  } | null>(null);
  const [selected, setSelected] = useState<DirectoryScholarship | null>(null);
  const [universityOptions, setUniversityOptions] = useState<ScholarshipUniversityOption[]>([]);
  const [loadingUniversityOptions, setLoadingUniversityOptions] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const universityOptionsRequestRef = useRef(0);

  const setSaving = (scholarshipId: number, saving: boolean) => {
    setSavingIds((previous) => {
      const next = new Set(previous);
      if (saving) next.add(scholarshipId);
      else next.delete(scholarshipId);
      return next;
    });
  };

  const closeUniversityPicker = () => {
    if (pendingSave && savingIds.has(pendingSave.scholarship.id)) return;
    universityOptionsRequestRef.current += 1;
    setPendingSave(null);
    setUniversityOptions([]);
    setLoadingUniversityOptions(false);
    setSaveError(null);
  };

  const saveScholarship = async (s: DirectoryScholarship, universityId: number) => {
    setSaving(s.id, true);
    setSaveError(null);

    try {
      const supabase = (await import('@/lib/supabase/client')).createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth');
        return;
      }

      // Save the university first so a failed second write can never leave a
      // scholarship pointing at a portal row that does not exist. A retry is
      // safe because both writes are idempotent.
      const { error: universityError } = await supabase
        .from('user_universities')
        .upsert(
          { user_id: user.id, university_id: universityId, status: 'interested' },
          { onConflict: 'user_id,university_id', ignoreDuplicates: true },
        );
      if (universityError) throw universityError;

      const { error: scholarshipError } = await supabase
        .from('user_scholarships')
        .upsert(
          { user_id: user.id, scholarship_id: s.id, university_id: universityId },
          { onConflict: 'user_id,scholarship_id' },
        );
      if (scholarshipError) throw scholarshipError;

      setSavedDestinations((previous) => {
        const next = new Map(previous);
        next.set(s.id, universityId);
        return next;
      });
      setLastSavedUniversityId(universityId);
      setPendingSave(null);
      setUniversityOptions([]);
    } catch {
      setSaveError(t('Could not save this scholarship. Please try again.'));
    } finally {
      setSaving(s.id, false);
    }
  };

  const removeScholarship = async (s: DirectoryScholarship) => {
    setSaving(s.id, true);
    setSaveError(null);
    try {
      const supabase = (await import('@/lib/supabase/client')).createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth');
        return;
      }
      const { error } = await supabase
        .from('user_scholarships')
        .delete()
        .eq('user_id', user.id)
        .eq('scholarship_id', s.id);
      if (error) throw error;

      const remaining = new Map(savedDestinations);
      remaining.delete(s.id);
      setSavedDestinations(remaining);
      setLastSavedUniversityId([...remaining.values()].at(-1) ?? null);
    } catch {
      setSaveError(t('Could not remove this scholarship. Please try again.'));
    } finally {
      setSaving(s.id, false);
    }
  };

  const openUniversityPicker = async (
    s: DirectoryScholarship,
    mode: 'linked' | 'directory',
    linkedIds: number[] = [],
  ) => {
    const requestId = ++universityOptionsRequestRef.current;
    // The detail modal owns its own Escape and body-scroll effects. Remove it
    // before mounting the picker so only one dialog is active at a time.
    setSelected(null);
    setPendingSave({ scholarship: s, mode });
    setSaveError(null);

    const embedded = s.universities.filter(
      (university) => mode === 'directory' || linkedIds.includes(university.id),
    );
    if (mode === 'linked' && embedded.length === linkedIds.length) {
      setLoadingUniversityOptions(false);
      setUniversityOptions(embedded);
      return;
    }

    setLoadingUniversityOptions(true);
    setUniversityOptions([]);
    try {
      const supabase = (await import('@/lib/supabase/client')).createClient();
      let query = supabase
        .from('universities')
        .select('id, name, country')
        .order('name', { ascending: true })
        .limit(500);
      if (mode === 'linked') query = query.in('id', linkedIds);
      const { data, error } = await query;
      if (requestId !== universityOptionsRequestRef.current) return;
      if (error) throw error;

      const options = ((data ?? []) as ScholarshipUniversityOption[]).sort((left, right) => {
        if (mode === 'directory' && s.country) {
          const leftMatches = left.country === s.country;
          const rightMatches = right.country === s.country;
          if (leftMatches !== rightMatches) return leftMatches ? -1 : 1;
        }
        return left.name.localeCompare(right.name);
      });
      setUniversityOptions(options);
    } catch {
      if (requestId !== universityOptionsRequestRef.current) return;
      setSaveError(t('We could not load the university list. Please try again.'));
    } finally {
      if (requestId === universityOptionsRequestRef.current) {
        setLoadingUniversityOptions(false);
      }
    }
  };

  const toggleSave = async (s: DirectoryScholarship) => {
    if (savedDestinations.has(s.id)) {
      await removeScholarship(s);
      return;
    }

    const destination = scholarshipSaveDestination(s.universityIds);
    if (destination.kind === 'automatic') {
      await saveScholarship(s, destination.universityId);
      return;
    }
    await openUniversityPicker(
      s,
      destination.kind === 'choose-linked' ? 'linked' : 'directory',
      destination.kind === 'choose-linked' ? destination.universityIds : [],
    );
  };

  const goToApply = () => {
    const focus = lastSavedUniversityId ?? [...savedDestinations.values()].at(-1) ?? null;
    router.push(focus != null ? `/apply?focus=${focus}` : '/apply');
  };

  // Filters. Pagination for the full directory is 9 cards (3 columns × 3 rows).
  const resultsTopRef = useRef<HTMLDivElement>(null);

  /*
   * Every navigation patches onto `intendedRef`, never onto the `queryState`
   * captured when the caller rendered.
   *
   * A patch here is a delta -- `{ search: 'x' }` is merged over eleven other
   * filters -- so the base it merges onto has to be current. It often was not:
   * a debounced field fires up to 300ms after the render that scheduled it and
   * the response lands later still, so anything the reader touched in between
   * (a country, a sort, the other search box) was quietly reverted by the older
   * snapshot. Applying the patch optimistically and round-tripping it through
   * the same parser the server uses keeps the ref in exactly the shape the next
   * response will confirm, so back-to-back edits compose instead of racing.
   */
  const intendedRef = useRef(queryState);
  useEffect(() => {
    intendedRef.current = queryState;
  }, [queryState]);

  const navigate = useCallback(
    (patch: Partial<ScholarshipQueryState>, replace = true) => {
      const base = intendedRef.current;
      const params = scholarshipSearchParams(base, patch);
      intendedRef.current = parseScholarshipSearchParams(Object.fromEntries(params));
      const href = localizePath(
        params.size > 0 ? `/scholarships?${params}` : '/scholarships',
        locale,
      );
      if (base.view === 'ai' || intendedRef.current.view === 'ai') {
        if (replace) router.replace(href);
        else router.push(href);
        return;
      }
      directory.navigate(href, replace);
    },
    [directory, locale, router],
  );

  // Both boxes search as you type. The hook owns the debounce AND the rule that
  // a response never overwrites text typed while it was in flight -- see
  // useDebouncedSearchField for why re-seeding from the response was the bug.
  const searchField = useDebouncedSearchField({
    value: queryState.search,
    onCommit: (value) => navigate({ search: value }),
  });
  const universityField = useDebouncedSearchField({
    value: queryState.universitySearch,
    onCommit: (value) => navigate({ universitySearch: value }),
  });

  const scholarships = useMemo(
    () => [
      ...(directoryPage?.items ?? []),
      ...(focusPage?.items ?? []),
      ...(countryPage?.items ?? []),
    ],
    [countryPage, directoryPage, focusPage],
  );

  // Deep-link focus: split the directory into "at this university" + "same country".
  const focusHasMatches = (focusPage?.total ?? 0) > 0;

  // Personalization: which scholarships match the user's saved universities.
  const matchedIds = useMemo(() => {
    const set = new Set<number>();
    for (const s of scholarships) {
      if (scorePersonalMatch(s, savedUniversityIds, savedCountries).matched) set.add(s.id);
    }
    return set;
  }, [scholarships, savedUniversityIds, savedCountries]);

  const fundingPresent = FUNDING_TYPES;
  const countriesPresent = facets.countries.map(({ value }) => value);
  const funding = new Set(queryState.funding);

  const hasActiveFilters =
    queryState.search !== '' ||
    queryState.universitySearch !== '' ||
    queryState.major !== 'all' ||
    queryState.degree !== 'all' ||
    funding.size > 0 ||
    queryState.country !== 'all' ||
    queryState.sort !== 'relevance';

  const sortVisible = (items: DirectoryScholarship[]) => {
    if (queryState.sort !== 'relevance') return items;
    return [...items].sort((a, b) => {
      const matched = Number(matchedIds.has(b.id)) - Number(matchedIds.has(a.id));
      return matched || a.name.localeCompare(b.name);
    });
  };
  const directoryItems = sortVisible(directoryPage?.items ?? []);
  const sectionAtUni = sortVisible(focusPage?.items ?? []);
  const sectionSameCountry = sortVisible(countryPage?.items ?? []);

  // Reset to the first page whenever the result set changes (filters/search/sort).
  const pageCount = (value: Page<DirectoryScholarship> | null) =>
    Math.max(1, Math.ceil((value?.total ?? 0) / 9));

  const goToPage = (key: 'page' | 'countryPage', page: number) => {
    navigate({ [key]: page }, false);
    resultsTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // When deep-linked from a university, split the filtered list into two sections.
  const sectioned = Boolean(focusUniversity && focusHasMatches);

  const clearFilters = () => {
    navigate({
      search: '',
      universitySearch: '',
      major: 'all',
      degree: 'all',
      funding: [],
      country: 'all',
      sort: 'relevance',
    });
  };

  const showAllScholarships = () => {
    clearFocusUniversity();
    navigate({ universityId: null, countryPage: 1 });
  };

  const renderGrid = (items: DirectoryScholarship[], page = 1) => {
    const isBlurred = !isPlus && page >= 2;

    return (
      <div className="relative">
        <div
          className={`grid gap-5 sm:grid-cols-2 xl:grid-cols-3 transition-all ${
            isBlurred ? 'filter blur-md opacity-40 select-none pointer-events-none' : ''
          }`}
          {...testId(TID.scholarshipList)}
        >
          {items.map((s) => (
            <ScholarshipDirectoryCard
              key={s.id}
              scholarship={s}
              matched={matchedIds.has(s.id)}
              saved={savedIds.has(s.id)}
              busy={savingIds.has(s.id)}
              onOpen={() => setSelected(s)}
              onToggleSave={() => toggleSave(s)}
              t={t}
            />
          ))}
        </div>

        {isBlurred && (
          <div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-transparent via-white/70 to-white"
          >
            <div className="max-w-md rounded-2xl border border-[#EDE9EE] bg-white p-6 sm:p-8 shadow-xl">
              <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-[#FFF0F3] text-xl">
                🔒
              </div>
              <h3 className="text-base sm:text-lg font-bold text-[#141118]">
                {t('See all 3000 scholarships')}
              </h3>
              <p className="mt-2 text-xs text-[#6B6570] leading-relaxed max-w-sm">
                {t('Upgrade to GlowBal Plus to browse all 3000+ scholarships worldwide, unlock advanced filtering and tailored application requirements.')}
              </p>
              <button
                type="button"
                onClick={() => router.push('/plus')}
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-[#E11D48] px-6 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-[#B01238] transition-all cursor-pointer"
              >
                <span>{t('See all 3000 scholarships')}</span>
                <span>→</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    // Extra bottom padding when the floating "Continue to Apply" bar is shown,
    // so it doesn't overlap the pagination control at the end of the list.
    <div
      className={`space-y-8 ${savedIds.size > 0 ? 'pb-28' : ''}`}
      aria-busy={tab === 'directory' && directory.busy}
    >
      {/* Header — the high contrast editorial treatment is shared with the new
          university screens, while the data-driven highlights make the directory
          feel useful before a student has entered a filter. */}
      <section className="relative isolate overflow-hidden rounded-[28px] bg-surface-inverse-deep px-6 py-8 text-fg-on-inverse shadow-gb-lg sm:px-10 sm:py-10">
        <div className="absolute -right-20 -top-28 h-72 w-72 rounded-full bg-brand opacity-90 blur-3xl" aria-hidden />
        <div className="absolute bottom-0 right-1/4 h-40 w-40 rounded-full border border-line-on-inverse opacity-60" aria-hidden />
        <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-line-on-inverse bg-white/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-fg-on-inverse-secondary">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              {t('Funding opportunities, curated for you')}
            </div>
            <h1 className="font-[family-name:var(--font-gb-display)] text-4xl font-semibold tracking-[-0.035em] text-fg-on-inverse sm:text-5xl">
              {t('Scholarship library')}
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-fg-on-inverse-secondary sm:text-lg">
              {t('Explore verified funding opportunities, save your strongest fits, and turn your university plans into a clearer path forward.')}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:min-w-[430px]">
            <HeroMetric value={facets.total.toLocaleString()} label={t('opportunities')} />
            <HeroMetric value={String(matchedIds.size)} label={t('matched on this page')} />
            <HeroMetric value={String(savedIds.size)} label={t('saved')} className="col-span-2 sm:col-span-1" />
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="flex w-full gap-1 rounded-2xl border border-line bg-surface p-1.5 shadow-gb-xs sm:w-fit">
        <button
          type="button"
          onClick={() => navigate({ view: 'directory' }, false)}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            tab === 'directory' ? 'bg-surface-inverse text-fg-on-inverse shadow-sm' : 'text-fg-tertiary hover:bg-surface-muted hover:text-fg'
          }`}
        >
          {t('Directory')}
        </button>
        <button
          type="button"
          onClick={() => navigate({ view: 'ai' }, false)}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition ${
            tab === 'ai' ? 'bg-surface-inverse text-fg-on-inverse shadow-sm' : 'text-fg-tertiary hover:bg-surface-muted hover:text-fg'
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
          <section className="space-y-4">
            <form
              className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto]"
              onSubmit={(event) => {
                event.preventDefault();
                // Enter / "Find scholarships" should not wait out the debounce.
                const search = searchField.takePending();
                const universitySearch = universityField.takePending();
                if (
                  search !== queryState.search ||
                  universitySearch !== queryState.universitySearch
                ) {
                  navigate({ search, universitySearch });
                }
                resultsTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >
              <label className="relative block">
                <span className="sr-only">{t('Search scholarships by name')}</span>
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted">
                  <SearchIcon />
                </span>
                <input
                  type="search"
                  {...searchField.inputProps}
                  maxLength={100}
                  placeholder={t('Search by scholarship name')}
                  className="h-11 w-full rounded-gb-md border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-fg shadow-gb-xs outline-none placeholder:text-fg-muted transition focus:border-brand focus:ring-4 focus:ring-brand-subtle"
                />
              </label>

              <label className="relative block">
                <span className="sr-only">{t('Where do you want to study')}</span>
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
                  <Image src="/brand/scholarship-filter-map-pin.svg" alt="" width={14} height={17} />
                </span>
                <select
                  value={queryState.country}
                  onChange={(event) => navigate({ country: event.target.value })}
                  className="h-11 w-full appearance-none rounded-gb-md border border-line-strong bg-surface py-2 pl-9 pr-9 text-sm text-fg shadow-gb-xs outline-none transition focus:border-brand focus:ring-4 focus:ring-brand-subtle"
                >
                  <option value="all">{t('Where do you want to study')}</option>
                  {countriesPresent.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <FilterChevron />
              </label>

              <label className="relative block">
                <span className="sr-only">{t('Select major')}</span>
                <select
                  value={queryState.major}
                  onChange={(event) => navigate({ major: event.target.value as ScholarshipMajor })}
                  className="h-11 w-full appearance-none rounded-gb-md border border-line-strong bg-surface px-3 pr-9 text-sm text-fg shadow-gb-xs outline-none transition focus:border-brand focus:ring-4 focus:ring-brand-subtle"
                >
                  <option value="all">{t('Select major')}</option>
                  {MAJOR_FILTERS.map((filter) => (
                    <option key={filter.value} value={filter.value}>
                      {t(filter.label)}
                    </option>
                  ))}
                </select>
                <FilterChevron />
              </label>

              <label className="relative block">
                <span className="sr-only">{t('Search by university name')}</span>
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted">
                  <SearchIcon />
                </span>
                <input
                  type="search"
                  {...universityField.inputProps}
                  maxLength={100}
                  placeholder={t('Search by university name')}
                  className="h-11 w-full rounded-gb-md border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-fg shadow-gb-xs outline-none placeholder:text-fg-muted transition focus:border-brand focus:ring-4 focus:ring-brand-subtle"
                />
              </label>

              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center rounded-gb-md bg-gb-blue-600 px-gb-lg text-sm font-semibold text-white shadow-gb-xs-skeuomorphic transition hover:brightness-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-gb-blue-600/25"
              >
                {t('Find scholarships')}
              </button>
            </form>
            <p className="text-gb-xl text-fg">{t('Choose by criteria')}</p>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                aria-pressed={queryState.sort === 'relevance'}
                onClick={() => navigate({ sort: 'relevance' })}
                className="inline-flex h-11 items-center rounded-gb-md border border-line-strong bg-surface px-gb-btn-xl text-sm text-fg-tertiary shadow-gb-xs-skeuomorphic transition hover:bg-surface-hover focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-subtle"
              >
                {t('Popular')}
              </button>

              <label className="relative block">
                <span className="sr-only">{t('Study level')}</span>
                <select
                  value={queryState.degree}
                  onChange={(event) => navigate({ degree: event.target.value as ScholarshipDegree })}
                  className="h-11 appearance-none rounded-gb-md border border-line-strong bg-surface px-gb-btn-xl pr-10 text-sm text-fg-tertiary shadow-gb-xs-skeuomorphic outline-none transition focus:border-brand focus:ring-4 focus:ring-brand-subtle"
                >
                  <option value="all">{t('Study level')}</option>
                  {DEGREE_FILTERS.map((filter) => (
                    <option key={filter.value} value={filter.value}>
                      {t(filter.label)}
                    </option>
                  ))}
                </select>
                <FilterChevron />
              </label>
              <label className="relative block">
                <span className="sr-only">{t('Scholarship value')}</span>
                <select
                  value={funding.size === 1 ? [...funding][0] : 'all'}
                  onChange={(event) =>
                    navigate({
                      funding:
                        event.target.value === 'all'
                          ? []
                          : [event.target.value as ScholarshipQueryState['funding'][number]],
                    })
                  }
                  className="h-11 appearance-none rounded-gb-md border border-line-strong bg-surface px-gb-btn-xl pr-10 text-sm text-fg-tertiary shadow-gb-xs-skeuomorphic outline-none transition focus:border-brand focus:ring-4 focus:ring-brand-subtle"
                >
                  <option value="all">{t('Scholarship value')}</option>
                  {fundingPresent.map((type) => (
                    <option key={type} value={type}>
                      {t(FUNDING_TYPE_LABELS[type])}
                    </option>
                  ))}
                </select>
                <FilterChevron />
              </label>

              <label className="relative block">
                <span className="sr-only">{t('Competition rate')}</span>
                <select
                  value={queryState.sort}
                  onChange={(event) => navigate({ sort: event.target.value as ScholarshipSort })}
                  className="h-11 appearance-none rounded-gb-md border border-line-strong bg-surface px-gb-btn-xl pr-10 text-sm text-fg-tertiary shadow-gb-xs-skeuomorphic outline-none transition focus:border-brand focus:ring-4 focus:ring-brand-subtle"
                >
                  <option value="relevance">{t('Competition rate')}</option>
                  <option value="deadline">{t('Deadline (soonest)')}</option>
                  <option value="name">{t('Name (A-Z)')}</option>
                </select>
                <FilterChevron />
              </label>

              <label className="hidden">
                {t('Sort by')}:
                <select
                  value={queryState.sort}
                  onChange={(e) => navigate({ sort: e.target.value as ScholarshipSort })}
                  className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-fg outline-none focus:border-brand"
                >
                  <option value="relevance">{t('Relevance')}</option>
                  <option value="deadline">{t('Deadline (soonest)')}</option>
                  <option value="name">{t('Name (A–Z)')}</option>
                </select>
              </label>

            </div>
          </section>

          {sectioned ? (
            /* Deep-linked from a university → two labelled sections. */
            <div className="space-y-8">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-slate-500">
                  {t('Funding picked for {name}', { name: focusUniversity!.name })}
                </p>
                <button
                  type="button"
                  onClick={showAllScholarships}
                  className="shrink-0 text-xs font-medium text-pink-600 hover:text-pink-700"
                >
                  {t('Show all scholarships')}
                </button>
              </div>

              <section>
                <SectionBanner>{t('Scholarships at {name}', { name: focusUniversity!.name })}</SectionBanner>
                {renderGrid(sectionAtUni, focusPage?.page ?? 1)}
                <Pagination
                  page={focusPage!.page}
                  pageCount={pageCount(focusPage)}
                  onChange={(page) => goToPage('page', page)}
                />
              </section>

              {(countryPage?.total ?? 0) > 0 && (
                <section>
                  <SectionBanner>
                    {focusUniversity!.country
                      ? t('Other scholarships in {country}', { country: focusUniversity!.country })
                      : t('Other scholarships')}
                  </SectionBanner>
                  {renderGrid(sectionSameCountry, countryPage?.page ?? 1)}
                  <Pagination
                    page={countryPage!.page}
                    pageCount={pageCount(countryPage)}
                    onChange={(page) => goToPage('countryPage', page)}
                  />
                </section>
              )}
            </div>
          ) : (
            <>
              {/* Focus uni had no linked scholarships → note + full directory. */}
              {focusUniversity && !focusHasMatches && (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-pink-200 bg-pink-50/70 px-3 py-2 text-sm">
                  <span className="text-slate-600">
                    {t('No scholarships are linked to {name} yet — showing the full directory.', {
                      name: focusUniversity.name,
                    })}
                  </span>
                  <button
                    type="button"
                    onClick={showAllScholarships}
                    className="ml-auto text-xs font-medium text-pink-600 hover:text-pink-700"
                  >
                    {t('Dismiss')}
                  </button>
                </div>
              )}

              {/* Personalized note */}
              {queryState.sort === 'relevance' && matchedIds.size > 0 && !hasActiveFilters && (
                <p className="flex items-center gap-2 text-xs font-medium text-fg-secondary">
                  <span className="inline-block h-2 w-2 rounded-full bg-brand shadow-[0_0_0_4px_var(--color-brand-subtle)]" />
                  {t('Matched to your saved universities on this page')}
                </p>
              )}

              {/* Results */}
              {directoryItems.length === 0 ? (
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
                  {renderGrid(directoryItems, directoryPage?.page ?? 1)}
                  <Pagination
                    page={directoryPage!.page}
                    pageCount={pageCount(directoryPage)}
                    onChange={(page) => goToPage('page', page)}
                  />
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
          busy={savingIds.has(selected.id)}
          onToggleSave={() => toggleSave(selected)}
          onClose={() => setSelected(null)}
          t={t}
        />
      )}

      {pendingSave ? (
        <ScholarshipUniversityPicker
          open
          mode={pendingSave.mode}
          options={universityOptions}
          loading={loadingUniversityOptions}
          saving={savingIds.has(pendingSave.scholarship.id)}
          error={saveError}
          onClose={closeUniversityPicker}
          onSave={(universityId) => {
            void saveScholarship(pendingSave.scholarship, universityId);
          }}
          t={t}
        />
      ) : null}

      {tab === 'directory' && directory.error ? (
        <p role="alert" className="text-sm text-error-primary">{directory.error}</p>
      ) : null}

      {saveError && !pendingSave ? (
        <div className="fixed inset-x-4 bottom-24 z-40 mx-auto max-w-gb-width-sm rounded-gb-lg border border-line-error bg-surface p-gb-xl text-gb-sm font-medium text-fg-error shadow-gb-lg sm:bottom-28">
          <p role="alert">{saveError}</p>
        </div>
      ) : null}

      {/* Sticky "Continue to Apply" bar — appears once anything is saved. */}
      {savedIds.size > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4 sm:bottom-8">
          <div className="pointer-events-auto flex max-w-full items-center gap-3 rounded-gb-xl border border-brand bg-surface px-3 py-3 shadow-gb-lg backdrop-blur sm:gap-5 sm:pl-5">
            <span className="min-w-0 truncate text-sm font-semibold text-fg-secondary">
              {t('{count} scholarship(s) saved', { count: savedIds.size })}
            </span>
            <button
              type="button"
              onClick={goToApply}
              disabled={savingIds.size > 0}
              {...testId(TID.scholarshipContinueToApply)}
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-gb-md bg-brand px-4 text-sm font-semibold text-on-brand shadow-gb-xs-skeuomorphic transition hover:bg-brand-hover disabled:cursor-wait disabled:opacity-60 sm:px-5"
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
    <div className="mb-5 inline-flex items-center rounded-full bg-brand px-4 py-2 text-sm font-semibold text-on-brand shadow-gb-xs">
      {children}
    </div>
  );
}

function HeroMetric({ value, label, className = '' }: { value: string; label: string; className?: string }) {
  return (
    <div className={`rounded-2xl border border-line-on-inverse bg-white/10 px-4 py-3 backdrop-blur-sm ${className}`}>
      <p className="font-[family-name:var(--font-gb-display)] text-2xl font-semibold tracking-tight text-fg-on-inverse">{value}</p>
      <p className="mt-0.5 text-xs font-medium text-fg-on-inverse-secondary">{label}</p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   FILTER CHIP
───────────────────────────────────────────────────────────────────────── */

function FilterChevron() {
  return (
    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
      <Image src="/brand/scholarship-filter-chevron-down.svg" alt="" width={12} height={7} />
    </span>
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
  busy,
  onOpen,
  onToggleSave,
  t,
}: {
  scholarship: DirectoryScholarship;
  matched: boolean;
  saved: boolean;
  busy: boolean;
  onOpen: () => void;
  onToggleSave: () => void;
  t: Translate;
}) {
  return (
    <Card
      size="md"
      padding="md"
      interactive
      className="group relative flex min-h-[342px] cursor-pointer flex-col border-line bg-surface shadow-gb-xs hover:border-line-strong"
      onClick={onOpen}
      {...testId(TID.scholarshipCard)}
    >
      {/* Save heart — top-right corner, matching the university cards */}
      <button
        type="button"
        aria-pressed={saved}
        aria-busy={busy}
        disabled={busy}
        aria-label={saved ? t('Saved to My Universities') : t('Save to My Universities')}
        onClick={(e) => {
          e.stopPropagation();
          onToggleSave();
        }}
        className={`absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
          saved ? 'border-brand-subtle bg-brand-subtle text-brand' : 'border-line bg-surface text-fg-muted hover:border-brand hover:text-brand'
        }`}
      >
        <HeartIcon filled={saved} />
      </button>

      {/* Header */}
      <div className="mb-5 pr-11">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-surface-muted px-2.5 py-1 text-[11px] font-semibold text-fg-secondary">
            {t(SCHOLARSHIP_SCOPE_LABELS[s.scope])}
          </span>
          {matched && <span className="rounded-full bg-brand-subtle px-2.5 py-1 text-[11px] font-semibold text-fg-brand">{t('For you')}</span>}
        </div>
        <h3 className="font-[family-name:var(--font-gb-display)] text-xl font-semibold leading-[1.15] tracking-[-0.025em] text-fg line-clamp-2 transition group-hover:text-fg-brand">{s.name}</h3>
        <p className="mt-2 truncate text-sm text-fg-tertiary">
          {s.countryFlag && <span className="mr-1">{s.countryFlag}</span>}
          {s.provider || s.country || t(SCHOLARSHIP_SCOPE_LABELS[s.scope])}
        </p>
      </div>

      {/* Amount / coverage */}
      {(s.amountLabel || s.coverage) && (
        <div className="mb-4 rounded-2xl border border-brand-subtle bg-brand-subtle px-4 py-3">
          {s.amountLabel ? (
            <p className="font-[family-name:var(--font-gb-display)] text-xl font-semibold tracking-tight text-fg-brand">{s.amountLabel}</p>
          ) : (
            <AutoTranslate
              as="p"
              className="text-sm font-semibold text-fg-brand line-clamp-2"
              text={s.coverage}
            />
          )}
          {s.amountLabel && s.coverage && (
            <AutoTranslate as="p" className="mt-1 text-xs text-fg-brand/80 line-clamp-1" text={s.coverage} />
          )}
        </div>
      )}

      {/* Funding-type tags */}
      {s.funding_type.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
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
          className="mb-4 text-sm leading-6 text-fg-tertiary line-clamp-2"
          text={s.eligibility}
        />
      )}

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between border-t border-line pt-4">
        {s.deadlineLabel ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-fg-tertiary">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
            {s.deadlineLabel}
          </span>
        ) : (
          <span />
        )}
        <span className="text-sm font-semibold text-fg-brand transition group-hover:translate-x-0.5">{t('View details')} →</span>
      </div>
    </Card>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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
  busy,
  onToggleSave,
  onClose,
  t,
}: {
  scholarship: DirectoryScholarship;
  saved: boolean;
  busy: boolean;
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
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/65 p-4 backdrop-blur-sm sm:items-center sm:p-8"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="my-auto w-full max-w-[806px] rounded-gb-xl border border-line bg-surface p-4 shadow-gb-lg sm:p-gb-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Figma 337:19483 — an intentional, compact voucher detail layout. */}
        <header className="flex items-start gap-4 rounded-gb-lg border border-line bg-surface px-4 py-3 sm:items-center sm:px-6 sm:py-4">
          <h2 className="min-w-0 flex-1 font-[family-name:var(--font-gb-display)] text-xl font-semibold leading-7 tracking-[-0.02em] text-fg sm:text-2xl">
            {s.name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-gb-md border border-line-strong bg-surface px-3 py-2 text-sm font-semibold text-fg-secondary shadow-gb-xs-skeuomorphic transition hover:bg-surface-hover"
          >
            {t('Back')}
          </button>
        </header>

        <div className="mt-5 flex flex-wrap gap-2">
          <DetailBadge>{t(SCHOLARSHIP_SCOPE_LABELS[s.scope])}</DetailBadge>
          {s.funding_type.map((ft) => (
            <DetailBadge key={ft}>{t(FUNDING_TYPE_LABELS[ft as keyof typeof FUNDING_TYPE_LABELS] ?? ft)}</DetailBadge>
          ))}
        </div>

        <section className="mt-6 rounded-gb-lg border border-line bg-surface p-4 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="flex h-20 w-full shrink-0 items-center justify-center rounded-gb-md border-b border-line pb-5 text-3xl sm:h-24 sm:w-40 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-5">
              {s.countryFlag ?? '🎓'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-fg-secondary">{t('Scholarship value')}</p>
              {s.amountLabel && <p className="mt-1 font-[family-name:var(--font-gb-display)] text-3xl font-semibold tracking-[-0.03em] text-fg-brand">{s.amountLabel}</p>}
              {s.coverage && <AutoTranslate as="p" className="mt-2 text-sm leading-6 text-fg-secondary" text={s.coverage} />}
              {s.deadlineLabel && <p className="mt-3 text-sm font-semibold text-fg-tertiary">{t('Deadline')}: {s.deadlineLabel}</p>}
            </div>
          </div>
        </section>

        <div className="mt-6 space-y-5">
          <Section label={t('Eligibility')} text={s.eligibility} />
          <Section label={t('Conditions')} text={s.conditions} />
          <Section label={t('Insight')} text={s.insight} />
          {s.ranking_note && <Section label={t('Ranking / acceptance')} text={s.ranking_note} />}
        </div>

        {/* Applicable universities */}
        {s.universities.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-2 text-sm font-semibold text-fg">
              {t('Applicable universities')}
            </h3>
            <div className="flex flex-wrap gap-2">
              {s.universities.map((u) => (
                <span
                  key={u.id}
                  className="inline-flex items-center gap-1 rounded-full border border-brand-subtle bg-brand-subtle px-3 py-1.5 text-xs font-medium text-fg-brand"
                >
                  {u.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <button
            type="button"
            aria-pressed={saved}
            aria-busy={busy}
            disabled={busy}
            onClick={onToggleSave}
            className={`inline-flex h-11 items-center justify-center gap-2 rounded-gb-md border-2 border-brand px-5 text-sm font-semibold transition disabled:cursor-wait disabled:opacity-60 ${
              saved ? 'bg-brand-subtle text-fg-brand hover:bg-brand-surface' : 'bg-surface text-fg-brand hover:bg-brand-subtle'
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
              className="inline-flex h-11 items-center gap-2 rounded-gb-md bg-surface-inverse px-5 text-sm font-semibold text-fg-on-inverse shadow-gb-xs-skeuomorphic transition hover:bg-surface-inverse-strong"
            >
              {t('Official link')} <span aria-hidden>→</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-brand-subtle bg-brand-subtle px-3 py-1.5 text-xs font-medium text-fg-brand">{children}</span>
  );
}

function Section({ label, text }: { label: string; text: string | null }) {
  if (!text) return null;
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold text-fg">{label}</h3>
      <AutoTranslate as="p" className="whitespace-pre-line text-sm leading-6 text-fg-secondary" text={text} />
    </section>
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
