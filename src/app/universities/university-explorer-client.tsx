'use client';

import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { AnimatePresence, motion } from 'framer-motion';
import {
  UniversityExplorerProvider,
  useExplorer,
  filterUniversities,
  type ExplorerUniversity,
  type ApplicationEntry,
} from '@/lib/explorer-context';
import { APPLICATION_STAGES, FILTER_CATEGORIES } from '@/lib/university-data';
import { LandingGlobe } from '@/components/landing-globe';

/* ── Placeholder view components (replaced in later tasks) ─────────── */

function TabBar() {
  const { activeView, setView, shortlist } = useExplorer();

  const tabs = [
    { key: 'browse' as const, label: 'Browse' },
    { key: 'shortlist' as const, label: 'Shortlist', badge: shortlist.length },
    { key: 'applications' as const, label: 'My Applications' },
  ];

  return (
    <nav className="sticky top-0 z-20 border-b border-white/[.07] bg-white/[.04] backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center gap-1 px-4 py-3">
        {tabs.map((tab) => {
          const isActive =
            activeView === tab.key ||
            (tab.key === 'browse' && activeView === 'detail');

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setView(tab.key)}
              className={`relative rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[#00b4d8]/15 text-[#00b4d8]'
                  : 'text-white/50 hover:bg-white/[.06] hover:text-white/80'
              }`}
            >
              {tab.label}
              {tab.badge != null && tab.badge > 0 && (
                <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#00b4d8] px-1.5 text-xs font-bold text-white">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function HeroSection() {
  return (
    <section className="relative flex items-center justify-center overflow-hidden px-6 py-16 md:py-24">
      {/* Radial glow behind globe */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 70% at 50% 50%,rgba(0,150,210,.07),transparent)',
        }}
      />

      {/* Globe behind text */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.3 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <LandingGlobe theme="cosmos" size={500} rotateSpeed={0.4} />
      </motion.div>

      {/* Text content */}
      <div className="relative z-10 max-w-3xl text-center">
        <h1 className="text-4xl font-black uppercase tracking-tight text-white md:text-6xl lg:text-7xl">
          Discover Your{' '}
          <span
            style={{
              background: 'linear-gradient(90deg,#ff4d8c,#00b4d8)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            University
          </span>
        </h1>
        <p className="mt-4 text-lg text-white/60 md:text-xl">
          Browse top universities, build your shortlist, and track your
          application journey
        </p>
      </div>
    </section>
  );
}

function FilterBar() {
  const { activeFilter, setFilter, universities } = useExplorer();
  const filteredCount = filterUniversities(universities, activeFilter).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[.07] bg-white/[.04] px-4 py-3 backdrop-blur-xl">
        {FILTER_CATEGORIES.map((category) => {
          const isActive = activeFilter === category;
          return (
            <button
              key={category}
              type="button"
              onClick={() => setFilter(category)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[#00b4d8] text-white shadow-[0_0_12px_rgba(0,180,216,.35)]'
                  : 'bg-white/[.06] text-white/50 hover:bg-white/[.1] hover:text-white/80'
              }`}
            >
              {category}
            </button>
          );
        })}

        <span className="ml-auto text-sm text-white/40">
          {filteredCount} {filteredCount === 1 ? 'university' : 'universities'}
        </span>
      </div>
    </div>
  );
}

function UniversityCard({ university }: { university: ExplorerUniversity }) {
  const { isShortlisted, setView } = useExplorer();
  const shortlisted = isShortlisted(university.id);

  return (
    <button
      type="button"
      onClick={() => setView('detail', university.id)}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/[.07] bg-white/[.04] text-left backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(0,180,216,.15)]"
    >
      {/* Emoji banner */}
      <div
        className="relative flex h-36 items-center justify-center"
        style={{ backgroundColor: university.color }}
      >
        <span className="text-6xl" role="img" aria-label={university.name}>
          {university.emoji}
        </span>

        {/* Rank badge — top-right */}
        <span className="absolute right-3 top-3 rounded-full bg-black/40 px-2.5 py-0.5 text-xs font-bold text-white backdrop-blur-sm">
          {university.rank}
        </span>

        {/* Shortlisted badge — top-left */}
        <AnimatePresence>
          {shortlisted && (
            <motion.span
              key="shortlisted-badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              className="absolute left-3 top-3 rounded-full bg-emerald-500/90 px-2.5 py-0.5 text-xs font-bold text-white backdrop-blur-sm"
            >
              Shortlisted
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Card body */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* Name & location */}
        <div>
          <h3 className="text-base font-semibold leading-tight text-white">
            {university.name}
          </h3>
          <p className="mt-0.5 text-sm text-white/50">{university.location}</p>
        </div>

        {/* Match score or rating */}
        <div className="flex items-center gap-2 text-sm">
          {university.match_score != null ? (
            <span className="text-[#ff4d8c] font-semibold">{university.match_score}% match</span>
          ) : (
            <span className="text-amber-400">QS {university.rank || '—'}</span>
          )}
        </div>

        {/* Tag chips */}
        <div className="flex flex-wrap gap-1.5">
          {university.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-white/[.08] px-2.5 py-0.5 text-xs text-white/60"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Acceptance rate + match score */}
        <div className="mt-auto pt-2 flex items-center justify-between text-sm text-white/50">
          <span>
            {university.accept_rate ? (
              <>Accept: <span className="font-medium text-[#00b4d8]">{university.accept_rate}</span></>
            ) : null}
          </span>
          {university.match_score != null && (
            <span className="rounded-full bg-[#ff4d8c]/20 px-2.5 py-0.5 text-xs font-bold text-[#ff4d8c]">
              {university.match_score}% match
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function UniversityGrid() {
  const { activeFilter, universities } = useExplorer();
  const filtered = filterUniversities(universities, activeFilter);
  const gridRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const cards = gridRef.current?.children;
    if (!cards || cards.length === 0) return;

    gsap.from(cards, {
      opacity: 0,
      y: 40,
      duration: 0.6,
      stagger: 0.08,
      ease: 'power3.out',
    });
  }, { scope: gridRef, dependencies: [activeFilter] });

  return (
    <div className="mx-auto max-w-6xl px-4 pb-8">
      <div
        ref={gridRef}
        className="grid grid-cols-1 gap-6 md:[grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]"
      >
        {filtered.map((university) => (
          <UniversityCard key={university.id} university={university} />
        ))}
      </div>
    </div>
  );
}

function BrowseView() {
  return (
    <>
      <HeroSection />
      <FilterBar />
      <UniversityGrid />
    </>
  );
}

function StarRating({ stars, max = 5 }: { stars: number; max?: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${stars} out of ${max} stars`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < stars ? 'text-amber-400' : 'text-white/20'}>
          ★
        </span>
      ))}
    </span>
  );
}

function ShortlistSidebar({ university }: { university: ExplorerUniversity }) {
  const { addToShortlist, isShortlisted, showToast } = useExplorer();
  const shortlisted = isShortlisted(university.id);

  const handleAddToShortlist = () => {
    if (!shortlisted) {
      addToShortlist(university.id);
      showToast(`${university.name} added to shortlist`);
    }
  };

  const stats = [
    { label: 'Acceptance Rate', value: university.accept_rate ?? '—' },
    { label: 'Rank', value: university.rank || '—' },
    { label: 'Tuition', value: university.tuition_usd ? `$${university.tuition_usd}` : '—' },
  ];

  return (
    <div className="sticky top-20 space-y-5 rounded-2xl border border-white/[.07] bg-white/[.04] p-6 backdrop-blur">
      {/* University name + match */}
      <h3 className="text-lg font-semibold text-white">{university.name}</h3>
      {university.match_score != null && (
        <p className="text-sm">
          <span className="font-bold text-[#ff4d8c]">{university.match_score}%</span>
          <span className="text-white/40"> profile match</span>
        </p>
      )}

      {/* Key stats */}
      <div className="space-y-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex items-center justify-between rounded-lg border border-white/[.07] bg-white/[.03] px-3 py-2"
          >
            <span className="text-xs text-white/40">{stat.label}</span>
            <span className="text-sm font-medium text-white">{stat.value}</span>
          </div>
        ))}
      </div>

      {/* Add to Shortlist / Shortlisted button */}
      <button
        type="button"
        onClick={handleAddToShortlist}
        disabled={shortlisted}
        className={`w-full rounded-xl py-3 text-sm font-semibold transition-all ${
          shortlisted
            ? 'cursor-default bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            : 'bg-[#00b4d8] text-white shadow-[0_0_16px_rgba(0,180,216,.3)] hover:shadow-[0_0_24px_rgba(0,180,216,.45)] hover:brightness-110'
        }`}
      >
        {shortlisted ? 'Shortlisted ✓' : 'Add to Shortlist'}
      </button>

      {/* Save for Later secondary button */}
      <button
        type="button"
        className="w-full rounded-xl border border-white/[.1] bg-transparent py-3 text-sm font-medium text-white/50 transition-colors hover:bg-white/[.06] hover:text-white/80"
      >
        Save for Later
      </button>
    </div>
  );
}

function DetailView() {
  const { selectedUniversityId, setView, universities } = useExplorer();

  const university = universities.find((u) => u.id === selectedUniversityId);

  if (!university) {
    return (
      <div className="p-8 text-center text-white/40">
        University not found.{' '}
        <button
          type="button"
          onClick={() => setView('browse')}
          className="text-[#00b4d8] underline underline-offset-2 hover:text-[#00b4d8]/80"
        >
          Back to Browse
        </button>
      </div>
    );
  }

  const statItems = [
    { label: 'Tuition (USD)', value: university.tuition_usd ? `$${university.tuition_usd}` : '—', icon: '💰' },
    { label: 'Living Cost (USD)', value: university.living_cost_usd ? `$${university.living_cost_usd}` : '—', icon: '🏠' },
    { label: 'Acceptance Rate', value: university.accept_rate ?? '—', icon: '📈' },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Back to Browse */}
      <button
        type="button"
        onClick={() => setView('browse')}
        className="mb-6 inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-white/50 transition-colors hover:bg-white/[.06] hover:text-white/80"
      >
        <span aria-hidden>←</span> Back to Browse
      </button>

      {/* Two-column layout: main + sidebar */}
      <div className="flex flex-col gap-8 md:flex-row">
        {/* ── Main content ──────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          {/* Large emoji banner */}
          <div
            className="flex h-48 items-center justify-center rounded-2xl md:h-56"
            style={{ backgroundColor: university.color }}
          >
            <span className="text-8xl" role="img" aria-label={university.name}>
              {university.emoji}
            </span>
          </div>

          {/* Name, location, rating */}
          <div className="mt-6">
            <h2 className="text-2xl font-bold text-white md:text-3xl">
              {university.name}
            </h2>
            <p className="mt-1 text-sm text-white/50">{university.location}</p>
            <div className="mt-2 flex items-center gap-3 text-sm">
              {university.match_score != null && (
                <span className="rounded-full bg-[#ff4d8c]/20 px-3 py-1 text-sm font-bold text-[#ff4d8c]">
                  {university.match_score}% match
                </span>
              )}
              {university.rank && (
                <span className="text-[#00b4d8]">{university.rank}</span>
              )}
            </div>
          </div>

          {/* Full description */}
          <p className="mt-6 leading-7 text-white/60">{university.description}</p>

          {/* Stats grid */}
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {statItems.map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-white/[.07] bg-white/[.04] p-4 backdrop-blur"
              >
                <span className="text-2xl">{stat.icon}</span>
                <p className="mt-2 text-lg font-semibold text-white">{stat.value}</p>
                <p className="text-xs text-white/40">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Entry requirements */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-white">Entry Requirements</h3>
            <ul className="mt-4 space-y-2">
              {university.requirements.map((req) => (
                <li
                  key={req}
                  className="flex items-start gap-3 rounded-lg border border-white/[.07] bg-white/[.04] px-4 py-3 text-sm text-white/70 backdrop-blur"
                >
                  <span className="mt-0.5 text-[#00b4d8]" aria-hidden>✓</span>
                  {req}
                </li>
              ))}
            </ul>
          </div>

          {/* Alumni reviews */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-white">Alumni Reviews</h3>
            <div className="mt-4 space-y-4">
              {university.reviewsData.map((review) => (
                <div
                  key={review.name}
                  className="rounded-xl border border-white/[.07] bg-white/[.04] p-5 backdrop-blur"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-white">{review.name}</span>
                    <StarRating stars={review.stars} />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/60">
                    {review.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Sidebar ── */}
        <aside className="w-full shrink-0 md:w-72 lg:w-80">
          <ShortlistSidebar university={university} />
        </aside>
      </div>
    </div>
  );
}

function ShortlistView() {
  const { shortlist, removeFromShortlist, showToast, proceedToApplications, setView, universities } =
    useExplorer();

  // Look up full university objects from shortlist IDs
  const shortlistedUniversities = shortlist
    .map((id) => universities.find((u) => u.id === id))
    .filter((u): u is ExplorerUniversity => u != null);

  // ── Empty state ──
  if (shortlistedUniversities.length === 0) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-center px-4 py-24 text-center">
        <span className="text-7xl" role="img" aria-label="Empty shortlist">
          📋
        </span>
        <h2 className="mt-6 text-2xl font-bold text-white">
          Your shortlist is empty
        </h2>
        <p className="mt-2 text-sm text-white/50">
          Browse universities and add your favourites to get started.
        </p>
        <button
          type="button"
          onClick={() => setView('browse')}
          className="mt-6 rounded-xl bg-[#00b4d8] px-6 py-3 text-sm font-semibold text-white shadow-[0_0_16px_rgba(0,180,216,.3)] transition-all hover:shadow-[0_0_24px_rgba(0,180,216,.45)] hover:brightness-110"
        >
          Browse Universities
        </button>
      </div>
    );
  }

  // ── Populated state ──
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h2 className="mb-6 text-2xl font-bold text-white">Your Shortlist</h2>

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* ── University list ── */}
        <div className="flex-1 space-y-4">
          {shortlistedUniversities.map((university) => (
            <div
              key={university.id}
              className="flex items-center gap-4 rounded-2xl border border-white/[.07] bg-white/[.04] p-4 backdrop-blur transition-colors hover:bg-white/[.06]"
            >
              {/* Emoji */}
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: university.color }}
              >
                <span className="text-2xl" role="img" aria-label={university.name}>
                  {university.emoji}
                </span>
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-base font-semibold text-white">
                  {university.name}
                </h3>
                <p className="mt-0.5 text-sm text-white/50">
                  {university.location}
                </p>
                {/* Tag chips */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {university.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-white/[.08] px-2.5 py-0.5 text-xs text-white/60"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Remove button */}
              <button
                type="button"
                onClick={() => {
                  removeFromShortlist(university.id);
                  showToast(`${university.name} removed from shortlist`);
                }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[.07] bg-white/[.04] text-white/40 transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
                aria-label={`Remove ${university.name} from shortlist`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {/* ── Order summary panel ── */}
        <aside className="w-full shrink-0 lg:w-72 xl:w-80">
          <div className="sticky top-20 space-y-5 rounded-2xl border border-white/[.07] bg-white/[.04] p-6 backdrop-blur">
            <h3 className="text-lg font-semibold text-white">Order Summary</h3>

            <div className="flex items-center justify-between rounded-lg border border-white/[.07] bg-white/[.03] px-4 py-3">
              <span className="text-sm text-white/50">Universities</span>
              <span className="text-lg font-bold text-white">
                {shortlistedUniversities.length}
              </span>
            </div>

            <button
              type="button"
              onClick={() => proceedToApplications()}
              className="w-full rounded-xl bg-[#00b4d8] py-3 text-sm font-semibold text-white shadow-[0_0_16px_rgba(0,180,216,.3)] transition-all hover:shadow-[0_0_24px_rgba(0,180,216,.45)] hover:brightness-110"
            >
              Proceed to Applications
            </button>

            <p className="text-center text-xs text-white/30">
              All shortlisted universities will be submitted as applications.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ProgressTimeline({ currentStage }: { currentStage: number }) {
  return (
    <div className="flex w-full items-start justify-between">
      {APPLICATION_STAGES.map((stage, index) => {
        const isCompleted = index < currentStage;
        const isActive = index === currentStage;
        const isLast = index === APPLICATION_STAGES.length - 1;

        return (
          <div key={stage.label} className="flex flex-1 items-start">
            {/* Step column: dot + label */}
            <div className="flex flex-col items-center">
              {/* Dot indicator */}
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-all ${
                  isCompleted
                    ? 'bg-emerald-500 text-white'
                    : isActive
                      ? 'bg-[#00b4d8] text-white'
                      : 'bg-white/20 text-white/30'
                }`}
                style={
                  isActive
                    ? { boxShadow: '0 0 16px rgba(0,180,216,.5), 0 0 32px rgba(0,180,216,.25)' }
                    : undefined
                }
              >
                {isCompleted ? '✓' : stage.icon}
              </div>

              {/* Label below dot */}
              <span
                className={`mt-2 text-center leading-tight ${
                  isCompleted
                    ? 'text-emerald-400'
                    : isActive
                      ? 'text-[#00b4d8]'
                      : 'text-white/30'
                } text-xs md:text-sm`}
                style={{ maxWidth: '5rem' }}
              >
                {stage.label}
              </span>
            </div>

            {/* Connecting line to next step */}
            {!isLast && (
              <div className="mt-4 flex flex-1 items-center px-1">
                <div
                  className={`h-0.5 w-full rounded-full ${
                    index < currentStage ? 'bg-emerald-500' : 'bg-white/10'
                  }`}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ApplicationTrackerView() {
  const { applications, advanceApplication, setView, universities } = useExplorer();

  // ── Empty state ──
  if (applications.length === 0) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-center px-4 py-24 text-center">
        <span className="text-7xl" role="img" aria-label="No applications">
          📭
        </span>
        <h2 className="mt-6 text-2xl font-bold text-white">
          No applications yet
        </h2>
        <p className="mt-2 text-sm text-white/50">
          Browse universities, shortlist your favourites, and proceed to
          applications to get started.
        </p>
        <button
          type="button"
          onClick={() => setView('browse')}
          className="mt-6 rounded-xl bg-[#00b4d8] px-6 py-3 text-sm font-semibold text-white shadow-[0_0_16px_rgba(0,180,216,.3)] transition-all hover:shadow-[0_0_24px_rgba(0,180,216,.45)] hover:brightness-110"
        >
          Browse Universities
        </button>
      </div>
    );
  }

  const finalStageIndex = APPLICATION_STAGES.length - 1;

  // ── Populated state ──
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h2 className="mb-6 text-2xl font-bold text-white">My Applications</h2>

      <div className="space-y-6">
        {applications.map((app) => {
          const university = universities.find(
            (u) => u.id === app.universityId,
          );
          if (!university) return null;

          const isFinalStage = app.currentStage === finalStageIndex;
          const currentStageInfo = APPLICATION_STAGES[app.currentStage];

          return (
            <div
              key={app.universityId}
              className="overflow-hidden rounded-2xl border border-white/[.07] bg-white/[.04] backdrop-blur"
            >
              {/* Celebratory banner for final stage */}
              {isFinalStage && (
                <div className="border-b border-emerald-500/20 bg-gradient-to-r from-emerald-500/20 via-emerald-400/10 to-emerald-500/20 px-6 py-3 text-center">
                  <span className="text-base font-bold text-emerald-400">
                    Congratulations! Offer Received 🎉
                  </span>
                </div>
              )}

              <div className="p-6">
                {/* University header: emoji, name, location */}
                <div className="mb-6 flex items-center gap-4">
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: university.color }}
                  >
                    <span
                      className="text-2xl"
                      role="img"
                      aria-label={university.name}
                    >
                      {university.emoji}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-semibold text-white">
                      {university.name}
                    </h3>
                    <p className="text-sm text-white/50">
                      {university.location}
                    </p>
                  </div>
                </div>

                {/* Progress Timeline */}
                <ProgressTimeline currentStage={app.currentStage} />

                {/* Status message */}
                <p className="mt-4 text-sm text-white/50">
                  <span className="mr-1.5">{currentStageInfo.icon}</span>
                  {currentStageInfo.description}
                </p>

                {/* Advance Stage button */}
                <div className="mt-5">
                  <button
                    type="button"
                    onClick={() => advanceApplication(app.universityId)}
                    disabled={isFinalStage}
                    className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${
                      isFinalStage
                        ? 'cursor-not-allowed border border-white/[.07] bg-white/[.04] text-white/30'
                        : 'bg-[#00b4d8] text-white shadow-[0_0_16px_rgba(0,180,216,.3)] hover:shadow-[0_0_24px_rgba(0,180,216,.45)] hover:brightness-110'
                    }`}
                  >
                    {isFinalStage ? 'Application Complete' : 'Advance Stage'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ToastNotification() {
  const { toast } = useExplorer();

  if (!toast || !toast.visible) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-50 max-w-sm rounded-lg border-l-4 border-[#00b4d8] bg-[#0a1628] px-5 py-4 shadow-[0_8px_32px_rgba(0,0,0,.5)] animate-[slideUp_0.3s_ease-out]"
      role="status"
      aria-live="polite"
    >
      <p className="text-sm font-medium text-white">{toast.message}</p>

      {/* Inline keyframes for slide-up animation */}
      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(100%);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

/* ── Inner content (consumes context) ──────────────────────────────── */

function ExplorerContent() {
  const { activeView } = useExplorer();

  return (
    <div
      className="relative min-h-screen pb-20 sm:pb-0"
      style={{
        background:
          'linear-gradient(180deg,#040b17 0%,#061325 55%,#091c36 100%)',
      }}
    >
      {/* Tiled star field via repeating radial gradients */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(1px 1px at 18% 28%,rgba(255,255,255,.88),transparent),' +
            'radial-gradient(1.5px 1.5px at 58% 14%,rgba(255,255,255,.7),transparent),' +
            'radial-gradient(1px 1px at 82% 62%,rgba(255,255,255,.8),transparent),' +
            'radial-gradient(1px 1px at 38% 82%,rgba(186,230,253,.75),transparent),' +
            'radial-gradient(2px 2px at 8% 72%,rgba(186,230,253,.6),transparent),' +
            'radial-gradient(1px 1px at 92% 38%,rgba(255,255,255,.65),transparent),' +
            'radial-gradient(1px 1px at 52% 92%,rgba(255,255,255,.5),transparent),' +
            'radial-gradient(1.5px 1.5px at 28% 52%,rgba(255,255,255,.55),transparent)',
          backgroundSize:
            '210px 210px,260px 270px,310px 190px,165px 230px,285px 305px,195px 215px,255px 245px,175px 195px',
        }}
      />

      {/* Tab navigation */}
      <TabBar />

      {/* Active view */}
      <main className="relative z-10">
        <AnimatePresence mode="wait">
          {activeView === 'browse' && (
            <motion.div
              key="browse"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              <BrowseView />
            </motion.div>
          )}
          {activeView === 'detail' && (
            <motion.div
              key="detail"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              <DetailView />
            </motion.div>
          )}
          {activeView === 'shortlist' && (
            <motion.div
              key="shortlist"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              <ShortlistView />
            </motion.div>
          )}
          {activeView === 'applications' && (
            <motion.div
              key="applications"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              <ApplicationTrackerView />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Toast notifications */}
      <ToastNotification />
    </div>
  );
}

/* ── Exported client component ─────────────────────────────────────── */

interface ExplorerClientProps {
  universities: ExplorerUniversity[];
  initialShortlist: number[];
  initialApplications: ApplicationEntry[];
  isLoggedIn: boolean;
}

export function UniversityExplorerClient({
  universities,
  initialShortlist,
  initialApplications,
  isLoggedIn,
}: ExplorerClientProps) {
  return (
    <UniversityExplorerProvider
      initialUniversities={universities}
      initialShortlist={initialShortlist}
      initialApplications={initialApplications}
      isLoggedIn={isLoggedIn}
    >
      <ExplorerContent />
    </UniversityExplorerProvider>
  );
}
