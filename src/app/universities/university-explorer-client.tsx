'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useScroll } from 'framer-motion';
import {
  UniversityExplorerProvider,
  useExplorer,
  type ExplorerUniversity,
  type ApplicationEntry,
} from '@/lib/explorer-context';
import { MatchBadge } from '@/components/match-badge';

const CompactGlobeDynamic = dynamic(
  () => import('@/components/landing-globe').then((mod) => ({ default: mod.LandingGlobe })),
  { ssr: false },
);

/* ─────────────────────────────────────────────────────────────────────────
   COUNTRY FLAGS (emoji) — for inline use on cards
───────────────────────────────────────────────────────────────────────── */

const COUNTRY_FLAGS: Record<string, string> = {
  'United States': '🇺🇸', 'United Kingdom': '🇬🇧', Canada: '🇨🇦',
  Australia: '🇦🇺', Germany: '🇩🇪', Netherlands: '🇳🇱', France: '🇫🇷',
  Singapore: '🇸🇬', Japan: '🇯🇵', Switzerland: '🇨🇭', Ireland: '🇮🇪',
  Sweden: '🇸🇪', Spain: '🇪🇸', Italy: '🇮🇹', 'South Korea': '🇰🇷',
  'Hong Kong': '🇭🇰', 'New Zealand': '🇳🇿', 'United Arab Emirates': '🇦🇪',
  Qatar: '🇶🇦', China: '🇨🇳', India: '🇮🇳',
};

/* ─────────────────────────────────────────────────────────────────────────
   PROGRAMS — derived from data
───────────────────────────────────────────────────────────────────────── */

const PROGRAM_OPTIONS = [
  'Engineering',
  'Business',
  'Computer Science',
  'Medicine',
  'Arts',
  'Data Science',
  'Law',
  'Architecture',
  'Economics',
];

const POPULAR_SEARCHES = ['Engineering', 'Business', 'Computer Science', 'Medicine', 'Arts', 'Data Science'];

/* ─────────────────────────────────────────────────────────────────────────
   IMPROVE YOUR SEARCH — replaces the old QuizStickyBar.
   ────────────────────────────────────────────────────────────────────────
   This is a small, optional, in-page pill that nudges users towards the
   onboarding without ever taking over the page. It sits unobtrusively in
   the page header area and is dismissable. The pop-up sticky bar that
   used to scroll into view has been removed entirely — first-time
   visitors are sent directly to the onboarding instead (see
   FirstTimeOnboardingRedirect in the page file).
───────────────────────────────────────────────────────────────────────── */

