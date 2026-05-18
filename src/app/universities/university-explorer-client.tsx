'use client';

import dynamic from 'next/dynamic';
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
   QUIZ STICKY BAR — unchanged from original
───────────────────────────────────────────────────────────────────────── */

function QuizStickyBar() {
  const router = useRouter();
  const { scrollY } = useScroll();
  const { isLoggedIn, hasProfile } = useExplorer();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isLoggedIn && hasProfile) return;
    return scrollY.on('change', (y: number) => setVisible(y > 240));
  }, [hasProfile, isLoggedIn, scrollY]);

  if (isLoggedIn && hasProfile) return null;

  return (
    <motion.div
      aria-hidden={!visible}
      initial={false}
      animate={{ y: visible ? 0 : -80, opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 40, pointerEvents: visible ? 'auto' : 'none' }}
    >
      <div style={{ margin: '10px auto', maxWidth: '72rem', padding: '0 1.5rem' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          borderRadius: '999px', border: '1px solid rgba(0,0,0,0.06)',
          background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(20px)',
          boxShadow: '0 8px 24px rgba(22,33,62,0.1)', padding: '0.5rem 0.75rem 0.5rem 0.5rem',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #ff4d8c, #00b4d8)', color: 'white', fontSize: '1rem',
          }}>✦</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'rgb(15 23 42)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {isLoggedIn ? 'Complete the Glowbal quiz for personalised matches' : 'Take the Glowbal quiz to unlock personalised matches'}
            </p>
            <p style={{ margin: 0, fontSize: '0.72rem', color: 'rgb(100 116 139)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Browse freely now — save and rank universities around your goals when you&apos;re ready.
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push('/onboarding')}
            style={{
              flexShrink: 0, borderRadius: '999px', border: 'none',
              background: 'linear-gradient(135deg, #ff4d8c, #ff85b3)',
              padding: '0.45rem 1rem', fontSize: '0.8rem', fontWeight: 700,
              color: 'white', cursor: 'pointer', boxShadow: '0 4px 14px rgba(255,77,140,0.3)', whiteSpace: 'nowrap',
            }}
          >
            {isLoggedIn ? 'Finish quiz' : 'Take quiz'}
          </button>
        </div>
      </div>
    </motion.div>
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
            className="rounded-full bg-gradient-to-br from-cyan-500/20 to-pink-400/20 p-1 shadow-[0_0_40px_rgba(34,211,238,0.15)]"
            style={{ width: 140, height: 140 }}
          >
            <div className="rounded-full overflow-hidden bg-slate-900" style={{ width: '100%', height: '100%' }}>
              <CompactGlobeDynamic theme="cosmos" size={132} rotateSpeed={0.4} />
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
};

const DEFAULT_FILTERS: FilterState = {
  quickFilter: 'all',
  countries: [],
  qsRanking: 'all',
  tuition: 'all',
  acceptance: 'all',
  type: 'all',
  campusSetting: 'all',
};

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
  });
  const [countrySearch, setCountrySearch] = useState('');

  const toggle = (key: keyof typeof open) => setOpen((p) => ({ ...p, [key]: !p[key] }));

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
    <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-sm font-semibold text-slate-900">Refine results</h3>
        <button
          type="button"
          onClick={onReset}
          className="text-xs text-pink-600 hover:underline"
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
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
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

