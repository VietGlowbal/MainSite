'use client';

import dynamic from 'next/dynamic';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  UniversityExplorerProvider,
  useExplorer,
  type ExplorerUniversity,
  type ApplicationEntry,
} from '@/lib/explorer-context';
import { MatchBadge } from '@/components/match-badge';
import {
  ADMISSION_CATEGORY_META,
  ADMISSION_CATEGORY_ORDER,
  type AdmissionCategory,
} from '@/lib/admission-fit';
import { Button, EmptyState, DualRangeSlider } from '@/components/ui';
import { JourneySteps } from '@/components/JourneySteps';
import { FadeInImage } from './fade-in-image';
import { COUNTRY_FLAGS } from './explorer-constants';

const CompactGlobeDynamic = dynamic(
  () => import('@/components/landing-globe').then((mod) => ({ default: mod.LandingGlobe })),
  { ssr: false },
);

// The university detail view (~1,400 lines, only shown after a card click)
// is lazy-loaded so the initial browse experience ships a smaller bundle.
const DetailView = dynamic(
  () => import('./detail-view').then((mod) => ({ default: mod.DetailView })),
  { ssr: false },
);

/* ─────────────────────────────────────────────────────────────────────────
   COUNTRY FLAGS (emoji) — for inline use on cards
───────────────────────────────────────────────────────────────────────── */


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

/**
 * Popular search chips for the hero. Plain labels — no icons — so the
 * row reads as a calm row of pill buttons next to the bolder primary
 * "Search universities" CTA.
 */
const POPULAR_SEARCH_CHIPS: Array<{ label: string }> = [
  { label: 'Computer Science' },
  { label: 'Business' },
  { label: 'Engineering' },
  { label: 'Medicine' },
  { label: 'Data Science' },
  { label: 'Law' },
];

/* ─────────────────────────────────────────────────────────────────────────
   IMPROVE YOUR SEARCH — replaces the old QuizStickyBar.
   ────────────────────────────────────────────────────────────────────────
   This is a small, optional, in-page pill that nudges users towards the
   onboarding without ever taking over the page. It sits unobtrusively in
   the page header area and is dismissable. Discovery is now led by the
   HookBand at the top of the page (whose CTA hands off to onboarding),
   so first-time visitors are no longer auto-redirected.
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

/**
 * The mockup's stats strip ("10,000+ universities · 200+ countries · 95M+
 * student reviews · Updated · Sources") was removed by request — it added
 * visual clutter without driving conversion. The trust signals it carried
 * are still surfaced via the per-card "Verified data" line and the
 * sidebar's source attributions.
 */

function HeroIllustration() {
  // Globe pinned to the top-right of the hero card. Sized large enough
  // that its top hemisphere reads big and dramatic, while its bottom
  // hemisphere drops below the hero's title row and gets visually masked
  // by the search-bar pill (which sits on a higher z-index). Combined
  // with the hero's `overflow-hidden`, this gives the "globe tucked
  // behind the search bar" look — only the top half is ever on-screen.
  return (
    <div className="pointer-events-none absolute right-[-3%] top-[-12%] h-[420px] w-[420px] md:right-[2%] md:h-[460px] md:w-[460px] lg:h-[520px] lg:w-[520px]">
      <div
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{
          background:
            'radial-gradient(circle at 50% 45%, rgba(255,77,140,0.16) 0%, rgba(0,194,255,0.12) 40%, transparent 70%)',
        }}
      />
      <div className="absolute inset-0 pointer-events-auto">
        <CompactGlobeDynamic theme="marble" responsive rotateSpeed={0.4} />
      </div>
    </div>
  );
}

function SearchHero({
  search,
  onSearchChange,
  onShowAllPrograms,
}: {
  search: SearchState;
  onSearchChange: (s: SearchState) => void;
  onShowAllPrograms: () => void;
}) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-black/5 bg-white px-6 py-7 shadow-[0_12px_32px_rgba(22,33,62,0.06)] md:px-9 md:py-9">
      {/* Globe — absolutely positioned so it sits behind the title and
          the search bar. The hero's `overflow-hidden` clips its bottom
          edge; the search bar's higher z-index hides what little spills
          under it. */}
      <HeroIllustration />

      {/* Title row — left-aligned, sized so it doesn't reach into the
          globe's column on lg+. Stays above the globe via z-index. */}
      <div className="relative z-10 max-w-xl">
        <h1 className="text-[2.1rem] font-semibold leading-[1.05] tracking-tight text-slate-900 md:text-[2.6rem]">
          Find the university
          <br />
          <span className="bg-[linear-gradient(135deg,#FF3D9A,#FF85B3,#19B8D8)] bg-clip-text text-transparent">
            that&apos;s right for you
          </span>
        </h1>
        <p className="mt-3 max-w-md text-sm text-slate-500">
          Explore 10,000+ universities worldwide and find your perfect fit.
        </p>
      </div>

      {/* Full-width search bar. `relative z-10` lifts it above the globe
          so the globe's lower hemisphere visually disappears behind it. */}
      <div className="relative z-10 mt-6 grid gap-2 rounded-full border border-slate-200 bg-white p-1.5 shadow-[0_4px_14px_rgba(15,23,42,0.05)] md:grid-cols-[1.1fr_1fr_1fr_auto] md:gap-1">
        <div className="relative flex items-center md:border-r md:border-slate-100 md:pr-1">
          <SearchIcon />
          <input
            type="text"
            placeholder="Search by university name"
            value={search.name}
            onChange={(e) => onSearchChange({ ...search, name: e.target.value })}
            className="w-full rounded-full bg-transparent py-2.5 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
          />
        </div>
        <div className="relative flex items-center md:border-r md:border-slate-100 md:pr-1">
          <PinIcon />
          <input
            type="text"
            placeholder="Where do you want to study?"
            value={search.location}
            onChange={(e) => onSearchChange({ ...search, location: e.target.value })}
            className="w-full rounded-full bg-transparent py-2.5 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
          />
        </div>
        <div className="relative flex items-center md:pr-1">
          <select
            value={search.program}
            onChange={(e) => onSearchChange({ ...search, program: e.target.value })}
            className="w-full cursor-pointer appearance-none rounded-full bg-transparent py-2.5 pl-3 pr-8 text-sm text-slate-700 focus:outline-none"
          >
            <option value="">Select a subject or field</option>
            {PROGRAM_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <ChevronIcon />
        </div>
        <Button
          variant="primary"
          leftIcon={<SearchIconWhite />}
          className="md:px-6"
        >
          Search universities
        </Button>
      </div>

      {/* Popular searches — single line with horizontal overflow. No
          icons — keeps the row clean and lets the chip text breathe. */}
      <div className="relative z-10 mt-4 flex items-center gap-3">
        <span className="shrink-0 text-xs font-semibold text-slate-700">
          Popular searches:
        </span>
        <div className="flex flex-1 items-center gap-2 overflow-x-auto whitespace-nowrap pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {POPULAR_SEARCH_CHIPS.map((chip) => {
            const active = search.program === chip.label;
            return (
              <button
                key={chip.label}
                type="button"
                onClick={() => onSearchChange({ ...search, program: chip.label })}
                className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? 'border-pink-200 bg-pink-50 text-pink-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-pink-200 hover:text-pink-700'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={onShowAllPrograms}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 hover:border-pink-200 hover:text-pink-700 transition"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            View all
          </button>
        </div>
        <div className="shrink-0">
          <ImproveSearchPill />
        </div>
      </div>
    </section>
  );
}

/**
 * HookBand — the finful-style landing hook that sits at the very top of the
 * page. Leads with a bold, personal admission-odds question, then an
 * interactive teaser (subject + destination) and a CTA that hands off to
 * `onStartMatch` (onboarding for new visitors, instant matches for profiled
 * users). Headline / subline / CTA are single text nodes so the DOM
 * translator can swap them via the i18n dictionary.
 */