function ImproveSearchPill() {
  const router = useRouter();
  const { isLoggedIn, hasProfile } = useExplorer();
  if (isLoggedIn && hasProfile) return null;

  return (
    <button
      type="button"
      onClick={() => router.push('/onboarding?from=search')}
      title="Take the 60-second quiz so we can personalise your matches"
      className="inline-flex items-center gap-2 rounded-full border border-pink-200 bg-pink-50 px-3 py-1.5 text-xs font-semibold text-pink-700 hover:bg-pink-100 transition"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-pink-500" aria-hidden />
      Improve your searches
      <span className="text-pink-400">→</span>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   SEARCH HERO — globe + 4-input search bar + popular searches
───────────────────────────────────────────────────────────────────────── */

type SearchState = {
  name: string;
  location: string;
  program: string;
};

function SearchHero({
  search,
  onSearchChange,
}: {
  search: SearchState;
  onSearchChange: (s: SearchState) => void;
}) {
  return (
    <section className="rounded-[2rem] border border-black/5 bg-white/95 px-6 py-6 shadow-[0_12px_32px_rgba(22,33,62,0.06)] backdrop-blur md:px-8 md:py-7">
      <div className="flex flex-col items-center gap-6 md:flex-row md:items-center">
        {/* Globe */}
        <div className="shrink-0">
          <div
            className="rounded-full bg-gradient-to-br from-cyan-300/30 to-pink-300/30 p-1 shadow-[0_0_40px_rgba(34,211,238,0.18)]"
            style={{ width: 140, height: 140 }}
          >
            <div className="rounded-full overflow-hidden bg-white" style={{ width: '100%', height: '100%' }}>
              <CompactGlobeDynamic theme="marble" size={132} rotateSpeed={0.4} />
            </div>
          </div>
        </div>

        {/* Search row */}
        <div className="flex-1 w-full">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">
            Find the right university, anywhere in the world
          </h1>

          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_180px_auto]">
            {/* Name search */}
            <div className="relative">
              <SearchIcon />
              <input
                type="text"
                placeholder="Search by university name"
                value={search.name}
                onChange={(e) => onSearchChange({ ...search, name: e.target.value })}
                className="w-full rounded-full border border-slate-200 bg-white pl-10 pr-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-100"
              />
            </div>

            {/* Location search */}
            <div className="relative">
              <PinIcon />
              <input
                type="text"
                placeholder="Where do you want to study?"
                value={search.location}
                onChange={(e) => onSearchChange({ ...search, location: e.target.value })}
                className="w-full rounded-full border border-slate-200 bg-white pl-10 pr-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-100"
              />
            </div>

            {/* Program select */}
            <div className="relative">
              <select
                value={search.program}
                onChange={(e) => onSearchChange({ ...search, program: e.target.value })}
                className="w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 appearance-none pr-9 focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-100 cursor-pointer"
              >
                <option value="">Select Program</option>
                {PROGRAM_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <ChevronIcon />
            </div>

            {/* Search button */}
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_22px_rgba(255,77,140,0.3)] transition hover:-translate-y-0.5"
            >
              <SearchIconWhite />
              Search
            </button>
          </div>

          {/* Popular searches */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">Popular searches:</span>
            {POPULAR_SEARCHES.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onSearchChange({ ...search, program: tag })}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500 transition hover:border-cyan-200 hover:text-cyan-700"
              >
                {tag}
              </button>
            ))}
            <div className="ml-auto">
              <ImproveSearchPill />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   FILTER STATE
───────────────────────────────────────────────────────────────────────── */

type FilterState = {
  quickFilter: 'all' | 'russell' | 'stem' | 'arts' | 'top50';
  countries: string[];
  qsRanking: 'all' | 'top50' | 'top100' | 'top200';
  tuition: 'all' | 'under_20k' | '20k_40k' | '40k_60k' | 'over_60k';
  acceptance: 'all' | 'under_10' | '10_30' | 'over_30';
  type: 'all' | 'public' | 'private';
  campusSetting: 'all' | 'urban' | 'suburban' | 'rural';
  scholarship: 'all' | 'available';
  deadline: 'all' | 'open' | 'soon';
};

const DEFAULT_FILTERS: FilterState = {
  quickFilter: 'all',
  countries: [],
  qsRanking: 'all',
  tuition: 'all',
  acceptance: 'all',
  type: 'all',
  campusSetting: 'all',
  scholarship: 'all',
  deadline: 'all',
};

// Count how many user-set filters are active (compared to DEFAULT_FILTERS)
function countActiveFilters(filters: FilterState): number {
  let n = 0;
  if (filters.quickFilter !== 'all') n += 1;
  if (filters.countries.length > 0) n += filters.countries.length;
  if (filters.qsRanking !== 'all') n += 1;
  if (filters.tuition !== 'all') n += 1;
  if (filters.acceptance !== 'all') n += 1;
  if (filters.type !== 'all') n += 1;
  if (filters.campusSetting !== 'all') n += 1;
  if (filters.scholarship !== 'all') n += 1;
  if (filters.deadline !== 'all') n += 1;
  return n;
}

const REGIONS: Record<string, string[]> = {
  'North America': ['United States', 'Canada'],
  Europe: ['United Kingdom', 'Germany', 'Netherlands', 'France', 'Switzerland', 'Ireland', 'Sweden', 'Spain', 'Italy'],
  Asia: ['Singapore', 'Japan', 'South Korea', 'Hong Kong', 'China', 'India', 'United Arab Emirates', 'Qatar'],
  'Australia & Oceania': ['Australia', 'New Zealand'],
  'South America': ['Brazil', 'Argentina', 'Chile'],
  Africa: ['South Africa', 'Egypt'],
};

/* ─────────────────────────────────────────────────────────────────────────
   FILTER SIDEBAR
───────────────────────────────────────────────────────────────────────── */

function FilterSection({
  title,
  icon,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-slate-100 pb-3 last:border-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
          {icon}
          {title}
        </span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {isOpen && <div className="mt-2 px-3 space-y-2">{children}</div>}
    </div>
  );
}

function FilterSidebar({
  filters,
  onChange,
  totalCount,
  onReset,
}: {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  totalCount: number;
  onReset: () => void;
}) {
  const [open, setOpen] = useState({
    quick: true,
    location: true,
    qs: false,
    tuition: false,
    acceptance: false,
    type: false,
    campus: false,
    scholarship: false,
    deadline: false,
  });
  const [countrySearch, setCountrySearch] = useState('');

  const toggle = (key: keyof typeof open) => setOpen((p) => ({ ...p, [key]: !p[key] }));

  const activeCount = countActiveFilters(filters);

  const matchedRegions = useMemo(() => {
    if (!countrySearch) return REGIONS;
    const q = countrySearch.toLowerCase();
    const filtered: typeof REGIONS = {};
    for (const [region, countries] of Object.entries(REGIONS)) {
      const matched = countries.filter((c) => c.toLowerCase().includes(q));
      if (matched.length > 0 || region.toLowerCase().includes(q)) {
        filtered[region] = matched.length > 0 ? matched : countries;
      }
    }
    return filtered;
  }, [countrySearch]);

  return (
    /*
     * Sticky-but-not-scrollable sidebar. We keep it sticky to the top
     * of the viewport so it stays in view, but instead of clamping the
     * height with `overflow: auto` (which produces an awful nested
     * scrollbar when sections are expanded), we let it grow naturally
     * along with its contents. The page itself becomes scrollable, so
     * users always scroll the *page* — never an inner panel.
     *
     * On tall expansions the sidebar can exceed the viewport. When
     * that happens we simply unstick it (via the `align-self: start`
     * default) so the user scrolls past it like a normal column.
     */
    <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm self-start">
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-sm font-semibold text-slate-900 inline-flex items-center gap-2">
          Refine results
          {activeCount > 0 && (
            <span className="rounded-full bg-pink-100 text-pink-600 px-1.5 py-0.5 text-[0.65rem] font-bold">
              {activeCount}
            </span>
          )}
        </h3>
        <button
          type="button"
          onClick={onReset}
          disabled={activeCount === 0}
          className="text-xs text-pink-600 hover:underline disabled:text-slate-300 disabled:no-underline disabled:cursor-not-allowed"
        >
          Clear all
        </button>
      </div>

      <div className="space-y-1">
        {/* Quick filters */}
        <FilterSection
          title="Quick filters"
          icon={<BoltIcon />}
          isOpen={open.quick}
          onToggle={() => toggle('quick')}
        >
          {([
            { value: 'all', label: 'All' },
            { value: 'russell', label: 'Russell Group' },
            { value: 'stem', label: 'STEM' },
            { value: 'arts', label: 'Arts & Humanities' },
            { value: 'top50', label: 'Global Top 50' },
          ] as const).map((opt) => (
            <RadioRow
              key={opt.value}
              label={opt.label}
              checked={filters.quickFilter === opt.value}
              onClick={() => onChange({ ...filters, quickFilter: opt.value })}
            />
          ))}
        </FilterSection>

        {/* Location */}
        <FilterSection
          title="Location"
          icon={<PinIconSmall />}
          isOpen={open.location}
          onToggle={() => toggle('location')}
        >
          <input
            type="text"
            placeholder="Search country or region"
            value={countrySearch}
            onChange={(e) => setCountrySearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:border-cyan-300 focus:outline-none focus:bg-white"
          />
          <div className="space-y-1.5 pr-1">
            {Object.entries(matchedRegions).map(([region, countries]) => {
              const allRegionSelected = countries.every((c) => filters.countries.includes(c));
              return (
                <div key={region}>
                  <CheckboxRow
                    label={region}
                    checked={allRegionSelected}
                    onClick={() => {
                      const next = new Set(filters.countries);
                      if (allRegionSelected) {
                        countries.forEach((c) => next.delete(c));
                      } else {
                        countries.forEach((c) => next.add(c));
                      }
                      onChange({ ...filters, countries: Array.from(next) });
                    }}
                    bold
                  />
                </div>
              );
            })}
          </div>
        </FilterSection>

        {/* QS Ranking */}
        <FilterSection
          title="QS Ranking"
          icon={<TrophyIcon />}
          isOpen={open.qs}
          onToggle={() => toggle('qs')}
        >
          {([
            { value: 'all', label: 'All rankings' },
            { value: 'top50', label: 'Top 50' },
            { value: 'top100', label: 'Top 100' },
            { value: 'top200', label: 'Top 200' },
          ] as const).map((opt) => (
            <RadioRow
              key={opt.value}
              label={opt.label}
              checked={filters.qsRanking === opt.value}
              onClick={() => onChange({ ...filters, qsRanking: opt.value })}
            />
          ))}
        </FilterSection>

        {/* Tuition */}
        <FilterSection
          title="Tuition Fees"
          icon={<DollarIcon />}
          isOpen={open.tuition}
          onToggle={() => toggle('tuition')}
        >
          {([
            { value: 'all', label: 'Any tuition' },
            { value: 'under_20k', label: 'Under $20,000' },
            { value: '20k_40k', label: '$20,000 – $40,000' },
            { value: '40k_60k', label: '$40,000 – $60,000' },
            { value: 'over_60k', label: 'Over $60,000' },
          ] as const).map((opt) => (
            <RadioRow
              key={opt.value}
              label={opt.label}
              checked={filters.tuition === opt.value}
              onClick={() => onChange({ ...filters, tuition: opt.value })}
            />
          ))}
        </FilterSection>

        {/* Acceptance Rate */}
        <FilterSection
          title="Acceptance Rate"
          icon={<PercentIcon />}
          isOpen={open.acceptance}
          onToggle={() => toggle('acceptance')}
        >
          {([
            { value: 'all', label: 'Any rate' },
            { value: 'under_10', label: 'Under 10% (very selective)' },
            { value: '10_30', label: '10% – 30%' },
            { value: 'over_30', label: 'Over 30%' },
          ] as const).map((opt) => (
            <RadioRow
              key={opt.value}
              label={opt.label}
              checked={filters.acceptance === opt.value}
              onClick={() => onChange({ ...filters, acceptance: opt.value })}
            />
          ))}
        </FilterSection>

        {/* Type */}
        <FilterSection
          title="Type of Institution"
          icon={<BuildingIcon />}
          isOpen={open.type}
          onToggle={() => toggle('type')}
        >
          {([
            { value: 'all', label: 'All types' },
            { value: 'public', label: 'Public' },
            { value: 'private', label: 'Private' },
          ] as const).map((opt) => (
            <RadioRow
              key={opt.value}
              label={opt.label}
              checked={filters.type === opt.value}
              onClick={() => onChange({ ...filters, type: opt.value })}
            />
          ))}
        </FilterSection>

        {/* Campus Setting */}
        <FilterSection
          title="Campus Setting"
          icon={<CampusIcon />}
          isOpen={open.campus}
          onToggle={() => toggle('campus')}
        >
          {([
            { value: 'all', label: 'Any setting' },
            { value: 'urban', label: 'Urban' },
            { value: 'suburban', label: 'Suburban' },
            { value: 'rural', label: 'Rural' },
          ] as const).map((opt) => (
            <RadioRow
              key={opt.value}
              label={opt.label}
              checked={filters.campusSetting === opt.value}
              onClick={() => onChange({ ...filters, campusSetting: opt.value })}
            />
          ))}
        </FilterSection>

        {/* Scholarship availability */}
        <FilterSection
          title="Scholarship"
          icon={<DollarIcon />}
          isOpen={open.scholarship}
          onToggle={() => toggle('scholarship')}
        >
          {([
            { value: 'all', label: 'Any' },
            { value: 'available', label: 'Scholarship available' },
          ] as const).map((opt) => (
            <RadioRow
              key={opt.value}
              label={opt.label}
              checked={filters.scholarship === opt.value}
              onClick={() => onChange({ ...filters, scholarship: opt.value })}
            />
          ))}
        </FilterSection>

        {/* Application deadline */}
        <FilterSection
          title="Application deadline"
          icon={<ClockIcon />}
          isOpen={open.deadline}
          onToggle={() => toggle('deadline')}
        >
          {([
            { value: 'all', label: 'Any' },
            { value: 'open', label: 'Currently open' },
            { value: 'soon', label: 'Closing in ≤ 60 days' },
          ] as const).map((opt) => (
            <RadioRow
              key={opt.value}
              label={opt.label}
              checked={filters.deadline === opt.value}
              onClick={() => onChange({ ...filters, deadline: opt.value })}
            />
          ))}
        </FilterSection>
      </div>

      <button
        type="button"
        className="mt-4 w-full rounded-full bg-[linear-gradient(135deg,#7c3aed,#FF3D9A)] py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(124,58,237,0.25)] transition hover:-translate-y-0.5"
      >
        Show {totalCount.toLocaleString()} results
      </button>
    </aside>
  );
}

function RadioRow({ label, checked, onClick }: { label: string; checked: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-md py-1.5 text-left text-sm text-slate-600 hover:text-slate-900 transition"
    >
      <span
        className={`flex h-4 w-4 items-center justify-center rounded-full border-2 transition ${
          checked ? 'border-pink-500' : 'border-slate-300'
        }`}
      >
        {checked && <span className="h-2 w-2 rounded-full bg-pink-500" />}
      </span>
      <span className={checked ? 'text-slate-900 font-medium' : ''}>{label}</span>
    </button>
  );
}

function CheckboxRow({ label, checked, onClick, bold }: { label: string; checked: boolean; onClick: () => void; bold?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-md py-1.5 text-left text-sm text-slate-600 hover:text-slate-900 transition"
    >
      <span
        className={`flex h-4 w-4 items-center justify-center rounded border-2 transition ${
          checked ? 'border-pink-500 bg-pink-500' : 'border-slate-300'
        }`}
      >
        {checked && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </span>
      <span className={`${checked ? 'text-slate-900' : ''} ${bold ? 'font-medium' : ''}`}>{label}</span>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   FILTER + SORT BAR (above grid)
───────────────────────────────────────────────────────────────────────── */

type SortKey = 'best_match' | 'rank_asc' | 'tuition_asc' | 'acceptance_asc';

function ResultsBar({
  totalCount,
  quickFilter,
  onQuickFilterChange,
  sort,
  onSortChange,
  view,
  onViewChange,
}: {
  totalCount: number;
  quickFilter: FilterState['quickFilter'];
  onQuickFilterChange: (q: FilterState['quickFilter']) => void;
  sort: SortKey;
  onSortChange: (s: SortKey) => void;
  view: 'grid' | 'list';
  onViewChange: (v: 'grid' | 'list') => void;
}) {
  const quickFilterOptions = [
    { value: 'all', label: 'All' },
    { value: 'russell', label: 'Russell Group' },
    { value: 'stem', label: 'STEM' },
    { value: 'arts', label: 'Arts & Humanities' },
    { value: 'top50', label: 'Global Top 50' },
  ] as const;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-sm text-slate-600">
        Showing <span className="font-semibold text-slate-900">{totalCount.toLocaleString()}</span> universities
      </p>

      <div className="flex flex-wrap gap-2 flex-1">
        {quickFilterOptions.map((opt) => {
          const isActive = quickFilter === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onQuickFilterChange(opt.value)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] text-white shadow-[0_4px_14px_rgba(255,77,140,0.25)]'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-pink-200'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Sort */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500 hidden sm:inline">Sort by:</span>
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value as SortKey)}
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-cyan-300 cursor-pointer"
        >
          <option value="best_match">Best Match</option>
          <option value="rank_asc">QS Rank: Best first</option>
          <option value="tuition_asc">Tuition: Low → High</option>
          <option value="acceptance_asc">Acceptance: Most selective</option>
        </select>
      </div>

      {/* View toggle */}
      <div className="hidden sm:flex items-center gap-1">
        <span className="text-xs text-slate-500">View</span>
        <div className="flex rounded-full border border-slate-200 bg-white p-0.5">
          <button
            type="button"
            onClick={() => onViewChange('grid')}
            aria-label="Grid view"
            className={`rounded-full p-1.5 transition ${view === 'grid' ? 'bg-pink-500 text-white' : 'text-slate-400 hover:text-slate-700'}`}
          >
            <GridIcon />
          </button>
          <button
            type="button"
            onClick={() => onViewChange('list')}
            aria-label="List view"
            className={`rounded-full p-1.5 transition ${view === 'list' ? 'bg-pink-500 text-white' : 'text-slate-400 hover:text-slate-700'}`}
          >
            <ListIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   UNIVERSITY CARD (matches demo design)
───────────────────────────────────────────────────────────────────────── */

function parseAcceptanceRate(rate: string | null | undefined): number | null {
  if (!rate) return null;
  const match = rate.match(/(\d+(\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

function parseTuition(tuition: string | null | undefined): number | null {
  if (!tuition) return null;
  const num = tuition.replace(/[^0-9.]/g, '');
  return num ? parseFloat(num) : null;
}

/**
 * Compact presentation of an acceptance-rate string for the stat row.
 * The DB stores values like "14–18% overall; Engineering/Medicine
 * competitive" — too noisy for a 3-column grid. We pick the first
 * percentage and pair it with `~` if the original looks like a range
 * ("4–5%", "10-15%"). The full string is shown as a tooltip on hover.
 */
function formatAcceptanceForCard(rate: string | null | undefined): string {
  if (!rate) return '—';
  const trimmed = rate.trim();
  if (!trimmed || trimmed === '—') return '—';
  // First "%" expression in the string — covers "5%", "14–18%", "4-5%".
  const m = trimmed.match(/(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)\s*%/);
  if (m) return `${m[1]}–${m[2]}%`;
  const single = trimmed.match(/(\d+(?:\.\d+)?)\s*%/);
  if (single) return `${single[1]}%`;
  return trimmed.length > 12 ? `${trimmed.slice(0, 11).trim()}…` : trimmed;
}

/**
 * Compact tuition string for the stat row. Picks the first dollar /
 * numeric value, prefixes with `$`, and condenses k-suffixes — so
 * "42,000-65,000 USD" becomes "$42–65k", "59,320 (UG); ~$65,000"
 * becomes "$59k", and "Free" stays as "Free".
 */
function formatTuitionForCard(tuition: string | null | undefined): string {
  if (!tuition) return '—';
  const trimmed = tuition.trim();
  if (!trimmed || trimmed === '—') return '—';
  if (/free/i.test(trimmed)) return 'Free';

  // Pull the first run of numbers. We don't try to parse multi-currency
  // mess — just show the first thousand-grouped or k-suffixed amount.
  const cleaned = trimmed.replace(/[,]/g, '');
  const range = cleaned.match(/(\d{3,6})\s*[–-]\s*(\d{3,6})/);
  if (range) {
    const lo = Math.round(parseInt(range[1], 10) / 1000);
    const hi = Math.round(parseInt(range[2], 10) / 1000);
    return `$${lo}–${hi}k`;
  }
  const single = cleaned.match(/(\d{3,6})/);
  if (single) {
    const n = parseInt(single[1], 10);
    if (n >= 1000) return `$${Math.round(n / 1000)}k`;
    return `$${n}`;
  }
  return trimmed.length > 10 ? `${trimmed.slice(0, 9).trim()}…` : trimmed;
}

/**
 * Best-effort deadline parser. Universities often store deadlines as "Jan 15",
 * "January 15, 2026", or just a month. We try Date.parse first, then fall back
 * to mapping a month name to the upcoming occurrence.
 */
function parseDeadline(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '—') return null;

  const direct = Date.parse(trimmed);
  if (!Number.isNaN(direct)) return new Date(direct);

  const months = [
    'jan', 'feb', 'mar', 'apr', 'may', 'jun',
    'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
  ];
  const lower = trimmed.toLowerCase();
  const monthIdx = months.findIndex((m) => lower.startsWith(m));
  if (monthIdx === -1) return null;

  const dayMatch = lower.match(/\b(\d{1,2})\b/);
  const day = dayMatch ? parseInt(dayMatch[1], 10) : 15;

  const now = new Date();
  let year = now.getFullYear();
  let candidate = new Date(year, monthIdx, day);
  if (candidate.getTime() < now.getTime()) {
    year += 1;
    candidate = new Date(year, monthIdx, day);
  }
  return candidate;
}

function UniversityCard({
  university,
  index,
  isCompared,
  onToggleCompare,
  canAddCompare,
}: {
  university: ExplorerUniversity;
  index: number;
  isCompared: boolean;
  onToggleCompare: () => void;
  canAddCompare: boolean;
}) {
  const { isShortlisted, addToShortlist, removeFromShortlist, showToast, setView, isLoggedIn } = useExplorer();
  const router = useRouter();
  const saved = isShortlisted(university.id);

  const flag = COUNTRY_FLAGS[university.country] ?? '🎓';

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLoggedIn) {
      router.push('/onboarding');
      return;
    }

    if (saved) {
      await removeFromShortlist(university.id);
      showToast(`Removed from your shortlist`);
    } else {
      await addToShortlist(university.id);
      showToast(`${university.name} saved to My Universities`);
    }
  };

  const handleCompare = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isCompared && !canAddCompare) {
      showToast('You can compare up to 4 universities');
      return;
    }
    onToggleCompare();
  };

  const handleViewDetails = (e: React.MouseEvent) => {
    e.stopPropagation();
    setView('detail', university.id);
  };

  const acceptanceNum = parseAcceptanceRate(university.accept_rate);
  const acceptColor = acceptanceNum != null
    ? acceptanceNum < 10 ? 'text-emerald-600' : acceptanceNum < 30 ? 'text-amber-600' : 'text-red-500'
    : 'text-slate-400';

  // The accept_rate / tuition_usd fields in the database are messy free-text
  // ("14–18% overall; Engineering/Medicine competitive", "42,000-65,000 USD"
  // and so on). For the small stat row we extract the *first numeric value*
  // and present that compactly; the original string is kept as a tooltip so
  // users who want the nuance can hover. This is what gives every card a
  // consistent height.
  const acceptDisplay = formatAcceptanceForCard(university.accept_rate);
  const tuitionDisplay = formatTuitionForCard(university.tuition_usd);

  // Track per-URL failure flags. Using `useMemo` + a ref-keyed map keeps
  // us out of "setState inside useEffect" territory; the failure state is
  // tied to the specific URL string so a fresh hydration reset happens
  // automatically.
  const [failedUrls, setFailedUrls] = useState<Set<string>>(() => new Set());
  const markFailed = (url: string) => {
    if (!url) return;
    setFailedUrls((prev) => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      return next;
    });
  };

  const showCoverImage = !!university.image_url && !failedUrls.has(university.image_url);
  const showLogoImage = !!university.logo_url && !failedUrls.has(university.logo_url);

  const initials = university.name
    .replace(/^(University of |The )/, '')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.5), ease: 'easeOut' }}
      onClick={() => setView('detail', university.id)}
      className={`group relative cursor-pointer overflow-hidden rounded-2xl border bg-white shadow-[0_4px_14px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(15,23,42,0.12)] flex flex-col h-full ${
        isCompared ? 'border-pink-300 ring-2 ring-pink-200' : 'border-slate-200'
      }`}
    >
      {/* Cover image — a photo of the city the university is in (e.g.
          Cambridge, MA for Harvard). Falls back to the country brand
          colour if image resolution fails. */}
      <div
        className="relative h-32 w-full overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${university.color}, #1a1a2e)` }}
      >
        {showCoverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={university.image_url}
            alt={`${university.location}`}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => markFailed(university.image_url)}
          />
        ) : null}
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(180deg, rgba(0,0,0,0.05) 0%, transparent 35%, ${university.color}cc 100%)` }}
        />

        {/* QS rank pill — top left */}
        {university.qs_rank && (
          <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[0.7rem] font-bold text-slate-800 shadow-sm backdrop-blur-sm">
            {university.qs_rank <= 10 ? `#${university.qs_rank} in the world` : `QS #${university.qs_rank}`}
          </span>
        )}

        {/* Heart save button — top right */}
        <button
          type="button"
          onClick={handleSave}
          aria-label={saved ? 'Remove from saved' : 'Save university'}
          title={saved ? 'Saved to My Universities — click to remove' : 'Save and track application progress'}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-slate-500 shadow-sm transition hover:scale-110 hover:text-pink-500 backdrop-blur-sm"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill={saved ? '#ec4899' : 'none'} stroke={saved ? '#ec4899' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="px-4 pb-4 pt-2 flex-1 flex flex-col">
        {/* Logo circle, half-overlapping the image. Uses the resolved
            Wikidata logo when available, otherwise falls back to the
            university's brand colour with rendered initials. */}
        <div className="-mt-8 mb-2">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full border-4 border-white shadow-md overflow-hidden"
            style={{ background: showLogoImage ? '#fff' : university.color, zIndex: 1,}}
          >
            {showLogoImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={university.logo_url}
                alt={`${university.name} logo`}
                loading="lazy"
                className="h-full w-full object-contain p-1"
                onError={() => markFailed(university.logo_url)}
              />
            ) : (
              <span className="text-white text-xs font-bold">{initials}</span>
            )}
          </div>
        </div>

        {/* Name */}
        <h3 className="text-sm font-semibold text-slate-900 leading-tight line-clamp-2">{university.name}</h3>

        {/* Flag + location */}
        <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
          <span>{flag}</span>
          <span className="truncate">{university.location}</span>
        </p>

        {/* 3-column stats — show compact numeric values. The full DB
            string lives in the `title` attribute so power users can
            still see the nuance on hover. */}
        <div className="mt-3 grid grid-cols-3 gap-1 border-t border-slate-100 pt-3">
          <div>
            <p className="text-[0.6rem] font-medium uppercase tracking-wider text-slate-400">QS Rank</p>
            <p className="text-xs font-bold text-slate-900 mt-0.5">{university.qs_rank ? `#${university.qs_rank}` : '—'}</p>
          </div>
          <div title={university.accept_rate ?? undefined}>
            <p className="text-[0.6rem] font-medium uppercase tracking-wider text-slate-400">Accept</p>
            <p className={`text-xs font-bold mt-0.5 ${acceptColor}`}>{acceptDisplay}</p>
          </div>
          <div title={university.tuition_usd ?? undefined}>
            <p className="text-[0.6rem] font-medium uppercase tracking-wider text-slate-400">Tuition</p>
            <p className="text-xs font-bold text-slate-900 mt-0.5">{tuitionDisplay}</p>
          </div>
        </div>

        {/* Match badge if logged in */}
        {university.match_score != null && (
          <div className="mt-2">
            <MatchBadge percentage={university.match_score} breakdown={university.match_breakdown} />
          </div>
        )}

        {/* CTA row — pinned to the bottom of the card so all cards line up. */}
        <div className="mt-auto pt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={handleViewDetails}
            className="flex-1 rounded-full bg-slate-900 text-white text-xs font-semibold py-2 hover:bg-slate-700 transition"
          >
            View Details
          </button>
          <button
            type="button"
            onClick={handleCompare}
            aria-pressed={isCompared}
            aria-label={isCompared ? 'Remove from compare' : 'Add to compare'}
            title={isCompared ? 'Remove from compare' : 'Add to compare'}
            className={`flex h-8 w-8 items-center justify-center rounded-full border text-[0.7rem] font-bold transition ${
              isCompared
                ? 'bg-pink-500 border-pink-500 text-white'
                : 'border-slate-200 text-slate-500 hover:border-pink-300 hover:text-pink-600'
            }`}
          >
            {isCompared ? '✓' : '⇄'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   FILTER LOGIC
───────────────────────────────────────────────────────────────────────── */

function applyFilters(
  universities: ExplorerUniversity[],
  filters: FilterState,
  search: SearchState,
  sort: SortKey,
): ExplorerUniversity[] {
  let result = [...universities];

  // Search by name
  if (search.name) {
    const q = search.name.toLowerCase();
    result = result.filter((u) => u.name.toLowerCase().includes(q));
  }

  // Search by location
  if (search.location) {
    const q = search.location.toLowerCase();
    result = result.filter((u) => u.country.toLowerCase().includes(q) || u.location.toLowerCase().includes(q));
  }

  // Search by program (matches strengths/best_for/tags)
  if (search.program) {
    const q = search.program.toLowerCase();
    result = result.filter((u) =>
      u.tags.some((t) => t.toLowerCase().includes(q)) ||
      (u.strengths ?? '').toLowerCase().includes(q) ||
      (u.best_for ?? '').toLowerCase().includes(q),
    );
  }

  // Quick filter
  switch (filters.quickFilter) {
    case 'russell':
      result = result.filter((u) => (u.notes ?? '').toLowerCase().includes('russell'));
      break;
    case 'stem':
      result = result.filter((u) => u.tags.includes('STEM'));
      break;
    case 'arts':
      result = result.filter((u) => u.tags.includes('Arts'));
      break;
    case 'top50':
      result = result.filter((u) => u.qs_rank != null && u.qs_rank <= 50);
      break;
  }

  // Countries
  if (filters.countries.length > 0) {
    result = result.filter((u) => filters.countries.includes(u.country));
  }

  // QS ranking
  switch (filters.qsRanking) {
    case 'top50':
      result = result.filter((u) => u.qs_rank != null && u.qs_rank <= 50);
      break;
    case 'top100':
      result = result.filter((u) => u.qs_rank != null && u.qs_rank <= 100);
      break;
    case 'top200':
      result = result.filter((u) => u.qs_rank != null && u.qs_rank <= 200);
      break;
  }

  // Tuition
  if (filters.tuition !== 'all') {
    result = result.filter((u) => {
      const t = parseTuition(u.tuition_usd);
      if (t == null) return false;
      switch (filters.tuition) {
        case 'under_20k': return t < 20000;
        case '20k_40k': return t >= 20000 && t < 40000;
        case '40k_60k': return t >= 40000 && t < 60000;
        case 'over_60k': return t >= 60000;
        default: return true;
      }
    });
  }

  // Acceptance
  if (filters.acceptance !== 'all') {
    result = result.filter((u) => {
      const a = parseAcceptanceRate(u.accept_rate);
      if (a == null) return false;
      switch (filters.acceptance) {
        case 'under_10': return a < 10;
        case '10_30': return a >= 10 && a <= 30;
        case 'over_30': return a > 30;
        default: return true;
      }
    });
  }

  // Type
  if (filters.type !== 'all') {
    result = result.filter((u) => (u.type ?? '').toLowerCase().includes(filters.type));
  }

  // Scholarship
  if (filters.scholarship === 'available') {
    result = result.filter((u) => {
      const s = (u.scholarship ?? '').toLowerCase().trim();
      if (!s) return false;
      // Treat clearly negative phrases as not-available
      if (s === '—' || s === 'none' || s === 'not available' || s === 'n/a') return false;
      return true;
    });
  }

  // Deadline (interprets the application_deadline string heuristically)
  if (filters.deadline !== 'all') {
    const now = new Date();
    const monthMs = 1000 * 60 * 60 * 24 * 30;
    result = result.filter((u) => {
      const d = parseDeadline(u.application_deadline ?? null);
      if (!d) return false;
      if (filters.deadline === 'open') return d.getTime() >= now.getTime();
      // 'soon' = within next 60 days
      const diff = d.getTime() - now.getTime();
      return diff >= 0 && diff <= 60 * 24 * 60 * 60 * 1000 + monthMs * 0;
    });
  }

  // Sort
  switch (sort) {
    case 'rank_asc':
      result.sort((a, b) => (a.qs_rank ?? 9999) - (b.qs_rank ?? 9999));
      break;
    case 'tuition_asc':
      result.sort((a, b) => (parseTuition(a.tuition_usd) ?? 999999) - (parseTuition(b.tuition_usd) ?? 999999));
      break;
    case 'acceptance_asc':
      result.sort((a, b) => (parseAcceptanceRate(a.accept_rate) ?? 999) - (parseAcceptanceRate(b.accept_rate) ?? 999));
      break;
    default:
      result.sort((a, b) => {
        if (a.match_score != null && b.match_score != null) return b.match_score - a.match_score;
        return (a.qs_rank ?? 9999) - (b.qs_rank ?? 9999);
      });
  }

  return result;
}

/* ─────────────────────────────────────────────────────────────────────────
   COMPACT STICKY SEARCH BAR (appears when scrolled past hero)
───────────────────────────────────────────────────────────────────────── */

function CompactSearchBar({
  search,
  onSearchChange,
  activeCount,
}: {
  search: SearchState;
  onSearchChange: (s: SearchState) => void;
  activeCount: number;
}) {
  const { scrollY } = useScroll();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    return scrollY.on('change', (y: number) => setVisible(y > 360));
  }, [scrollY]);

  return (
    <motion.div
      aria-hidden={!visible}
      initial={false}
      animate={{ y: visible ? 0 : -90, opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      style={{ position: 'fixed', top: 60, left: 0, right: 0, zIndex: 30, pointerEvents: visible ? 'auto' : 'none' }}
    >
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="flex items-center gap-2 rounded-full border border-black/5 bg-white/95 px-3 py-2 shadow-[0_8px_24px_rgba(22,33,62,0.1)] backdrop-blur">
          <span aria-hidden className="hidden md:flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400/20 to-pink-400/20 text-base">
            🌐
          </span>
          <div className="relative flex-1 min-w-0">
            <SearchIcon />
            <input
              type="text"
              placeholder="Search universities…"
              value={search.name}
              onChange={(e) => onSearchChange({ ...search, name: e.target.value })}
              className="w-full rounded-full bg-transparent pl-10 pr-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
            />
          </div>
          <div className="hidden md:block h-6 w-px bg-slate-200" />
          <div className="hidden md:block flex-1 min-w-0">
            <select
              value={search.program}
              onChange={(e) => onSearchChange({ ...search, program: e.target.value })}
              className="w-full bg-transparent text-sm text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="">Any program</option>
              {PROGRAM_OPTIONS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          {activeCount > 0 && (
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-pink-50 border border-pink-200 px-2 py-0.5 text-[0.7rem] font-semibold text-pink-700">
              {activeCount} {activeCount === 1 ? 'filter' : 'filters'}
            </span>
          )}
          <button
            type="button"
            className="inline-flex items-center justify-center gap-1 rounded-full bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] px-4 py-2 text-xs font-semibold text-white shadow-[0_6px_18px_rgba(255,77,140,0.3)]"
          >
            <SearchIconWhite />
            <span className="hidden sm:inline">Search</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   ACTIVE FILTER CHIPS
───────────────────────────────────────────────────────────────────────── */

interface ActiveFilterChip {
  key: string;
  label: string;
  remove: (
    setFilters: React.Dispatch<React.SetStateAction<FilterState>>,
    setSearch: React.Dispatch<React.SetStateAction<SearchState>>,
  ) => void;
}

function buildActiveFilterChips(filters: FilterState, search: SearchState): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];

  if (search.name) {
    chips.push({
      key: 'search-name',
      label: `Search: ${search.name}`,
      remove: (_, setSearch) => setSearch((s) => ({ ...s, name: '' })),
    });
  }
  if (search.location) {
    chips.push({
      key: 'search-location',
      label: `Location: ${search.location}`,
      remove: (_, setSearch) => setSearch((s) => ({ ...s, location: '' })),
    });
  }
  if (search.program) {
    chips.push({
      key: 'search-program',
      label: `Program: ${search.program}`,
      remove: (_, setSearch) => setSearch((s) => ({ ...s, program: '' })),
    });
  }
  if (filters.quickFilter !== 'all') {
    const labels: Record<Exclude<FilterState['quickFilter'], 'all'>, string> = {
      russell: 'Russell Group',
      stem: 'STEM',
      arts: 'Arts & Humanities',
      top50: 'Global Top 50',
    };
    chips.push({
      key: 'quick',
      label: labels[filters.quickFilter],
      remove: (setFilters) => setFilters((f) => ({ ...f, quickFilter: 'all' })),
    });
  }
  for (const c of filters.countries) {
    chips.push({
      key: `country-${c}`,
      label: c,
      remove: (setFilters) =>
        setFilters((f) => ({ ...f, countries: f.countries.filter((x) => x !== c) })),
    });
  }
  if (filters.qsRanking !== 'all') {
    const labels = { all: '', top50: 'Top 50', top100: 'Top 100', top200: 'Top 200' } as const;
    chips.push({
      key: 'qs',
      label: `QS ${labels[filters.qsRanking]}`,
      remove: (setFilters) => setFilters((f) => ({ ...f, qsRanking: 'all' })),
    });
  }
  if (filters.tuition !== 'all') {
    const labels = {
      all: '',
      under_20k: 'Under $20k',
      '20k_40k': '$20k–$40k',
      '40k_60k': '$40k–$60k',
      over_60k: 'Over $60k',
    } as const;
    chips.push({
      key: 'tuition',
      label: `Tuition: ${labels[filters.tuition]}`,
      remove: (setFilters) => setFilters((f) => ({ ...f, tuition: 'all' })),
    });
  }
  if (filters.acceptance !== 'all') {
    const labels = { all: '', under_10: '< 10%', '10_30': '10–30%', over_30: '> 30%' } as const;
    chips.push({
      key: 'acceptance',
      label: `Acceptance: ${labels[filters.acceptance]}`,
      remove: (setFilters) => setFilters((f) => ({ ...f, acceptance: 'all' })),
    });
  }
  if (filters.type !== 'all') {
    chips.push({
      key: 'type',
      label: filters.type === 'public' ? 'Public' : 'Private',
      remove: (setFilters) => setFilters((f) => ({ ...f, type: 'all' })),
    });
  }
  if (filters.scholarship !== 'all') {
    chips.push({
      key: 'scholarship',
      label: 'Scholarship available',
      remove: (setFilters) => setFilters((f) => ({ ...f, scholarship: 'all' })),
    });
  }
  if (filters.deadline !== 'all') {
    chips.push({
      key: 'deadline',
      label: filters.deadline === 'open' ? 'Deadline open' : 'Closing soon',
      remove: (setFilters) => setFilters((f) => ({ ...f, deadline: 'all' })),
    });
  }
  return chips;
}

/* ─────────────────────────────────────────────────────────────────────────
   COMPARE BAR (floating, appears when 1+ universities are selected)
───────────────────────────────────────────────────────────────────────── */

function CompareBar({
  universities,
  onRemove,
  onClear,
  onOpen,
}: {
  universities: ExplorerUniversity[];
  onRemove: (id: number) => void;
  onClear: () => void;
  onOpen: () => void;
}) {
  if (universities.length === 0) return null;
  const canCompare = universities.length >= 2;

  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[min(96vw,52rem)]"
    >
      <div className="rounded-2xl border border-slate-200 bg-white/95 backdrop-blur shadow-[0_18px_40px_rgba(15,23,42,0.18)] p-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-slate-500">
            Compare ({universities.length}/4)
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {universities.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => onRemove(u.id)}
                className="inline-flex items-center gap-1 rounded-full bg-pink-50 border border-pink-200 px-2 py-0.5 text-[0.7rem] font-medium text-pink-700 hover:bg-pink-100"
                title={`Remove ${u.name}`}
              >
                <span className="truncate max-w-[160px]">{u.name}</span>
                <span className="text-pink-400">×</span>
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-slate-500 hover:text-slate-900 transition"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={onOpen}
          disabled={!canCompare}
          className="rounded-full bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] px-4 py-2 text-xs font-semibold text-white shadow-[0_6px_18px_rgba(255,77,140,0.3)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Compare {canCompare ? `(${universities.length})` : '— pick 2+'}
        </button>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   COMPARE MODAL — side-by-side comparison table
───────────────────────────────────────────────────────────────────────── */

function CompareModal({
  universities,
  onClose,
}: {
  universities: ExplorerUniversity[];
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const rows: { label: string; render: (u: ExplorerUniversity) => React.ReactNode }[] = [
    {
      label: 'Country',
      render: (u) => `${COUNTRY_FLAGS[u.country] ?? '🎓'} ${u.country}`,
    },
    {
      label: 'QS Rank',
      render: (u) => (u.qs_rank ? `#${u.qs_rank}` : '—'),
    },
    {
      label: 'Acceptance',
      render: (u) => u.accept_rate ?? '—',
    },
    {
      label: 'Tuition (USD)',
      render: (u) => u.tuition_usd ?? '—',
    },
    {
      label: 'Living cost (USD)',
      render: (u) => u.living_cost_usd ?? '—',
    },
    {
      label: 'Match score',
      render: (u) => (u.match_score != null ? `${u.match_score}%` : '—'),
    },
    {
      label: 'Application deadline',
      render: (u) => u.application_deadline ?? '—',
    },
    {
      label: 'Scholarship',
      render: (u) => u.scholarship ?? '—',
    },
    {
      label: 'Best for',
      render: (u) => u.best_for ?? '—',
    },
    {
      label: 'Strengths',
      render: (u) => u.strengths ?? '—',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 12 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-6xl max-h-[88vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="Compare universities"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Comparing {universities.length} universities
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Side-by-side stats to help you decide. Press Esc to close.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close comparison"
            className="h-8 w-8 rounded-full text-slate-500 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 w-44">Attribute</th>
                {universities.map((u) => (
                  <th key={u.id} className="text-left px-4 py-3 font-semibold text-slate-900 align-top min-w-[180px]">
                    <div className="flex flex-col gap-1">
                      <span className="line-clamp-2">{u.name}</span>
                      <span className="text-xs font-normal text-slate-500">{u.location}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.label} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                  <td className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 align-top">
                    {row.label}
                  </td>
                  {universities.map((u) => (
                    <td key={u.id} className="px-4 py-3 text-slate-700 align-top">
                      <span className="line-clamp-3">{row.render(u)}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   FIRST-TIME ONBOARDING REDIRECT
   ────────────────────────────────────────────────────────────────────────
   The first time a user lands on the search page, we send them to the
   onboarding flow with `?from=search` so the onboarding shows a context
   banner explaining how it improves results — and a clear "skip to
   search" exit. The flag is stored in localStorage so we only do this
   once per browser. Logged-in users who've already completed onboarding
   are never redirected.
───────────────────────────────────────────────────────────────────────── */

const SEARCH_VISIT_FLAG = 'glowbal-search-visited';

function FirstTimeOnboardingRedirect() {
  const router = useRouter();
  const { hasProfile } = useExplorer();

  useEffect(() => {
    if (hasProfile) return;
    if (typeof window === 'undefined') return;

    try {
      const visited = window.localStorage.getItem(SEARCH_VISIT_FLAG);
      if (visited) return;

      // Honour an explicit "skip" flag set by the onboarding's skip button —
      // we never want to bounce the user back if they just opted out.
      if (window.sessionStorage.getItem('glowbal-onboarding-skipped') === '1') {
        window.localStorage.setItem(SEARCH_VISIT_FLAG, '1');
        return;
      }

      window.localStorage.setItem(SEARCH_VISIT_FLAG, '1');
      router.replace('/onboarding?from=search');
    } catch {
      // localStorage might be disabled — quietly ignore.
    }
  }, [hasProfile, router]);

  return null;
}

/* ─────────────────────────────────────────────────────────────────────────
   BROWSE VIEW (main layout)
───────────────────────────────────────────────────────────────────────── */

function BrowseView() {
  const { universities } = useExplorer();
  const [search, setSearch] = useState<SearchState>({ name: '', location: '', program: '' });
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortKey>('best_match');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [showCompare, setShowCompare] = useState(false);

  const filtered = useMemo(
    () => applyFilters(universities, filters, search, sort),
    [universities, filters, search, sort],
  );

  const toggleCompare = (id: number) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return prev; // max 4
      return [...prev, id];
    });
  };

  const clearCompare = () => setCompareIds([]);

  const compareUniversities = useMemo(
    () => compareIds
      .map((id) => universities.find((u) => u.id === id))
      .filter((u): u is ExplorerUniversity => u != null),
    [compareIds, universities],
  );

  const activeFilterChips = useMemo(() => buildActiveFilterChips(filters, search), [filters, search]);

  return (
    <>
      <FirstTimeOnboardingRedirect />
      <CompactSearchBar
        search={search}
        onSearchChange={setSearch}
        activeCount={countActiveFilters(filters)}
      />
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        {/* Hero */}
        <SearchHero search={search} onSearchChange={setSearch} />

        {/* Body: sidebar + grid */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
          {/* Sidebar */}
          <FilterSidebar
            filters={filters}
            onChange={setFilters}
            totalCount={filtered.length}
            onReset={() => setFilters(DEFAULT_FILTERS)}
          />

          {/* Main column */}
          <div className="space-y-5">
            <ResultsBar
              totalCount={filtered.length}
              quickFilter={filters.quickFilter}
              onQuickFilterChange={(q) => setFilters({ ...filters, quickFilter: q })}
              sort={sort}
              onSortChange={setSort}
              view={view}
              onViewChange={setView}
            />

            {/* Active filter chips */}
            {activeFilterChips.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {activeFilterChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => chip.remove(setFilters, setSearch)}
                    className="inline-flex items-center gap-1 rounded-full bg-pink-50 border border-pink-200 px-2.5 py-1 text-xs font-medium text-pink-700 hover:bg-pink-100 transition"
                  >
                    {chip.label}
                    <span className="text-pink-400 hover:text-pink-700">×</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => { setFilters(DEFAULT_FILTERS); setSearch({ name: '', location: '', program: '' }); }}
                  className="text-xs text-slate-500 hover:text-pink-600 underline underline-offset-2"
                >
                  Clear all
                </button>
              </div>
            )}

            {filtered.length > 0 ? (
              <div className={
                view === 'grid'
                  ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'
                  : 'grid gap-4 grid-cols-1'
              }>
                {filtered.map((u, i) => (
                  <UniversityCard
                    key={u.id}
                    university={u}
                    index={i}
                    isCompared={compareIds.includes(u.id)}
                    onToggleCompare={() => toggleCompare(u.id)}
                    canAddCompare={compareIds.length < 4}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
                <p className="text-lg font-semibold text-slate-900">No universities match your filters</p>
                <p className="mt-2 text-sm text-slate-500">Try clearing some filters or widening your search.</p>
                <button
                  type="button"
                  onClick={() => { setFilters(DEFAULT_FILTERS); setSearch({ name: '', location: '', program: '' }); }}
                  className="mt-4 rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:border-pink-200"
                >
                  Reset filters
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating compare bar */}
      <CompareBar
        universities={compareUniversities}
        onRemove={(id) => toggleCompare(id)}
        onClear={clearCompare}
        onOpen={() => setShowCompare(true)}
      />

      {/* Compare modal */}
      <AnimatePresence>
        {showCompare && compareUniversities.length >= 2 && (
          <CompareModal
            universities={compareUniversities}
            onClose={() => setShowCompare(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   STICKY BAR + DETAIL VIEW (preserved from original)
───────────────────────────────────────────────────────────────────────── */

interface StickyBarProps {
  university: ExplorerUniversity;
  saved: boolean;
  onSave: () => void;
  onBack: () => void;
  ctaLabel?: string;
}

function UniversityStickyBar({ university, saved, onSave, onBack, ctaLabel }: StickyBarProps) {
  const { scrollY } = useScroll();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    return scrollY.on('change', (y: number) => setIsVisible(y > 260));
  }, [scrollY]);

  return (
    <motion.div
      aria-hidden={!isVisible}
      initial={false}
      animate={{ y: isVisible ? 0 : -80, opacity: isVisible ? 1 : 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 40, pointerEvents: isVisible ? 'auto' : 'none' }}
    >
      <div style={{ margin: '10px auto', maxWidth: '72rem', padding: '0 1.5rem' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          borderRadius: '999px', border: '1px solid rgba(0,0,0,0.06)',
          background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(20px)',
          boxShadow: '0 8px 24px rgba(22,33,62,0.1)', padding: '0.5rem 0.75rem 0.5rem 0.5rem',
        }}>
          <button type="button" onClick={onBack} style={{
            flexShrink: 0, borderRadius: '999px', border: '1px solid rgba(0,0,0,0.07)',
            background: 'rgba(255,255,255,0.9)', padding: '0.35rem 0.75rem',
            fontSize: '0.8rem', fontWeight: 600, color: 'rgb(100 116 139)', cursor: 'pointer', whiteSpace: 'nowrap',
          }}>← Browse</button>

          <div style={{
            width: 36, height: 36, borderRadius: '50%', background: university.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0,
          }}>{university.emoji}</div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'rgb(15 23 42)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {university.name}
            </p>
            <p style={{ margin: 0, fontSize: '0.72rem', color: 'rgb(100 116 139)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {university.location}{university.rank ? ` · ${university.rank}` : ''}
            </p>
          </div>

          {university.match_score != null && (
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#ff4d8c' }}>{university.match_score}%</p>
              <p style={{ margin: 0, fontSize: '0.65rem', color: 'rgb(148 163 184)' }}>Match</p>
            </div>
          )}

          <button type="button" onClick={onSave} style={{
            flexShrink: 0, borderRadius: '999px',
            border: saved ? '1px solid rgb(167 243 208)' : 'none',
            background: saved ? 'rgb(240 253 244)' : 'linear-gradient(135deg, #ff4d8c, #ff85b3)',
            padding: '0.45rem 1rem', fontSize: '0.8rem', fontWeight: 700,
            color: saved ? 'rgb(5 150 105)' : 'white',
            cursor: 'pointer',
            boxShadow: saved ? 'none' : '0 4px 14px rgba(255,77,140,0.3)', whiteSpace: 'nowrap',
          }}>
            {ctaLabel ?? (saved ? 'Saved ✓ — View' : '+ Save')}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function SaveSidebar({ university }: { university: ExplorerUniversity }) {
  const { addToShortlist, isShortlisted, showToast, isLoggedIn } = useExplorer();
  const router = useRouter();
  const saved = isShortlisted(university.id);

  const handleSave = async () => {
    if (!isLoggedIn) {
      router.push('/onboarding');
      return;
    }

    if (!saved) {
      await addToShortlist(university.id);
      showToast(`${university.name} saved — redirecting…`);
      setTimeout(() => router.push('/my-universities'), 800);
    } else {
      router.push('/my-universities');
    }
  };

  const stats = [
    { label: 'Acceptance Rate', value: university.accept_rate ?? '—' },
    { label: 'Rank', value: university.rank || '—' },
    { label: 'Tuition (USD)', value: university.tuition_usd ?? '—' },
    { label: 'Living Cost (USD)', value: university.living_cost_usd ?? '—' },
  ];

  return (
    <div className="sticky top-20 space-y-4 glow-card">
      <h3 className="text-lg font-semibold text-slate-900">{university.name}</h3>
      <MatchBadge percentage={university.match_score} breakdown={university.match_breakdown} size="md" />
      <div className="space-y-2">
        {stats.map((stat) => (
          <div key={stat.label} className="profile-info-row">
            <span className="profile-info-label">{stat.label}</span>
            <span className="profile-info-value text-sm">{stat.value}</span>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={handleSave}
        className={`w-full rounded-full py-3 text-sm font-semibold transition-all ${
          !isLoggedIn
            ? 'border border-pink-200 bg-pink-50 text-pink-600 hover:bg-pink-100'
            : saved
            ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100'
            : 'glow-button-primary'
        }`}
      >
        {!isLoggedIn ? 'Take onboarding quiz for your match →' : saved ? 'Saved — View in My Universities →' : 'Save to My Universities'}
      </button>
    </div>
  );
}

function DetailView() {
  const { selectedUniversityId, setView, universities, addToShortlist, isShortlisted, showToast, isLoggedIn } = useExplorer();
  const router = useRouter();
  const university = universities.find((u) => u.id === selectedUniversityId);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [selectedUniversityId]);

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

    if (!saved) {
      await addToShortlist(university.id);
      showToast(`${university.name} saved — redirecting…`);
      setTimeout(() => router.push('/my-universities'), 800);
    } else {
      router.push('/my-universities');
    }
  };

  return (
    <>
      <UniversityStickyBar
        university={university}
        saved={saved}
        onSave={handleSave}
        onBack={() => setView('browse')}
        ctaLabel={!isLoggedIn ? 'Take quiz for matches' : undefined}
      />

      <div className="mx-auto max-w-6xl px-4 py-8">
        <button type="button" onClick={() => setView('browse')} className="glow-button-secondary mb-6 text-sm px-4 py-2">
          ← Back to Browse
        </button>

        <div className="flex flex-col gap-8 md:flex-row">
          <div className="flex-1 min-w-0 space-y-6">
            <div className="relative h-48 overflow-hidden rounded-2xl md:h-56" style={{ backgroundColor: university.color }}>
              {university.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={university.image_url}
                  alt={university.name}
                  className="absolute inset-0 h-full w-full object-cover"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              )}
              <div className="absolute inset-0 flex items-center justify-center" style={{ background: `${university.color}80` }}>
                <span className="text-8xl drop-shadow" role="img" aria-label={university.name}>{university.emoji}</span>
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <MatchBadge percentage={university.match_score} breakdown={university.match_breakdown} size="md" />
                {university.rank && (
                  <span className="rounded-full bg-sky-50 border border-sky-200 px-3 py-0.5 text-xs font-semibold text-sky-600">
                    {university.rank}
                  </span>
                )}
              </div>
              <h2 className="mt-3 text-2xl font-semibold text-slate-900 md:text-3xl">{university.name}</h2>
              <p className="mt-1 text-sm text-slate-400">{university.location}</p>
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
                    href={`/achievers?university=${university.id}`}
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

          <aside className="w-full shrink-0 md:w-72 lg:w-80">
            <SaveSidebar university={university} />
          </aside>
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   TOAST
───────────────────────────────────────────────────────────────────────── */

function ToastNotification() {
  const { toast } = useExplorer();
  if (!toast?.visible) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-50 max-w-sm rounded-2xl border border-black/[.05] bg-white/95 px-5 py-4 shadow-[0_12px_32px_rgba(22,33,62,0.12)] backdrop-blur animate-[slideUp_0.3s_ease-out]"
      role="status"
      aria-live="polite"
    >
      <p className="text-sm font-semibold text-slate-800">{toast.message}</p>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   ICONS
───────────────────────────────────────────────────────────────────────── */

function SearchIcon() {
  return (
    <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function SearchIconWhite() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 7-8 13-8 13s-8-6-8-13a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function PinIconSmall() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500">
      <path d="M20 10c0 7-8 13-8 13s-8-6-8-13a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}

function DollarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500">
      <line x1="12" y1="2" x2="12" y2="22" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function PercentIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500">
      <line x1="19" y1="5" x2="5" y2="19" />
      <circle cx="6.5" cy="6.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01" />
      <path d="M16 6h.01" />
      <path d="M12 6h.01" />
      <path d="M12 10h.01" />
      <path d="M12 14h.01" />
      <path d="M16 10h.01" />
      <path d="M16 14h.01" />
      <path d="M8 10h.01" />
      <path d="M8 14h.01" />
    </svg>
  );
}

function CampusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500">
      <path d="M2 22h20" />
      <path d="M3 22V8l9-6 9 6v14" />
      <path d="M9 22v-4h6v4" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   ROOT
───────────────────────────────────────────────────────────────────────── */

function ExplorerContent() {
  const { activeView } = useExplorer();

  return (
    <div className="relative min-h-screen pb-20 sm:pb-0">
      <main>
        <AnimatePresence mode="wait">
          {(activeView === 'browse' || activeView === 'shortlist' || activeView === 'applications') && (
            <motion.div key="browse" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              <BrowseView />
            </motion.div>
          )}
          {activeView === 'detail' && (
            <motion.div key="detail" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              <DetailView />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <ToastNotification />
    </div>
  );
}

interface ExplorerClientProps {
  universities: ExplorerUniversity[];
  initialShortlist: number[];
  initialApplications: ApplicationEntry[];
  isLoggedIn: boolean;
  hasProfile: boolean;
  wikiPairs?: Array<[string, string]>;
}

export function UniversityExplorerClient({
  universities,
  initialShortlist,
  initialApplications,
  isLoggedIn,
  hasProfile,
  wikiPairs = [],
}: ExplorerClientProps) {
  const [universitiesWithImages, setUniversitiesWithImages] = useState<ExplorerUniversity[]>(universities);

  /**
   * Lazy imagery hydration. The server ships the page with no images so
   * the response is instant, then we kick off a single batch request to
   * /api/university-images and merge resolved campus + logo URLs into
   * each university. The map cards re-render in place.
   *
   * If the request fails, the cards keep their gradient placeholder —
   * no broken images, no jank.
   */
  useEffect(() => {
    if (wikiPairs.length === 0) return;

    let cancelled = false;
    const ac = new AbortController();

    fetch('/api/university-images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(wikiPairs),
      signal: ac.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((imagery: Record<string, { campus: string | null; logo: string | null }> | null) => {
        if (cancelled || !imagery) return;
        setUniversitiesWithImages((prev) =>
          prev.map((uni) => {
            // Re-derive the wiki title using the same algorithm as
            // explorer-utils' buildUniversityImageUrl: strip trailing
            // parenthetical acronyms ("(NUS)", "(Caltech)", etc.) before
            // converting spaces to underscores.
            const cleanName = uni.name.replace(/\s*\([^)]*\)\s*$/, '').trim();
            const title = cleanName.replace(/\s+/g, '_');
            const resolved = imagery[title];
            if (!resolved) return uni;
            return {
              ...uni,
              image_url: resolved.campus ?? uni.image_url,
              logo_url: resolved.logo ?? uni.logo_url,
            };
          }),
        );
      })
      .catch(() => {
        // Swallow — placeholder gradients remain in place.
      });

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [wikiPairs]);

  return (
    <UniversityExplorerProvider
      initialUniversities={universitiesWithImages}
      initialShortlist={initialShortlist}
      initialApplications={initialApplications}
      isLoggedIn={isLoggedIn}
      hasProfile={hasProfile}
    >
      <ExplorerContent />
    </UniversityExplorerProvider>
  );
}
