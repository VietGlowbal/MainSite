'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AnimatePresence, motion, useScroll } from 'framer-motion';
import {
  UniversityExplorerProvider,
  useExplorer,
  filterUniversities,
  type ExplorerUniversity,
  type ApplicationEntry,
} from '@/lib/explorer-context';
import { FILTER_CATEGORIES } from '@/lib/university-data';
import { MatchBadge } from '@/components/match-badge';

const SearchWorldSelector = dynamic(
  () => import('@/app/onboarding/world-picker').then((mod) => mod.SearchWorldSelector),
  { ssr: false },
);

/* ─────────────────────────────────────────────────────────────────────────
   HERO
───────────────────────────────────────────────────────────────────────── */

function HeroSection() {
  return (
    <section className="px-6 pb-8 pt-10 md:pb-10 md:pt-14">
      <div className="mx-auto max-w-7xl">
        <div className="explorer-hero-shell overflow-hidden rounded-[2rem] border border-white/70 px-6 py-8 shadow-[0_24px_80px_rgba(10,18,38,0.10)] md:px-8 md:py-10 lg:px-10">
          <div className="explorer-hero-grid gap-8 lg:grid lg:grid-cols-[minmax(0,1.1fr)_320px] lg:items-center">
            <div className="relative z-10 max-w-3xl">
              <span className="glow-pill">University Explorer</span>
              <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-slate-950 md:text-5xl lg:text-6xl">
                Explore a more
                <span className="glowbal-wordmark block">global shortlist</span>
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 md:text-lg">
                Compare standout universities across the world, refine your orbit by country and subject, and build a premium shortlist around your goals.
              </p>

              <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-600">
                {[
                  'Globe-led country discovery',
                  'Editorial match cards',
                  'Shortlist and application tracking',
                ].map((item) => (
                  <span key={item} className="explorer-hero-chip">
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative mt-8 lg:mt-0">
              <div className="explorer-orbit-card mx-auto max-w-sm">
                <div className="explorer-orbit-glow" />
                <div className="relative rounded-[1.75rem] border border-white/12 bg-[linear-gradient(155deg,rgba(4,12,28,0.98),rgba(14,31,58,0.95))] p-5 text-white shadow-[0_24px_60px_rgba(4,12,28,0.35)]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-cyan-200/80">Signature view</p>
                      <p className="mt-1 text-lg font-semibold">Your study world map</p>
                    </div>
                    <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1 text-xs font-semibold text-white/80">
                      Live filters
                    </span>
                  </div>
                  <div className="relative mt-5 flex h-44 items-center justify-center overflow-hidden rounded-[1.5rem] border border-cyan-300/15 bg-[radial-gradient(circle_at_50%_50%,rgba(34,211,238,0.28),rgba(5,10,20,0.04)_42%,rgba(5,10,20,0)_66%)]">
                    <div className="explorer-orbit-ring explorer-orbit-ring-1" />
                    <div className="explorer-orbit-ring explorer-orbit-ring-2" />
                    <div className="explorer-orbit-ring explorer-orbit-ring-3" />
                    <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-cyan-200/35 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.4),rgba(56,189,248,0.2),rgba(8,47,73,0.96))] text-4xl shadow-[0_0_40px_rgba(34,211,238,0.18)]">
                      🌍
                    </div>
                    <span className="absolute left-7 top-7 rounded-full border border-pink-300/30 bg-pink-300/10 px-2.5 py-1 text-[0.68rem] font-semibold text-pink-100">UK</span>
                    <span className="absolute right-8 top-12 rounded-full border border-cyan-200/30 bg-cyan-300/10 px-2.5 py-1 text-[0.68rem] font-semibold text-cyan-100">Canada</span>
                    <span className="absolute bottom-8 left-12 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2.5 py-1 text-[0.68rem] font-semibold text-emerald-100">Singapore</span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3 text-center text-xs text-white/72">
                    <div className="rounded-2xl border border-white/10 bg-white/6 px-3 py-3">
                      <p className="text-lg font-semibold text-white">50+</p>
                      <p className="mt-1">global options</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/6 px-3 py-3">
                      <p className="text-lg font-semibold text-white">Smart</p>
                      <p className="mt-1">match layers</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/6 px-3 py-3">
                      <p className="text-lg font-semibold text-white">1 tap</p>
                      <p className="mt-1">save to shortlist</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function QuizBanner() {
  const router = useRouter();
  const { isLoggedIn, hasProfile } = useExplorer();

  if (isLoggedIn && hasProfile) return null;

  const title = isLoggedIn
    ? 'Complete the onboarding quiz to unlock personalised university matches.'
    : 'Search freely — then take the Glowbal quiz to find the universities that match you best.';

  const description = isLoggedIn
    ? 'You can browse everything now, but your match scores and tailored recommendations appear once your onboarding answers are filled in.'
    : 'No account needed to explore. When you are ready, the quiz helps us rank universities around your goals, budget, and preferred countries.';

  const actionLabel = isLoggedIn ? 'Finish onboarding' : 'Take the onboarding quiz';

  return (
    <div className="mx-auto max-w-6xl px-4 pb-6">
      <div className="rounded-[2rem] border border-pink-200 bg-[linear-gradient(135deg,rgba(255,77,140,0.10),rgba(0,180,216,0.08))] px-6 py-6 shadow-[0_16px_40px_rgba(22,33,62,0.08)] backdrop-blur sm:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-pink-600">Personalised matching</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">{title}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600 md:text-base">{description}</p>
          </div>

          <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => router.push('/onboarding')}
              className="rounded-full bg-[linear-gradient(135deg,#FF4D8C,#FF85B3)] px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(255,77,140,0.24)] transition hover:shadow-[0_14px_28px_rgba(255,77,140,0.28)]"
            >
              {actionLabel}
            </button>
            {!isLoggedIn && (
              <Link
                href="/auth"
                className="rounded-full border border-slate-200 bg-white/80 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-pink-200 hover:text-pink-600"
              >
                Sign up to save later
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   FILTER BAR
───────────────────────────────────────────────────────────────────────── */

function FilterBar() {
  const { activeFilter, setFilter, universities, selectedCountries, clearCountries } = useExplorer();
  const filteredCount = filterUniversities(universities, activeFilter, selectedCountries).length;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-5">
      <div className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/70 shadow-[0_16px_48px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        <div className="flex flex-col gap-4 px-5 py-5 md:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-slate-400">Refine your shortlist</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">Subjects, countries, and fit — all in one view</h2>
          </div>
          <div className="flex items-center gap-3 rounded-full border border-slate-200/80 bg-slate-50/80 px-4 py-2 text-sm text-slate-500">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
            <span>{filteredCount} {filteredCount === 1 ? 'university' : 'universities'} in orbit</span>
          </div>
        </div>

        <div className="border-t border-slate-100/90 px-5 py-4 md:px-6">
          <div className="flex flex-wrap gap-2.5">
            {FILTER_CATEGORIES.map((category) => {
              const isActive = activeFilter === category;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setFilter(category)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-[linear-gradient(135deg,#FF4D8C,#FF85B3)] text-white shadow-[0_8px_22px_rgba(255,77,140,0.24)]'
                      : 'border border-slate-200 bg-white text-slate-600 hover:border-cyan-200 hover:text-slate-900'
                  }`}
                >
                  {category}
                </button>
              );
            })}
          </div>

          {selectedCountries.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2.5 rounded-[1.5rem] border border-cyan-100 bg-cyan-50/70 px-4 py-3">
              <span className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-cyan-700">Country focus</span>
              {selectedCountries.map((country) => (
                <span key={country} className="rounded-full border border-cyan-200 bg-white/90 px-3 py-1 text-xs font-semibold text-cyan-700 shadow-sm">
                  {country}
                </span>
              ))}
              <button
                type="button"
                onClick={clearCountries}
                className="rounded-full border border-cyan-200 bg-white/90 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-pink-200 hover:text-pink-600"
              >
                Clear countries
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   UNIVERSITY CARD
───────────────────────────────────────────────────────────────────────── */

function UniversityCard({ university, index }: { university: ExplorerUniversity; index: number }) {
  const { isShortlisted, addToShortlist, showToast, setView, isLoggedIn } = useExplorer();
  const router = useRouter();
  const saved = isShortlisted(university.id);

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
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

  const acceptColor = university.accept_rate
    ? (() => {
        const num = parseInt(university.accept_rate.replace(/[^0-9]/g, ''), 10);
        if (isNaN(num)) return 'text-slate-400';
        if (num < 20) return 'text-emerald-600';
        if (num <= 40) return 'text-amber-600';
        return 'text-red-500';
      })()
    : 'text-slate-400';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.6), ease: 'easeOut' }}
      className="group relative flex flex-col overflow-hidden rounded-[1.75rem] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,255,0.94))] shadow-[0_18px_50px_rgba(15,23,42,0.08)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_24px_60px_rgba(15,23,42,0.14)]"
    >
      <button
        type="button"
        onClick={() => setView('detail', university.id)}
        className="relative flex h-44 w-full items-center justify-center overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${university.color} 0%, ${university.color}dd 100%)` }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.28),transparent_48%)]" />
        <div className="absolute inset-x-8 bottom-0 h-16 rounded-full bg-black/10 blur-2xl" />
        <span className="relative text-5xl drop-shadow-sm transition-transform duration-300 group-hover:scale-105" role="img" aria-label={university.name}>
          {university.emoji}
        </span>
        <span className="absolute left-3 top-3 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold text-white backdrop-blur-sm">
          {university.emoji} {university.location}
        </span>
        {university.rank && (
          <span className="absolute right-3 top-3 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold text-white backdrop-blur-sm">
            {university.rank}
          </span>
        )}
        {saved && (
          <span className="absolute left-3 bottom-3 rounded-full bg-emerald-500 px-2.5 py-0.5 text-xs font-bold text-white">
            Saved
          </span>
        )}
      </button>

      <div className="flex flex-1 flex-col gap-3 px-5 pb-5 pt-4">
        <button type="button" onClick={() => setView('detail', university.id)} className="text-left">
          <h3 className="text-lg font-semibold leading-snug tracking-tight text-slate-950 line-clamp-2">{university.name}</h3>
          <p className="mt-1 text-sm text-slate-500">{university.location}</p>
        </button>

        <MatchBadge percentage={university.match_score} breakdown={university.match_breakdown} />

        <div className="flex flex-wrap gap-2">
          {university.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[0.7rem] font-semibold text-slate-600">
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
          {university.accept_rate
            ? <span>Accept: <span className={`font-semibold ${acceptColor}`}>{university.accept_rate}</span></span>
            : <span />}
          {university.tuition_usd && <span className="truncate text-right">{university.tuition_usd}</span>}
        </div>

        <button
          type="button"
          onClick={handleSave}
          className={`mt-1 w-full rounded-full py-2.5 text-xs font-semibold transition-all md:opacity-0 md:group-hover:opacity-100 ${
            !isLoggedIn
              ? 'border border-pink-200 bg-pink-50 text-pink-600 hover:bg-pink-100 md:opacity-100'
              : saved
              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 md:opacity-100'
              : 'bg-[linear-gradient(135deg,#FF4D8C,#FF85B3)] text-white shadow-[0_4px_14px_rgba(255,77,140,0.25)] hover:shadow-[0_6px_18px_rgba(255,77,140,0.35)]'
          }`}
        >
          {!isLoggedIn ? 'Take quiz to unlock your matches →' : saved ? 'Saved — View in My Universities →' : '+ Save to My Universities'}
        </button>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   UNIVERSITY GRID
───────────────────────────────────────────────────────────────────────── */

function UniversityGrid() {
  const { activeFilter, universities, selectedCountries } = useExplorer();
  const filtered = filterUniversities(universities, activeFilter, selectedCountries);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16">
      <div className="grid gap-6 lg:grid-cols-[minmax(330px,390px)_minmax(0,1fr)] lg:items-start xl:gap-8">
        <div className="lg:pr-2">
          <SearchGlobeRail />
        </div>

        <div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((university, i) => (
              <UniversityCard key={university.id} university={university} index={i} />
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="mt-6 rounded-[2rem] border border-slate-200 bg-white/85 px-6 py-12 text-center shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur">
              <p className="text-lg font-semibold text-slate-900">No universities in this orbit yet.</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">Try clearing a country, switching the subject lens, or widening your world view to uncover more options.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SearchGlobeRail() {
  const { selectedCountries, toggleCountry, clearCountries, universities } = useExplorer();
  const availableCountryNames = Array.from(new Set(universities.map((university) => university.country))).sort((a, b) => a.localeCompare(b));

  return (
    <SearchWorldSelector
      selectedCountries={selectedCountries}
      onToggleCountry={toggleCountry}
      onClearCountries={clearCountries}
      availableCountryNames={availableCountryNames}
    />
  );
}

function BrowseView() {
  return (
    <>
      <HeroSection />
      <QuizBanner />
      <FilterBar />
      <UniversityGrid />
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   UNIVERSITY STICKY BAR (detail view)
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

/* ─────────────────────────────────────────────────────────────────────────
   DETAIL VIEW
───────────────────────────────────────────────────────────────────────── */

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
            <div className="flex h-48 items-center justify-center rounded-2xl md:h-56" style={{ backgroundColor: university.color }}>
              <span className="text-8xl drop-shadow" role="img" aria-label={university.name}>{university.emoji}</span>
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
   EXPLORER CONTENT + PROVIDER WRAPPER
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