function HookBand({
  countries,
  onStartMatch,
}: {
  countries: string[];
  onStartMatch: (subject: string, country: string) => void;
}) {
  const [subject, setSubject] = useState('');
  const [country, setCountry] = useState('');

  return (
    <section className="relative mb-6 overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#FF3D9A,#FF85B3,#19B8D8)] px-6 py-9 shadow-[0_18px_44px_rgba(255,61,154,0.25)] md:px-12 md:py-12">
      {/* Soft decorative glows */}
      <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/20 blur-3xl" />
      <span aria-hidden className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-white/10 blur-3xl" />

      <div className="relative z-10 max-w-2xl">
        <h2 className="text-[2rem] font-semibold leading-[1.05] tracking-tight text-white md:text-[3rem]">
          What are your real admission odds?
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/85 md:text-base">
          Tell us what and where you want to study — we&apos;ll match you with universities and scholarships that fit.
        </p>
      </div>

      {/* Interactive teaser: subject + destination + CTA */}
      <div className="relative z-10 mt-6 flex flex-col gap-2 rounded-[1.5rem] bg-white/15 p-2 backdrop-blur-md sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            aria-label="Subject or field"
            className="w-full cursor-pointer appearance-none rounded-full bg-white/95 py-3 pl-4 pr-9 text-sm font-medium text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <option value="">Select a subject or field</option>
            {PROGRAM_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <ChevronIcon />
        </div>
        <div className="relative flex-1">
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            aria-label="Destination"
            className="w-full cursor-pointer appearance-none rounded-full bg-white/95 py-3 pl-4 pr-9 text-sm font-medium text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <option value="">Choose a destination</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <ChevronIcon />
        </div>
        <button
          type="button"
          onClick={() => onStartMatch(subject, country)}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-pink-600 shadow-sm transition hover:bg-pink-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          See my odds
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>

      <p className="relative z-10 mt-3 text-xs text-white/80">
        Free to explore — sign in to save your matches
      </p>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   FILTER STATE
───────────────────────────────────────────────────────────────────────── */

type FilterState = {
  quickFilter: 'all' | 'russell' | 'stem' | 'arts' | 'top50';
  countries: string[];
  /** [low, high] QS rank range. `[1, QS_RANK_MAX]` is the inactive default. */
  qsRanking: [number, number];
  /** [low, high] tuition USD/year range. `[0, TUITION_MAX]` means "Any". */
  tuition: [number, number];
  /** [low, high] acceptance-rate range, percent. `[0, 100]` means "Any". */
  acceptance: [number, number];
  type: 'all' | 'public' | 'private';
  campusSetting: 'all' | 'urban' | 'suburban' | 'rural';
  scholarship: 'all' | 'available';
  deadline: 'all' | 'open' | 'soon';
};

const QS_RANK_MIN = 1;
const QS_RANK_MAX = 1000;
const TUITION_MIN = 0;
const TUITION_MAX = 100000;
const ACCEPTANCE_MIN = 0;
const ACCEPTANCE_MAX = 100;

const DEFAULT_FILTERS: FilterState = {
  quickFilter: 'all',
  countries: [],
  qsRanking: [QS_RANK_MIN, QS_RANK_MAX],
  tuition: [TUITION_MIN, TUITION_MAX],
  acceptance: [ACCEPTANCE_MIN, ACCEPTANCE_MAX],
  type: 'all',
  campusSetting: 'all',
  scholarship: 'all',
  deadline: 'all',
};

// Helpers — a slider is "active" when it's been moved off either edge.
const isQsActive = (range: [number, number]) =>
  range[0] !== QS_RANK_MIN || range[1] !== QS_RANK_MAX;
const isTuitionActive = (range: [number, number]) =>
  range[0] !== TUITION_MIN || range[1] !== TUITION_MAX;
const isAcceptanceActive = (range: [number, number]) =>
  range[0] !== ACCEPTANCE_MIN || range[1] !== ACCEPTANCE_MAX;

// Count how many user-set filters are active (compared to DEFAULT_FILTERS)
function countActiveFilters(filters: FilterState): number {
  let n = 0;
  if (filters.quickFilter !== 'all') n += 1;
  if (filters.countries.length > 0) n += filters.countries.length;
  if (isQsActive(filters.qsRanking)) n += 1;
  if (isTuitionActive(filters.tuition)) n += 1;
  if (isAcceptanceActive(filters.acceptance)) n += 1;
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
   FILTER SIDEBAR — mockup style
   ────────────────────────────────────────────────────────────────────────
   The sidebar below mirrors the mockup: tighter row-style sections with
   chevrons, range sliders for QS/Tuition/Acceptance, a single big pink
   "Show N results" CTA at the bottom. Each section can be expanded to
   reveal its content; collapsed it shows only the title + a one-line
   summary of the current value (e.g. "Any country"). Sliders live inside
   the section *body* but their summary line is rendered next to the title
   so users see what's set without having to expand.
*/

function SidebarSection({
  title,
  icon,
  summary,
  open,
  onToggle,
  children,
  /** Force the section to stay open (useful for sliders that are always
   *  visible in the mockup). */
  alwaysOpen,
}: {
  title: string;
  icon?: React.ReactNode;
  summary?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
  alwaysOpen?: boolean;
}) {
  const isOpen = alwaysOpen || open;
  return (
    <div className="border-b border-slate-100 py-3 last:border-0">
      <button
        type="button"
        onClick={alwaysOpen ? undefined : onToggle}
        className={`flex w-full items-start justify-between gap-2 text-left ${
          alwaysOpen ? 'cursor-default' : 'cursor-pointer'
        }`}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          {icon ? <span className="text-slate-400">{icon}</span> : null}
          {title}
        </span>
        {!alwaysOpen ? (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`mt-1 shrink-0 text-slate-400 transition-transform ${
              isOpen ? 'rotate-180' : ''
            }`}
            aria-hidden
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        ) : null}
      </button>
      {summary ? (
        <p className="mt-0.5 text-xs text-slate-400">{summary}</p>
      ) : null}
      {isOpen && children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}

const INSTITUTION_TYPES: Array<{ value: 'all' | 'public' | 'private'; label: string }> = [
  { value: 'all', label: 'Any type' },
  { value: 'public', label: 'Public' },
  { value: 'private', label: 'Private' },
];

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
    location: false,
    subject: false,
    qs: true,
    tuition: true,
    acceptance: true,
    studyLevel: false,
    campus: false,
    language: false,
    scholarship: false,
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

  // Pretty summaries for the collapsed state. Keep these short — they sit
  // in a small caption row below the section title.
  const countrySummary =
    filters.countries.length === 0
      ? 'Any country'
      : filters.countries.length === 1
        ? filters.countries[0]
        : `${filters.countries.length} countries selected`;

  const subjectSummary =
    filters.quickFilter === 'all' ? 'Select a subject' : SUBJECT_LABELS[filters.quickFilter];

  const studyLevelSummary =
    filters.type === 'all'
      ? 'Any type'
      : filters.type === 'public'
        ? 'Public'
        : 'Private';

  const campusSummary =
    filters.campusSetting === 'all'
      ? 'Any setting'
      : filters.campusSetting.charAt(0).toUpperCase() + filters.campusSetting.slice(1);

  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_14px_rgba(15,23,42,0.04)] self-start">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
          Refine your search
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
          className="text-xs font-medium text-pink-600 hover:underline disabled:text-slate-300 disabled:no-underline disabled:cursor-not-allowed"
        >
          Clear all
        </button>
      </div>

      {/* Study destination — simple region picker */}
      <SidebarSection
        title="Study destination"
        summary={countrySummary}
        open={open.location}
        onToggle={() => toggle('location')}
      >
        <input
          type="text"
          placeholder="Search country or region"
          value={countrySearch}
          onChange={(e) => setCountrySearch(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:border-pink-300 focus:outline-none focus:bg-white"
        />
        <div className="mt-2 max-h-44 space-y-1 overflow-y-auto pr-1">
          {Object.entries(matchedRegions).map(([region, countries]) => {
            const allRegionSelected = countries.every((c) => filters.countries.includes(c));
            return (
              <CheckboxRow
                key={region}
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
            );
          })}
        </div>
      </SidebarSection>

      {/* Subject / Field — reuses quickFilter under the hood */}
      <SidebarSection
        title="Subject / Field"
        summary={subjectSummary}
        open={open.subject}
        onToggle={() => toggle('subject')}
      >
        {(['all', 'stem', 'arts', 'russell', 'top50'] as const).map((value) => (
          <RadioRow
            key={value}
            label={SUBJECT_LABELS[value]}
            checked={filters.quickFilter === value}
            onClick={() => onChange({ ...filters, quickFilter: value })}
          />
        ))}
      </SidebarSection>

      {/* QS World Ranking — dual-thumb range, collapsible. */}
      <SidebarSection
        title="QS World Ranking"
        icon={<TrophyIcon />}
        open={open.qs}
        onToggle={() => toggle('qs')}
        summary={
          isQsActive(filters.qsRanking)
            ? filters.qsRanking[0] === QS_RANK_MIN
              ? `Top ${filters.qsRanking[1]}`
              : filters.qsRanking[1] === QS_RANK_MAX
                ? `From #${filters.qsRanking[0]}`
                : `#${filters.qsRanking[0]}–#${filters.qsRanking[1]}`
            : 'Any'
        }
      >
        <DualRangeSlider
          min={QS_RANK_MIN}
          max={QS_RANK_MAX}
          step={10}
          value={filters.qsRanking}
          onValueChange={(value) => onChange({ ...filters, qsRanking: value })}
          startLabel="1"
          endLabel="1000+"
          ariaLabelMin="Minimum QS rank"
          ariaLabelMax="Maximum QS rank"
        />
      </SidebarSection>

      {/* Tuition fees — dual-thumb range, collapsible. */}
      <SidebarSection
        title="Tuition fees (per year)"
        icon={<DollarIcon />}
        open={open.tuition}
        onToggle={() => toggle('tuition')}
        summary={
          isTuitionActive(filters.tuition)
            ? (() => {
                const [lo, hi] = filters.tuition;
                const fmt = (n: number) =>
                  n === 0 ? 'Free' : `$${(n / 1000).toFixed(0)}k`;
                if (lo === TUITION_MIN) return `Up to ${fmt(hi)}`;
                if (hi === TUITION_MAX) return `From ${fmt(lo)}`;
                return `${fmt(lo)} – ${fmt(hi)}`;
              })()
            : 'Any'
        }
      >
        <DualRangeSlider
          min={TUITION_MIN}
          max={TUITION_MAX}
          step={1000}
          value={filters.tuition}
          onValueChange={(value) => onChange({ ...filters, tuition: value })}
          startLabel="Free"
          endLabel="$100K+"
          ariaLabelMin="Minimum tuition"
          ariaLabelMax="Maximum tuition"
        />
      </SidebarSection>

      {/* Acceptance rate — dual-thumb range, collapsible. */}
      <SidebarSection
        title="Acceptance rate"
        icon={<PercentIcon />}
        open={open.acceptance}
        onToggle={() => toggle('acceptance')}
        summary={
          isAcceptanceActive(filters.acceptance)
            ? (() => {
                const [lo, hi] = filters.acceptance;
                if (lo === ACCEPTANCE_MIN) return `Up to ${hi}%`;
                if (hi === ACCEPTANCE_MAX) return `From ${lo}%`;
                return `${lo}% – ${hi}%`;
              })()
            : 'Any'
        }
      >
        <DualRangeSlider
          min={ACCEPTANCE_MIN}
          max={ACCEPTANCE_MAX}
          step={1}
          value={filters.acceptance}
          onValueChange={(value) => onChange({ ...filters, acceptance: value })}
          startLabel="0%"
          endLabel="100%"
          ariaLabelMin="Minimum acceptance rate"
          ariaLabelMax="Maximum acceptance rate"
        />
      </SidebarSection>

      {/* Study level — collapsible. Currently driven by the existing
          institution `type` field; once we ingest course-level data we'll
          split this into a true study-level filter (UG / PG / PhD). */}
      <SidebarSection
        title="Study level"
        icon={<CampusIcon />}
        summary={studyLevelSummary}
        open={open.studyLevel}
        onToggle={() => toggle('studyLevel')}
      >
        {INSTITUTION_TYPES.map((opt) => (
          <RadioRow
            key={opt.value}
            label={opt.label}
            checked={filters.type === opt.value}
            onClick={() => onChange({ ...filters, type: opt.value })}
          />
        ))}
      </SidebarSection>

      {/* Campus setting — collapsible */}
      <SidebarSection
        title="Campus setting"
        icon={<BuildingIcon />}
        summary={campusSummary}
        open={open.campus}
        onToggle={() => toggle('campus')}
      >
        {(['all', 'urban', 'suburban', 'rural'] as const).map((value) => (
          <RadioRow
            key={value}
            label={value === 'all' ? 'Any setting' : value.charAt(0).toUpperCase() + value.slice(1)}
            checked={filters.campusSetting === value}
            onClick={() => onChange({ ...filters, campusSetting: value })}
          />
        ))}
      </SidebarSection>

      {/* Program language — placeholder; collapsible. We don't have language
          data on each university, so this section is a visual stub today. */}
      <SidebarSection
        title="Program language"
        icon={<GlobeMiniIcon />}
        summary="Any"
        open={open.language}
        onToggle={() => toggle('language')}
      >
        <p className="text-xs text-slate-400">
          Language data coming soon — we&apos;re ingesting it from each university&apos;s course catalogue.
        </p>
      </SidebarSection>

      {/* Scholarships available — toggle row to match the mockup's checkbox */}
      <SidebarSection
        title="Scholarships available"
        icon={<DollarIcon />}
        open
        onToggle={() => undefined}
        alwaysOpen
      >
        <CheckboxRow
          label="Show only with scholarships"
          checked={filters.scholarship === 'available'}
          onClick={() =>
            onChange({
              ...filters,
              scholarship: filters.scholarship === 'available' ? 'all' : 'available',
            })
          }
        />
      </SidebarSection>

      <Button variant="primary" fullWidth className="mt-5">
        Show {totalCount.toLocaleString()} results
      </Button>
    </aside>
  );
}

const SUBJECT_LABELS: Record<FilterState['quickFilter'], string> = {
  all: 'Any subject',
  stem: 'STEM',
  arts: 'Arts & Humanities',
  russell: 'Russell Group',
  top50: 'Global Top 50',
};

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
  compareCount,
  sort,
  onSortChange,
  view,
  onViewChange,
  onOpenCompare,
}: {
  totalCount: number;
  compareCount: number;
  sort: SortKey;
  onSortChange: (s: SortKey) => void;
  view: 'grid' | 'list';
  onViewChange: (v: 'grid' | 'list') => void;
  /** Click handler for the "Compare (N)" pill — opens the compare modal
   *  when at least two universities are selected. */
  onOpenCompare: () => void;
}) {
  const canCompare = compareCount >= 2;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Result count — friendlier microcopy. The bold number anchors the
          row visually and matches the mockup's "1,248 universities found". */}
      <p className="text-sm text-slate-700">
        {totalCount === 0 ? (
          <>No universities match yet — try widening your filters.</>
        ) : (
          <>
            <span className="font-semibold text-slate-900">{totalCount.toLocaleString()}</span>{' '}
            universities found
          </>
        )}
      </p>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {/* Compare pill — disabled visual when the user hasn't picked
            at least two universities yet. */}
        <button
          type="button"
          onClick={onOpenCompare}
          disabled={!canCompare}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-pink-200 hover:text-pink-700 disabled:cursor-not-allowed disabled:opacity-60"
          title={
            canCompare
              ? 'Open the compare panel'
              : 'Pick at least two universities to compare'
          }
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <rect x="3" y="3" width="7" height="14" rx="1" />
            <rect x="14" y="7" width="7" height="14" rx="1" />
          </svg>
          Compare ({compareCount})
        </button>

        {/* Sort */}
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-slate-500 sm:inline">Sort by:</span>
          <div className="relative">
            <select
              value={sort}
              onChange={(e) => onSortChange(e.target.value as SortKey)}
              className="cursor-pointer appearance-none rounded-full border border-slate-200 bg-white pl-3 pr-8 py-1.5 text-xs font-medium text-slate-700 focus:border-pink-300 focus:outline-none"
            >
              <option value="best_match">Best Match</option>
              <option value="rank_asc">QS Rank: Best first</option>
              <option value="tuition_asc">Tuition: Low → High</option>
              <option value="acceptance_asc">Acceptance: Most selective</option>
            </select>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>

        {/* View toggle */}
        <div className="hidden items-center gap-1.5 sm:flex">
          <span className="text-xs text-slate-500">View</span>
          <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-0.5">
            <button
              type="button"
              onClick={() => onViewChange('grid')}
              aria-label="Grid view"
              className={`rounded-full p-1.5 transition ${
                view === 'grid'
                  ? 'bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] text-white'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              <GridIcon />
            </button>
            <button
              type="button"
              onClick={() => onViewChange('list')}
              aria-label="List view"
              className={`rounded-full p-1.5 transition ${
                view === 'list'
                  ? 'bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] text-white'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              <ListIcon />
            </button>
          </div>
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
 * Parse a free-text tuition string into a numeric USD figure (major units).
 * Returns a {lo, hi} range, the sentinel 'free', or null when nothing is parseable.
 * Mirrors the number-extraction in formatTuitionForCard — do NOT use parseTuition()
 * above, which strips every separator and would fuse "42,000-65,000" into one number.
 */
function parseTuitionRange(
  tuition: string | null | undefined,
): { lo: number; hi: number } | 'free' | null {
  if (!tuition) return null;
  const trimmed = tuition.trim();
  if (!trimmed || trimmed === '—') return null;
  if (/free/i.test(trimmed)) return 'free';
  const cleaned = trimmed.replace(/[,]/g, '');
  const range = cleaned.match(/(\d{3,6})\s*[–-]\s*(\d{3,6})/);
  if (range) return { lo: parseInt(range[1], 10), hi: parseInt(range[2], 10) };
  const single = cleaned.match(/(\d{3,6})/);
  if (single) {
    const n = parseInt(single[1], 10);
    return { lo: n, hi: n };
  }
  return null;
}

/** "$X" for a single major-unit USD amount, condensing thousands to a k-suffix. */
function formatUsdOne(n: number): string {
  return Math.round(n).toLocaleString('en-US'); // 62000 -> "62,000"
}

/**
 * "$" presentation of a USD amount (major units) as full, thousands-separated
 * numbers: "$62,000", "$41,000–45,000", "$343", "$0".
 */
function formatUsdCompact(lo: number, hi?: number): string {
  if (hi != null && hi !== lo) return `$${formatUsdOne(lo)}–${formatUsdOne(hi)}`;
  return `$${formatUsdOne(lo)}`;
}

/**
 * Tuition string for the stat row. Picks the first dollar / numeric value,
 * prefixes with `$`, and shows full thousands-separated numbers — so
 * "42,000-65,000 USD" becomes "$42,000–65,000", "59,320 (UG); ~$65,000"
 * becomes "$59,320", and "Free" stays as "Free".
 */
function formatTuitionForCard(tuition: string | null | undefined): string {
  const parsed = parseTuitionRange(tuition);
  if (parsed === 'free') return 'Free';
  if (parsed) return formatUsdCompact(parsed.lo, parsed.hi);
  // Unparseable: show short non-numeric text as-is, otherwise an em dash.
  if (!tuition) return '—';
  const trimmed = tuition.trim();
  if (!trimmed || trimmed === '—') return '—';
  return trimmed.length > 10 ? `${trimmed.slice(0, 9).trim()}…` : trimmed;
}

/**
 * Highest tuition-coverage percentage in a free-text coverage string, e.g.
 * "100% tuition" → 100, "80%–90% tuition" → 90, "50%, 60% or 70% tuition" → 70.
 * Falls back to 100 for full-ride funding when no number is present; null = no signal.
 */
function parseCoveragePercent(
  coverage: string | null | undefined,
  fundingType: string[] | null | undefined,
): number | null {
  const text = (coverage ?? '').trim();
  if (text) {
    const pcts = [...text.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map((m) => parseFloat(m[1]));
    const valid = pcts.filter((p) => p > 0 && p <= 100);
    if (valid.length) return Math.max(...valid);
  }
  if ((fundingType ?? []).includes('full-ride')) return 100;
  return null;
}

/**
 * Approximate FX rates to USD for display-only net-tuition estimates. Static and
 * intentionally rough — scholarship awards are competitive estimates anyway, and we
 * only need order-of-magnitude correctness to avoid wildly misleading figures.
 */
const USD_PER: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  AUD: 0.66,
  CAD: 0.73,
  SGD: 0.74,
  CHF: 1.12,
  VND: 0.00004,
};

function amountToUsd(amount: number, currency: string | null | undefined): number | null {
  const rate = USD_PER[(currency ?? 'USD').toUpperCase()];
  return rate == null ? null : amount * rate;
}

/**
 * Tuition after the single best (largest-reduction) curated scholarship. A parseable
 * coverage percentage scales the tuition; otherwise the scholarship's cash amount
 * (converted to USD) is subtracted. Returns null when there's nothing to discount —
 * no parseable tuition, tuition already free, or no scholarship that reduces it.
 */
function computeNetTuition(
  university: ExplorerUniversity,
): { netLo: number; netHi: number; scholarshipName: string } | null {
  const range = parseTuitionRange(university.tuition_usd);
  if (range === null || range === 'free') return null;

  let best: { netLo: number; netHi: number; scholarshipName: string } | null = null;
  for (const s of university.scholarships ?? []) {
    let netLo: number;
    let netHi: number;

    const pct = parseCoveragePercent(s.coverage, s.fundingType);
    if (pct != null) {
      const factor = 1 - pct / 100;
      netLo = range.lo * factor;
      netHi = range.hi * factor;
    } else {
      const amount = s.amountMax ?? s.amountMin;
      if (amount == null) continue;
      const amtUsd = amountToUsd(amount, s.amountCurrency);
      if (amtUsd == null) continue;
      netLo = Math.max(0, range.lo - amtUsd);
      netHi = Math.max(0, range.hi - amtUsd);
    }

    if (netHi >= range.hi) continue; // didn't actually reduce the bill
    if (!best || netHi < best.netHi) best = { netLo, netHi, scholarshipName: s.name };
  }
  return best;
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

/**
 * Build a one-line "why this match" reason from the breakdown. Picks the
 * top two items by score-to-max ratio and renders short, friendly fragments.
 * Returns `null` if we don't have a breakdown — the card falls back to the
 * existing description in that case.
 */
function buildMatchReason(university: ExplorerUniversity): string | null {
  const b = university.match_breakdown;
  if (!b) return null;

  const items = [
    { key: 'subjects', label: 'subject fit', item: b.subjects },
    { key: 'country', label: 'location', item: b.country },
    { key: 'budget', label: 'budget', item: b.budget },
    { key: 'level', label: 'study level', item: b.level },
    { key: 'environment', label: 'campus vibe', item: b.environment },
  ];

  const ranked = items
    .filter((x) => x.item.score > 0 && x.item.max > 0)
    .sort((a, b) => b.item.score / b.item.max - a.item.score / a.item.max);

  if (ranked.length === 0) return null;

  const top = ranked.slice(0, 2);
  const phrases = top.map((entry) => {
    const ratio = entry.item.score / entry.item.max;
    if (ratio === 1) return `Strong ${entry.label}`;
    if (ratio >= 0.6) return `Good ${entry.label}`;
    return entry.label;
  });

  return phrases.join(' · ');
}

/**
 * Fade-in image — paints `src` with opacity 0, transitions to opacity 1
 * when the browser finishes decoding it. Re-keying via the URL means the
 * component re-mounts (and fade resets) whenever the parent swaps the
 * URL, so the lazy-hydration replacement reads as a smooth reveal rather
 * than a hard pop. Falls back gracefully if `onError` fires by calling
 * the parent-provided handler.
 */

/**
 * Shared interactive logic for both UniversityRow (list view) and
 * UniversityCardCompact (grid view). Returns handlers, derived state,
 * and a few computed values used by both renderers.
 */
function useUniversityCardState(
  university: ExplorerUniversity,
  isCompared: boolean,
  canAddCompare: boolean,
  onToggleCompare: () => void,
) {
  const { isShortlisted, addToShortlist, removeFromShortlist, showToast, setView, isLoggedIn } =
    useExplorer();
  const router = useRouter();
  const saved = isShortlisted(university.id);

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
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

  // Cover-image fallback tracking — same pattern as before. Keyed by URL
  // so a future hydration of a different image resets the failure state
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

  return {
    saved,
    handleSave,
    handleCompare,
    handleViewDetails,
    showCoverImage,
    markFailed,
    setView,
  };
}

/**
 * Tag tones — used by both card variants. Centralised so the grid card
 * and the list row colour the same tag identically.
 */
const TAG_TONES: Array<{ matcher: RegExp; bg: string; text: string }> = [
  { matcher: /(stem|engineer|tech)/i, bg: 'bg-sky-50', text: 'text-sky-700' },
  { matcher: /(research|academic|excellence)/i, bg: 'bg-emerald-50', text: 'text-emerald-700' },
  { matcher: /(alumni|network|reputation|global)/i, bg: 'bg-amber-50', text: 'text-amber-700' },
  { matcher: /(business|innovation|industry)/i, bg: 'bg-violet-50', text: 'text-violet-700' },
  { matcher: /(arts|design|humanities)/i, bg: 'bg-pink-50', text: 'text-pink-700' },
];

function tagToneClass(tag: string): string {
  for (const { matcher, bg, text } of TAG_TONES) {
    if (matcher.test(tag)) return `${bg} ${text}`;
  }
  return 'bg-slate-100 text-slate-600';
}

/**
 * Pick up to N short, descriptive tags for either card variant.
 */
function deriveCardTags(university: ExplorerUniversity, max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const candidates = [
    ...university.tags,
    ...((university.strengths ?? '').split(/[,;·]+/).map((s) => s.trim()).filter(Boolean)),
  ];
  for (const raw of candidates) {
    if (out.length >= max) break;
    const cleaned = raw.replace(/^(strong|excellent|leading|world-class)\s+/i, '').trim();
    if (!cleaned) continue;
    const short = cleaned.length > 26 ? `${cleaned.slice(0, 24).trim()}…` : cleaned;
    const key = short.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(short);
  }
  return out;
}

function UniversityRow({
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
  // `index` is intentionally read but unused — it used to drive a
  // staggered framer-motion entrance, which we removed because it
  // re-triggered when the lazy Wikipedia image hydrated, producing a
  // visible double-flash. The cover image now fades in via a CSS
  // opacity transition on the <img> itself (see below).
  void index;
  const { saved, handleSave, handleCompare, handleViewDetails, showCoverImage, markFailed, setView } =
    useUniversityCardState(university, isCompared, canAddCompare, onToggleCompare);

  const flag = COUNTRY_FLAGS[university.country] ?? '🎓';
  const acceptDisplay = formatAcceptanceForCard(university.accept_rate);
  const tuitionDisplay = formatTuitionForCard(university.tuition_usd);
  const netTuition = computeNetTuition(university);
  const cardTags = useMemo(() => deriveCardTags(university, 3), [university]);
  const blurb =
    (university.specific_insight ?? '') ||
    (university.description ?? '') ||
    (university.strengths ?? '');
  const shortBlurb = blurb.length > 160 ? `${blurb.slice(0, 158).trim()}…` : blurb;
  const matchReason = buildMatchReason(university);
  const hasMatch = university.match_score != null;

  // Fade the cover image in once it actually loads, so the swap from
  // "no image" → "Wikipedia image" reads as a smooth reveal rather
  // than a hard pop. Implemented via the FadeInImage helper so we don't
  // need a useEffect-driven reset (which would cascade renders).

  return (
    <article
      onClick={() => setView('detail', university.id)}
      className={`group relative flex cursor-pointer flex-col gap-4 overflow-hidden rounded-[1.5rem] border bg-white p-3 shadow-[0_4px_14px_rgba(15,23,42,0.04)] transition-shadow duration-200 hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)] md:flex-row md:p-4 ${
        isCompared ? 'border-pink-300 ring-2 ring-pink-200' : 'border-slate-200/80'
      }`}
    >
      {/* LEFT — Cover image */}
      <div
        className="relative h-44 w-full shrink-0 overflow-hidden rounded-[1.25rem] md:h-44 md:w-56"
        style={{ background: `linear-gradient(135deg, ${university.color}, #1a1a2e)` }}
      >
        {showCoverImage ? (
          <FadeInImage
            src={university.image_url}
            alt={university.location}
            onError={() => markFailed(university.image_url)}
            className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform"
          />
        ) : null}
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(180deg, rgba(0,0,0,0.05) 0%, transparent 35%, ${university.color}99 100%)` }}
        />
        {/* QS rank pill — dark navy in the top-left to match the mockup */}
        {university.qs_rank ? (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-slate-900/85 px-2.5 py-1 text-[0.7rem] font-bold text-white shadow-sm backdrop-blur-sm">
            QS #{university.qs_rank}
          </span>
        ) : null}
      </div>

      {/* MIDDLE — Name, location, description, tags */}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold leading-tight text-slate-900 md:text-[1.15rem]">
              {university.name}
            </h3>
            <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-slate-500">
              <span aria-hidden>{flag}</span>
              <span className="truncate">{university.location}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            aria-label={saved ? 'Remove from saved' : 'Save university'}
            title={saved ? 'Saved to My Universities — click to remove' : 'Save and track application progress'}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:scale-110 hover:border-pink-300 hover:text-pink-500"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill={saved ? '#ec4899' : 'none'} stroke={saved ? '#ec4899' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
        </div>

        {shortBlurb ? (
          <p className="line-clamp-2 text-sm leading-relaxed text-slate-500">{shortBlurb}</p>
        ) : null}

        {/* Tags */}
        {cardTags.length > 0 ? (
          <div className="mt-1 flex flex-wrap gap-2">
            {cardTags.map((tag) => (
              <span
                key={tag}
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-[0.7rem] font-medium ${tagToneClass(tag)}`}
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        {(hasMatch || university.admission) ? (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {hasMatch ? (
              <MatchBadge percentage={university.match_score} breakdown={university.match_breakdown} size="sm" />
            ) : null}
            {university.admission ? <AdmissionChip admission={university.admission} /> : null}
            {matchReason ? (
              <span className="line-clamp-1 text-[0.7rem] text-slate-400">{matchReason}</span>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* RIGHT — Stats + actions */}
      <div className="flex shrink-0 flex-col justify-between gap-3 md:w-80 md:border-l md:border-slate-100 md:pl-4">
        <dl className="space-y-2">
          <div className="flex items-center justify-between gap-3 text-sm">
            <dt className="text-slate-500">QS Ranking</dt>
            <dd
              className="font-bold text-slate-900"
              title={university.qs_rank ? `QS World University Ranking #${university.qs_rank}` : undefined}
            >
              {university.qs_rank ? `#${university.qs_rank}` : '—'}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <dt className="text-slate-500">Acceptance Rate</dt>
            <dd
              className="font-bold text-slate-900"
              title={university.accept_rate ?? undefined}
            >
              {acceptDisplay}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-3 text-sm">
            <dt className="text-slate-500">Tuition (Intl.)</dt>
            <dd
              className="flex flex-col items-end leading-tight"
              title={
                netTuition
                  ? `Tuition after ${netTuition.scholarshipName}`
                  : university.tuition_usd ?? undefined
              }
            >
              {netTuition ? (
                <>
                  <span className="text-base font-bold text-rose-600">
                    {netTuition.netHi <= 0
                      ? 'Free'
                      : formatUsdCompact(netTuition.netLo, netTuition.netHi)}
                    {netTuition.netHi > 0 ? (
                      <span className="ml-0.5 text-xs font-medium text-rose-400">/yr</span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 text-xs font-medium text-slate-400">
                    <span className="line-through">{tuitionDisplay}</span> before scholarship
                  </span>
                </>
              ) : (
                <span className="font-bold text-slate-900">
                  {tuitionDisplay}
                  {tuitionDisplay !== '—' && tuitionDisplay !== 'Free' ? (
                    <span className="ml-0.5 text-xs font-medium text-slate-400">/yr</span>
                  ) : null}
                </span>
              )}
            </dd>
          </div>
        </dl>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleViewDetails}
            className="inline-flex h-9 items-center justify-center rounded-full border-2 border-pink-500 bg-white px-4 text-xs font-semibold text-pink-600 transition hover:bg-pink-500 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-300 focus-visible:ring-offset-2"
          >
            View profile
          </button>

          <button
            type="button"
            onClick={handleCompare}
            aria-pressed={isCompared}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700"
          >
            <span
              className={`flex h-4 w-4 items-center justify-center rounded border-2 transition ${
                isCompared ? 'border-pink-500 bg-pink-500' : 'border-slate-300 bg-white'
              }`}
            >
              {isCompared ? (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : null}
            </span>
            Compare
          </button>
        </div>
      </div>
    </article>
  );
}

/**
 * UniversityCardCompact — the grid-view variant. Fits in a ~280px column.
 *
 * Design priorities (very different from the row):
 *   - Image is the dominant element, the rest is small and clean
 *   - Show only the *single* most important metric (match if signed in,
 *     otherwise QS rank), keep stats minimal
 *   - One-line name + flag + city, two short tags, a compact "View profile"
 *     button + tiny compare checkbox in a footer
 *
 * The full-fat row card stays the place where users go for full info.
 */
function UniversityCardCompact({
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
  void index;
  const { saved, handleSave, handleCompare, handleViewDetails, showCoverImage, markFailed, setView } =
    useUniversityCardState(university, isCompared, canAddCompare, onToggleCompare);

  const flag = COUNTRY_FLAGS[university.country] ?? '🎓';
  const cardTags = useMemo(() => deriveCardTags(university, 2), [university]);
  const tuitionDisplay = formatTuitionForCard(university.tuition_usd);
  const netTuition = computeNetTuition(university);
  const hasMatch = university.match_score != null;

  // Same image-fade pattern as UniversityRow — see comment there.

  return (
    <article
      onClick={() => setView('detail', university.id)}
      className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-[1.25rem] border bg-white shadow-[0_4px_14px_rgba(15,23,42,0.04)] transition-shadow duration-200 hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)] ${
        isCompared ? 'border-pink-300 ring-2 ring-pink-200' : 'border-slate-200/80'
      }`}
    >
      {/* Cover */}
      <div
        className="relative aspect-[16/10] w-full overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${university.color}, #1a1a2e)` }}
      >
        {showCoverImage ? (
          <FadeInImage
            src={university.image_url}
            alt={university.location}
            onError={() => markFailed(university.image_url)}
            className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform"
          />
        ) : null}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(180deg, rgba(0,0,0,0.05) 0%, transparent 35%, ${university.color}99 100%)`,
          }}
        />
        {/* QS rank — top-left navy chip */}
        {university.qs_rank ? (
          <span className="absolute left-2.5 top-2.5 inline-flex items-center rounded-full bg-slate-900/85 px-2 py-0.5 text-[0.65rem] font-bold text-white shadow-sm backdrop-blur-sm">
            QS #{university.qs_rank}
          </span>
        ) : null}
        {/* Heart save — top-right */}
        <button
          type="button"
          onClick={handleSave}
          aria-label={saved ? 'Remove from saved' : 'Save university'}
          className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-slate-500 shadow-sm backdrop-blur-sm transition hover:scale-110 hover:text-pink-500"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill={saved ? '#ec4899' : 'none'} stroke={saved ? '#ec4899' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
        {/* Reach / Recommended / Safe — bottom-left overlay */}
        {university.admission ? (
          <span className="absolute bottom-2.5 left-2.5">
            <AdmissionChip admission={university.admission} />
          </span>
        ) : null}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 px-4 pb-4 pt-3">
        <div>
          <h3 className="line-clamp-1 text-[0.95rem] font-semibold leading-tight text-slate-900">
            {university.name}
          </h3>
          <p className="mt-0.5 inline-flex items-center gap-1 text-[0.7rem] text-slate-500">
            <span aria-hidden>{flag}</span>
            <span className="truncate">{university.location}</span>
          </p>
        </div>

        {/* Tags — at most two, kept on a single line */}
        {cardTags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {cardTags.map((tag) => (
              <span
                key={tag}
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.65rem] font-medium ${tagToneClass(tag)}`}
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        {/* Single most-important metric */}
        <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-2 text-[0.7rem]">
          {hasMatch ? (
            <MatchBadge percentage={university.match_score} breakdown={university.match_breakdown} size="sm" />
          ) : (
            <span
              className="text-slate-500"
              title={netTuition ? `Tuition after ${netTuition.scholarshipName}` : undefined}
            >
              <span className="text-slate-400">Tuition</span>{' '}
              <span className={netTuition ? 'font-bold text-rose-600' : 'font-bold text-slate-900'}>
                {netTuition
                  ? netTuition.netHi <= 0
                    ? 'Free'
                    : formatUsdCompact(netTuition.netLo, netTuition.netHi)
                  : tuitionDisplay}
              </span>
              {netTuition ? (
                <span className="ml-1 text-slate-400 line-through">{tuitionDisplay}</span>
              ) : null}
            </span>
          )}
          <button
            type="button"
            onClick={handleCompare}
            aria-pressed={isCompared}
            aria-label={isCompared ? 'Remove from compare' : 'Add to compare'}
            title={isCompared ? 'Remove from compare' : 'Add to compare'}
            className={`flex h-6 w-6 items-center justify-center rounded-full border transition ${
              isCompared
                ? 'border-pink-500 bg-pink-500 text-white'
                : 'border-slate-200 text-slate-400 hover:border-pink-300 hover:text-pink-600'
            }`}
          >
            {isCompared ? (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="14" rx="1" />
                <rect x="14" y="7" width="7" height="14" rx="1" />
              </svg>
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={handleViewDetails}
          className="inline-flex h-9 w-full items-center justify-center rounded-full border-2 border-pink-500 bg-white px-4 text-xs font-semibold text-pink-600 transition hover:bg-pink-500 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-300 focus-visible:ring-offset-2"
        >
          View profile
        </button>
      </div>
    </article>
  );
}

function UniversityCard(props: {
  university: ExplorerUniversity;
  index: number;
  isCompared: boolean;
  onToggleCompare: () => void;
  canAddCompare: boolean;
  /** Layout variant — 'list' (default) renders the full row card,
   *  'grid' renders the compact card optimised for narrow columns. */
  variant?: 'list' | 'grid';
}) {
  if (props.variant === 'grid') return <UniversityCardCompact {...props} />;
  return <UniversityRow {...props} />;
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

  // QS ranking — the slider is a [low, high] range. When both ends sit
  // on the bounds it's effectively "Any". Universities without a QS rank
  // are excluded only when the user has narrowed the range — we don't
  // want to hide unranked schools from a default search.
  if (isQsActive(filters.qsRanking)) {
    const [lo, hi] = filters.qsRanking;
    result = result.filter(
      (u) => u.qs_rank != null && u.qs_rank >= lo && u.qs_rank <= hi,
    );
  }

  // Tuition — [low, high] USD/year. When the range is at its bounds we
  // skip filtering. Universities with unknown tuition stay visible unless
  // the user has explicitly set a low bound > 0 (in which case "unknown"
  // can no longer be argued to satisfy the filter).
  if (isTuitionActive(filters.tuition)) {
    const [lo, hi] = filters.tuition;
    result = result.filter((u) => {
      const t = parseTuition(u.tuition_usd);
      if (t == null) return lo === TUITION_MIN; // include unknowns only if the user kept the floor at 0
      return t >= lo && t <= hi;
    });
  }

  // Acceptance — [low, high] percentage.
  if (isAcceptanceActive(filters.acceptance)) {
    const [lo, hi] = filters.acceptance;
    result = result.filter((u) => {
      const a = parseAcceptanceRate(u.accept_rate);
      if (a == null) return false;
      return a >= lo && a <= hi;
    });
  }

  // Type
  if (filters.type !== 'all') {
    result = result.filter((u) => (u.type ?? '').toLowerCase().includes(filters.type));
  }

  // Scholarship — only universities with at least one curated scholarship linked.
  // (The legacy free-text `scholarship` note exists for nearly every university, so it
  // can't drive this filter; the curated `scholarships` array is the real signal.)
  if (filters.scholarship === 'available') {
    result = result.filter((u) => (u.scholarships ?? []).length > 0);
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
  if (isQsActive(filters.qsRanking)) {
    const [lo, hi] = filters.qsRanking;
    const label =
      lo === QS_RANK_MIN
        ? `QS ≤ ${hi}`
        : hi === QS_RANK_MAX
          ? `QS ≥ ${lo}`
          : `QS ${lo}–${hi}`;
    chips.push({
      key: 'qs',
      label,
      remove: (setFilters) =>
        setFilters((f) => ({ ...f, qsRanking: [QS_RANK_MIN, QS_RANK_MAX] })),
    });
  }
  if (isTuitionActive(filters.tuition)) {
    const [lo, hi] = filters.tuition;
    const fmt = (n: number) =>
      n === 0 ? 'Free' : `$${(n / 1000).toFixed(0)}k`;
    const label =
      lo === TUITION_MIN
        ? `Tuition ≤ ${fmt(hi)}`
        : hi === TUITION_MAX
          ? `Tuition ≥ ${fmt(lo)}`
          : `Tuition ${fmt(lo)}–${fmt(hi)}`;
    chips.push({
      key: 'tuition',
      label,
      remove: (setFilters) =>
        setFilters((f) => ({ ...f, tuition: [TUITION_MIN, TUITION_MAX] })),
    });
  }
  if (isAcceptanceActive(filters.acceptance)) {
    const [lo, hi] = filters.acceptance;
    const label =
      lo === ACCEPTANCE_MIN
        ? `Acceptance ≤ ${hi}%`
        : hi === ACCEPTANCE_MAX
          ? `Acceptance ≥ ${lo}%`
          : `Acceptance ${lo}–${hi}%`;
    chips.push({
      key: 'acceptance',
      label,
      remove: (setFilters) =>
        setFilters((f) => ({ ...f, acceptance: [ACCEPTANCE_MIN, ACCEPTANCE_MAX] })),
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
   COMPARE MODAL — card-based side-by-side comparison
   ────────────────────────────────────────────────────────────────────────
   The previous version was a dense attribute × university table — fast
   to read but visually unrelated to the rest of the product. This rewrite
   uses one card per university (matching the cards on the search page)
   plus a small stats grid at the bottom. Same data, but it now feels
   like Glowbal.
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

  // The metric rows shown in the comparison grid. Kept short and scannable
  // — the goal is "at a glance" decisions, not a CSV dump. Heavy free-text
  // fields like Strengths / Best for stay in the detail page.
  const metrics: Array<{ label: string; render: (u: ExplorerUniversity) => React.ReactNode }> = [
    {
      label: 'Match',
      render: (u) =>
        u.match_score != null ? (
          <span className="font-semibold text-pink-600">{u.match_score}%</span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      label: 'QS Rank',
      render: (u) => (u.qs_rank ? `#${u.qs_rank}` : '—'),
    },
    {
      label: 'Acceptance',
      render: (u) => formatAcceptanceForCard(u.accept_rate),
    },
    {
      label: 'Tuition',
      render: (u) => {
        const t = formatTuitionForCard(u.tuition_usd);
        if (t === 'Free' || t === '—') return t;
        return `$${t}/yr`;
      },
    },
    {
      label: 'Living cost',
      render: (u) => {
        const t = formatTuitionForCard(u.living_cost_usd);
        if (t === 'Free' || t === '—') return t;
        return `$${t}/yr`;
      },
    },
    {
      label: 'Deadline',
      render: (u) => u.application_deadline ?? '—',
    },
  ];

  const cols = universities.length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 12 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_64px_rgba(15,23,42,0.18)]"
        role="dialog"
        aria-modal="true"
        aria-label="Compare universities"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">
              Comparing {cols} {cols === 1 ? 'university' : 'universities'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              At-a-glance differences. Press Esc or click outside to close.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close comparison"
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body — scrolls if it overflows */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Cards row — one per compared university */}
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            }}
          >
            {universities.map((u) => (
              <CompareCard key={u.id} university={u} />
            ))}
          </div>

          {/* Metrics grid — horizontally scrollable on narrow screens.
              Sits below the cards so the visual hierarchy is "what these
              are" → "how they compare". */}
          <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50/40">
            <div
              className="grid min-w-full"
              style={{
                gridTemplateColumns: `160px repeat(${cols}, minmax(160px, 1fr))`,
              }}
            >
              {metrics.map((row, i) => (
                <CompareMetricRow
                  key={row.label}
                  label={row.label}
                  index={i}
                  cells={universities.map((u) => row.render(u))}
                />
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/**
 * One compared-university card — image, QS pill, name, country/flag.
 * Visual language matches the search-page rows so the modal feels like
 * a continuation of the page, not a separate widget.
 */
function CompareCard({ university }: { university: ExplorerUniversity }) {
  const flag = COUNTRY_FLAGS[university.country] ?? '🎓';
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = !!university.image_url && !imgFailed;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_14px_rgba(15,23,42,0.04)]">
      <div
        className="relative aspect-[16/10] w-full overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${university.color}, #1a1a2e)` }}
      >
        {showImage ? (
          <FadeInImage
            src={university.image_url}
            alt={university.location}
            onError={() => setImgFailed(true)}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(180deg, rgba(0,0,0,0.05) 0%, transparent 35%, ${university.color}99 100%)`,
          }}
        />
        {university.qs_rank ? (
          <span className="absolute left-2.5 top-2.5 inline-flex items-center rounded-full bg-slate-900/85 px-2 py-0.5 text-[0.65rem] font-bold text-white shadow-sm backdrop-blur-sm">
            QS #{university.qs_rank}
          </span>
        ) : null}
      </div>
      <div className="px-4 py-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-slate-900">
          {university.name}
        </h3>
        <p className="mt-1 inline-flex items-center gap-1 text-[0.7rem] text-slate-500">
          <span aria-hidden>{flag}</span>
          <span className="truncate">{university.location}</span>
        </p>
      </div>
    </div>
  );
}

/**
 * One row of the metrics grid. The label cell uses a subtle background
 * so the eye tracks horizontally; alternating row tones give a quiet
 * zebra effect without an actual table.
 */
function CompareMetricRow({
  label,
  index,
  cells,
}: {
  label: string;
  index: number;
  cells: React.ReactNode[];
}) {
  const tone = index % 2 === 0 ? 'bg-white' : 'bg-slate-50/60';
  return (
    <>
      <div
        className={`border-b border-slate-100 px-4 py-3 text-[0.7rem] font-semibold uppercase tracking-wider text-slate-500 ${tone}`}
      >
        {label}
      </div>
      {cells.map((cell, i) => (
        <div
          key={i}
          className={`border-b border-slate-100 px-4 py-3 text-sm text-slate-700 ${tone}`}
        >
          <span className="line-clamp-2">{cell}</span>
        </div>
      ))}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   ADMISSION FIT — Reach / Recommended / Safe grouping
   ────────────────────────────────────────────────────────────────────────
   The signed-in applicant uploads a CV or statement of purpose to unlock a
   personalised split of results into three admission buckets. Each bucket is
   driven by the applicant's profile-strength score vs. each university's
   selectivity (see src/lib/admission-fit.ts).
───────────────────────────────────────────────────────────────────────── */

/** Per-category visual tokens shared by the tab bar, banner and card chips. */
const CATEGORY_STYLE: Record<
  AdmissionCategory,
  { text: string; activeBg: string; activeBorder: string; chip: string; dot: string; icon: React.ReactNode }
> = {
  reach: {
    text: 'text-violet-700',
    activeBg: 'bg-violet-50',
    activeBorder: 'border-violet-300 ring-2 ring-violet-200',
    chip: 'bg-violet-50 text-violet-700 border-violet-200',
    dot: 'bg-violet-500',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 17l6-6 4 4 8-8" /><path d="M21 7v6h-6" />
      </svg>
    ),
  },
  recommended: {
    text: 'text-pink-600',
    activeBg: 'bg-pink-50',
    activeBorder: 'border-pink-300 ring-2 ring-pink-200',
    chip: 'bg-pink-50 text-pink-600 border-pink-200',
    dot: 'bg-pink-500',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
  safe: {
    text: 'text-emerald-600',
    activeBg: 'bg-emerald-50',
    activeBorder: 'border-emerald-300 ring-2 ring-emerald-200',
    chip: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
};

/** Small per-card chip reaffirming a university's admission bucket. */
function AdmissionChip({ admission }: { admission: NonNullable<ExplorerUniversity['admission']> }) {
  const meta = ADMISSION_CATEGORY_META[admission.category];
  const style = CATEGORY_STYLE[admission.category];
  const label = meta.label.replace(' universities', '');
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold ${style.chip}`}
      title={`${label} — about ${admission.probability}% estimated admission chance for your profile`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} aria-hidden />
      {label} · {admission.probability}%
    </span>
  );
}

/** The three-up tab bar (Reach / Recommended / Safe) with live counts. */
function CategoryTabs({
  counts,
  active,
  onChange,
}: {
  counts: Record<AdmissionCategory, number>;
  active: AdmissionCategory;
  onChange: (c: AdmissionCategory) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Admission categories"
      className="grid gap-3 sm:grid-cols-3"
    >
      {ADMISSION_CATEGORY_ORDER.map((cat) => {
        const meta = ADMISSION_CATEGORY_META[cat];
        const style = CATEGORY_STYLE[cat];
        const isActive = cat === active;
        return (
          <button
            key={cat}
            role="tab"
            aria-selected={isActive}
            type="button"
            onClick={() => onChange(cat)}
            className={`flex items-center gap-3 rounded-2xl border bg-white px-4 py-3 text-left transition ${
              isActive ? `${style.activeBg} ${style.activeBorder}` : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                isActive ? `${style.activeBg} ${style.text}` : 'bg-slate-50 text-slate-400'
              }`}
            >
              {style.icon}
            </span>
            <span className="min-w-0">
              <span className={`block text-sm font-semibold ${isActive ? style.text : 'text-slate-800'}`}>
                {meta.label}
              </span>
              <span className="block text-xs text-slate-500">
                {meta.tagline} · <span className="font-semibold text-slate-700">{counts[cat]}</span>
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Contextual banner describing the active category (mirrors the mockup). */
function CategoryBanner({ category }: { category: AdmissionCategory }) {
  const meta = ADMISSION_CATEGORY_META[category];
  const style = CATEGORY_STYLE[category];
  return (
    <div className={`flex items-start gap-4 rounded-2xl border border-slate-200 p-4 ${style.activeBg}`}>
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white ${style.text}`}>
        {style.icon}
      </span>
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${style.text}`}>{meta.label}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{meta.description}</p>
      </div>
    </div>
  );
}

/**
 * Locked state shown until the applicant uploads a CV or statement. Without a
 * document we can't reliably gauge their profile strength, so grouping stays
 * gated behind an upload CTA.
 */
function MatchUnlockPanel() {
  const { isLoggedIn } = useExplorer();
  const router = useRouter();
  const href = isLoggedIn ? '/profile/documents' : '/auth?next=/profile/documents';
  return (
    <div className="relative overflow-hidden rounded-2xl border border-pink-200 bg-gradient-to-br from-pink-50 via-white to-cyan-50/40 p-6">
      {/* Ghost preview of the three tabs behind a soft veil */}
      <div aria-hidden className="pointer-events-none absolute inset-x-6 top-6 grid gap-3 opacity-40 blur-[2px] sm:grid-cols-3">
        {ADMISSION_CATEGORY_ORDER.map((cat) => (
          <div key={cat} className="h-16 rounded-2xl border border-slate-200 bg-white" />
        ))}
      </div>
      <div className="relative mx-auto max-w-xl pt-20 text-center sm:pt-24">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-pink-100 text-pink-600">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </span>
        <h3 className="text-lg font-semibold text-slate-900">
          Unlock your Reach, Recommended &amp; Safe matches
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Upload your CV or statement of purpose and we&apos;ll read your grades, experience and
          writing to group these universities by how likely you are to get in — plus where coaching
          could turn a reach into an offer.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <Button variant="primary" onClick={() => router.push(href)}>
            Upload CV or statement
          </Button>
          <Button variant="secondary" onClick={() => router.push('/profile')}>
            Complete your profile
          </Button>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Your documents stay private — they&apos;re only used to personalise your matches.
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   BROWSE VIEW (main layout)
───────────────────────────────────────────────────────────────────────── */

function BrowseView() {
  const { universities, hasProfile, admissionUnlocked } = useExplorer();
  const router = useRouter();
  const resultsRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState<SearchState>({ name: '', location: '', program: '' });
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortKey>('best_match');
  // Default to list view to match the redesigned mockup. Users who prefer
  // the dense grid layout can toggle from the ResultsBar.
  const [view, setView] = useState<'grid' | 'list'>('list');
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [activeCategory, setActiveCategory] = useState<AdmissionCategory>('recommended');

  const filtered = useMemo(
    () => applyFilters(universities, filters, search, sort),
    [universities, filters, search, sort],
  );

  // Split the (already filtered + sorted) results into admission buckets.
  // Counts stay stable across tab switches since they're computed from the
  // full filtered set, not the active tab.
  const groups = useMemo(() => {
    const g: Record<AdmissionCategory, ExplorerUniversity[]> = {
      reach: [],
      recommended: [],
      safe: [],
    };
    if (!admissionUnlocked) return g;
    for (const u of filtered) {
      if (u.admission) g[u.admission.category].push(u);
    }
    return g;
  }, [filtered, admissionUnlocked]);

  const categoryCounts = useMemo(
    () => ({ reach: groups.reach.length, recommended: groups.recommended.length, safe: groups.safe.length }),
    [groups],
  );

  // If the selected bucket is empty (e.g. after a filter change) fall back to
  // the first non-empty bucket so the user never lands on a blank tab. Derived
  // rather than stored, so we don't need a state-syncing effect.
  const effectiveCategory = useMemo(() => {
    if (!admissionUnlocked || categoryCounts[activeCategory] > 0) return activeCategory;
    return ADMISSION_CATEGORY_ORDER.find((c) => categoryCounts[c] > 0) ?? activeCategory;
  }, [admissionUnlocked, categoryCounts, activeCategory]);

  // What the results grid actually renders: the active bucket when grouping is
  // unlocked, otherwise the plain filtered list.
  const displayed = admissionUnlocked ? groups[effectiveCategory] : filtered;

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

  // Destination options for the hook teaser — the countries actually present
  // in the loaded data, de-duped and alphabetised.
  const countryOptions = useMemo(
    () => [...new Set(universities.map((u) => u.country))].sort(),
    [universities],
  );

  // Hook CTA: profiled users get instant filtered matches; everyone else is
  // funnelled into onboarding (which leads to sign-in). The chosen subject /
  // country ride along as query params for optional onboarding prefill.
  const onStartMatch = (subject: string, country: string) => {
    setSearch((s) => ({
      ...s,
      program: subject || s.program,
      location: country || s.location,
    }));
    if (!hasProfile) {
      const p = new URLSearchParams({ from: 'search' });
      if (subject) p.set('subject', subject);
      if (country) p.set('country', country);
      router.push(`/onboarding?${p.toString()}`);
    } else {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <>
      <div className="w-full px-4 py-6 md:px-6 md:py-8">
        {/* Landing hook — finful-style admission-odds question + teaser */}
        <HookBand countries={countryOptions} onStartMatch={onStartMatch} />
        {/* Journey steps */}
        <JourneySteps activeStep={1} />
        {/* Hero */}
        <SearchHero
          search={search}
          onSearchChange={setSearch}
          onShowAllPrograms={() =>
            setSearch({ ...search, program: search.program ? '' : PROGRAM_OPTIONS[0] })
          }
        />

        {/* Body: sidebar + results */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
          {/* Sidebar */}
          <FilterSidebar
            filters={filters}
            onChange={setFilters}
            totalCount={filtered.length}
            onReset={() => setFilters(DEFAULT_FILTERS)}
          />

          {/* Main column */}
          <div ref={resultsRef} className="space-y-5 scroll-mt-6">
            {/* Reach / Recommended / Safe grouping — gated on CV/SOP upload */}
            {admissionUnlocked ? (
              <>
                <CategoryTabs
                  counts={categoryCounts}
                  active={effectiveCategory}
                  onChange={setActiveCategory}
                />
                <CategoryBanner category={effectiveCategory} />
              </>
            ) : (
              <MatchUnlockPanel />
            )}

            <ResultsBar
              totalCount={displayed.length}
              compareCount={compareIds.length}
              sort={sort}
              onSortChange={setSort}
              view={view}
              onViewChange={setView}
              onOpenCompare={() => {
                if (compareIds.length >= 2) setShowCompare(true);
              }}
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

            {displayed.length > 0 ? (
              <div
                className={
                  view === 'grid'
                    ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3'
                    : 'flex flex-col gap-3'
                }
              >
                {displayed.map((u, i) => (
                  <UniversityCard
                    key={u.id}
                    university={u}
                    index={i}
                    isCompared={compareIds.includes(u.id)}
                    onToggleCompare={() => toggleCompare(u.id)}
                    canAddCompare={compareIds.length < 4}
                    variant={view}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                }
                title="No matches yet — let's widen the search"
                description="Your filters might be a little tight. Try clearing one or two and we'll show universities across more countries and price ranges."
                action={
                  <Button
                    variant="primary"
                    onClick={() => {
                      setFilters(DEFAULT_FILTERS);
                      setSearch({ name: '', location: '', program: '' });
                    }}
                  >
                    Reset filters
                  </Button>
                }
                secondaryAction={
                  <Button
                    variant="secondary"
                    onClick={() => setFilters({ ...filters, countries: [] })}
                  >
                    Clear country filter
                  </Button>
                }
              />
            )}
          </div>
        </div>

        {/* Bottom feature strip — mirrors the mockup's four "what you get"
            callouts (favourites, compare, personalised matches, expert
            guidance). Each pairs a soft pink icon with a 2-line blurb. */}
        <FeatureStrip />
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
   FEATURE STRIP — sits at the bottom of the search page. Four callouts
   that summarise what users can do (Save, Compare, Personalise, Get
   guidance). Soft pink icon backgrounds keep the row consistent with the
   rest of the redesigned page.
───────────────────────────────────────────────────────────────────────── */

const FEATURE_ITEMS: Array<{
  icon: React.ReactNode;
  title: string;
  body: string;
}> = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
    title: 'Save your favorites',
    body: 'Heart universities to build your shortlist.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="14" rx="1" />
        <rect x="14" y="7" width="7" height="14" rx="1" />
      </svg>
    ),
    title: 'Compare universities',
    body: 'Compare up to 4 universities side by side.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
        <line x1="9" y1="9" x2="9.01" y2="9" />
        <line x1="15" y1="9" x2="15.01" y2="9" />
      </svg>
    ),
    title: 'Personalized matches',
    body: 'Get recommendations based on your preferences.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    title: 'Expert guidance',
    body: 'Connect with mentors and make informed decisions.',
  },
];

function FeatureStrip() {
  return (
    <section className="mt-8 grid gap-5 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-[0_4px_14px_rgba(15,23,42,0.04)] sm:grid-cols-2 lg:grid-cols-4">
      {FEATURE_ITEMS.map((item) => (
        <div key={item.title} className="flex items-start gap-3">
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pink-50 text-pink-600"
          >
            {item.icon}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">{item.title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{item.body}</p>
          </div>
        </div>
      ))}
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   DETAIL VIEW — full university profile

   Layout (matches the mockup):
     1. Slim back/share/save bar
     2. Hero panel — campus image, logo crest, title, country chips,
        match + rank badges
     3. Tab strip — Overview / Programs / Admissions / Tuition / Student
        Life / Rankings / Reviews
     4. Two-column body
          left:  About + key-stat tiles, Top Programs gallery, Entry
                 Requirements, Campus & Location
          right: At-a-glance, Apply / Save CTAs, Why students choose,
                 Student reviews preview
     5. Bottom CTA banner
     6. Footer disclaimer

   Programs and reviews don't currently exist as structured data on the
   universities table, so we synthesise sensible content from the fields
   we *do* have (`best_for`, `strengths`, `specific_insight`). When a
   field genuinely isn't available we show a "—" or hide the surface
   rather than fabricate data — keeps the trust signal intact.
───────────────────────────────────────────────────────────────────────── */


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

function GlobeMiniIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
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

/**
 * Sync the active university id with the `?u=<id>` query string.
 *
 * Two-way sync:
 *   - When `setView('detail', id)` runs, push `?u=id` to the URL so
 *     `window.location.href` carries a real, shareable link to that
 *     university. Browsing back returns to a clean `/universities`.
 *   - When the URL changes externally (back/forward, paste-from-share,
 *     deep link), update the explorer state to match.
 *
 * `router.replace` with `scroll: false` keeps history clean and avoids
 * scrolling the page on every URL update.
 */
function useUniversityUrlSync() {
  const { activeView, selectedUniversityId, universities, setView } = useExplorer();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const lastWrittenRef = useRef<string | null>(null);

  // URL → state. If the URL says `?u=42` and we're not currently viewing
  // university 42, switch to it.
  useEffect(() => {
    const param = searchParams.get('u');
    if (param) {
      const id = parseInt(param, 10);
      if (Number.isFinite(id) && universities.some((u) => u.id === id)) {
        if (activeView !== 'detail' || selectedUniversityId !== id) {
          setView('detail', id);
        }
      }
    } else if (activeView === 'detail') {
      // No `u` param but we're showing a detail — back-button case. Reset
      // to browse.
      setView('browse');
    }
    // We intentionally only depend on the search params + universities so
    // we don't loop when state-→-URL writes happen below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, universities]);

  // State → URL. When the explorer enters/leaves detail view, push the
  // matching query string so `window.location.href` reflects it.
  useEffect(() => {
    const desired =
      activeView === 'detail' && selectedUniversityId != null
        ? `?u=${selectedUniversityId}`
        : '';
    if (desired === lastWrittenRef.current) return;
    lastWrittenRef.current = desired;
    router.replace(`${pathname}${desired}`, { scroll: false });
  }, [activeView, selectedUniversityId, pathname, router]);
}

function ExplorerContent() {
  const { activeView } = useExplorer();
  useUniversityUrlSync();

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
  admissionUnlocked: boolean;
  profileStrength: number | null;
  wikiPairs?: Array<[string, string]>;
}

export function UniversityExplorerClient({
  universities,
  initialShortlist,
  initialApplications,
  isLoggedIn,
  hasProfile,
  admissionUnlocked,
  profileStrength,
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
      admissionUnlocked={admissionUnlocked}
      profileStrength={profileStrength}
    >
      <Suspense fallback={null}>
        <ExplorerContent />
      </Suspense>
    </UniversityExplorerProvider>
  );
}