function UniversityCard({ university, index }: { university: ExplorerUniversity; index: number }) {
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

  const acceptanceNum = parseAcceptanceRate(university.accept_rate);
  const acceptColor = acceptanceNum != null
    ? acceptanceNum < 10 ? 'text-emerald-600' : acceptanceNum < 30 ? 'text-amber-600' : 'text-red-500'
    : 'text-slate-400';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.5), ease: 'easeOut' }}
      onClick={() => setView('detail', university.id)}
      className="group relative cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_14px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(15,23,42,0.12)]"
    >
      {/* Cover image */}
      <div className="relative h-32 w-full overflow-hidden">
        {university.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={university.image_url}
            alt={university.name}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : null}
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(180deg, transparent 30%, ${university.color}aa 100%)` }}
        />

        {/* "#N in the world" pill — top left */}
        {university.qs_rank && (
          <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[0.7rem] font-bold text-slate-800 shadow-sm backdrop-blur-sm">
            #{university.qs_rank} in the world
          </span>
        )}

        {/* Heart save button — top right */}
        <button
          type="button"
          onClick={handleSave}
          aria-label={saved ? 'Remove from saved' : 'Save university'}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-slate-500 shadow-sm transition hover:scale-110 hover:text-pink-500 backdrop-blur-sm"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill={saved ? '#ec4899' : 'none'} stroke={saved ? '#ec4899' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="px-4 pb-4 pt-2">
        {/* Logo circle, half-overlapping the image */}
        <div className="-mt-8 mb-2">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full border-4 border-white bg-white shadow-md overflow-hidden"
            style={{ background: university.color }}
          >
            {university.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={university.image_url}
                alt=""
                className="h-full w-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const parent = e.currentTarget.parentElement;
                  if (parent) {
                    const initials = university.name
                      .replace(/^(University of |The )/, '')
                      .split(' ')
                      .map((w) => w[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase();
                    parent.textContent = initials;
                    parent.style.color = 'white';
                    parent.style.fontWeight = '700';
                    parent.style.fontSize = '0.7rem';
                  }
                }}
              />
            ) : (
              <span className="text-white text-xs font-bold">
                {university.name.replace(/^(University of |The )/, '').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
              </span>
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

        {/* 3-column stats */}
        <div className="mt-3 grid grid-cols-3 gap-1 border-t border-slate-100 pt-3">
          <div>
            <p className="text-[0.6rem] font-medium uppercase tracking-wider text-slate-400">QS Rank</p>
            <p className="text-xs font-bold text-slate-900 mt-0.5">{university.qs_rank ?? '—'}</p>
          </div>
          <div>
            <p className="text-[0.6rem] font-medium uppercase tracking-wider text-slate-400">Accept Rate</p>
            <p className={`text-xs font-bold mt-0.5 ${acceptColor}`}>{university.accept_rate ?? '—'}</p>
          </div>
          <div>
            <p className="text-[0.6rem] font-medium uppercase tracking-wider text-slate-400">Tuition</p>
            <p className="text-xs font-bold text-slate-900 mt-0.5 truncate">{university.tuition_usd ?? '—'}</p>
          </div>
        </div>

        {/* Match badge if logged in */}
        {university.match_score != null && (
          <div className="mt-2">
            <MatchBadge percentage={university.match_score} breakdown={university.match_breakdown} />
          </div>
        )}
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
   BROWSE VIEW (main layout)
───────────────────────────────────────────────────────────────────────── */

function BrowseView() {
  const { universities } = useExplorer();
  const [search, setSearch] = useState<SearchState>({ name: '', location: '', program: '' });
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortKey>('best_match');
  const [view, setView] = useState<'grid' | 'list'>('grid');

  const filtered = useMemo(
    () => applyFilters(universities, filters, search, sort),
    [universities, filters, search, sort],
  );

  return (
    <>
      <QuizStickyBar />
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

            {filtered.length > 0 ? (
              <div className={
                view === 'grid'
                  ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'
                  : 'grid gap-4 grid-cols-1'
              }>
                {filtered.map((u, i) => (
                  <UniversityCard key={u.id} university={u} index={i} />
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
}

export function UniversityExplorerClient({
  universities,
  initialShortlist,
  initialApplications,
  isLoggedIn,
  hasProfile,
}: ExplorerClientProps) {
  return (
    <UniversityExplorerProvider
      initialUniversities={universities}
      initialShortlist={initialShortlist}
      initialApplications={initialApplications}
      isLoggedIn={isLoggedIn}
      hasProfile={hasProfile}
    >
      <ExplorerContent />
    </UniversityExplorerProvider>
  );
}
