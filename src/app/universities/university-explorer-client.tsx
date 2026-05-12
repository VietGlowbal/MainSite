'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
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
   FILTER BAR
───────────────────────────────────────────────────────────────────────── */

function FilterBar() {
  const { activeFilter, setFilter, universities, selectedCountries, clearCountries } = useExplorer();
  const filteredCount = filterUniversities(universities, activeFilter, selectedCountries).length;

  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white/88 px-5 py-4 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-slate-400">Refine results</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">Filter by what actually matters</h2>
          </div>
          <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-500">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
            <span>{filteredCount} {filteredCount === 1 ? 'university' : 'universities'} showing</span>
          </div>
        </div>

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
          <div className="flex flex-wrap items-center gap-2.5 rounded-[1.25rem] border border-cyan-100 bg-cyan-50/70 px-4 py-3">
            <span className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-cyan-700">Country focus</span>
            {selectedCountries.map((country) => (
              <span key={country} className="rounded-full border border-cyan-200 bg-white px-3 py-1 text-xs font-semibold text-cyan-700">
                {country}
              </span>
            ))}
            <button
              type="button"
              onClick={clearCountries}
              className="rounded-full border border-cyan-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-pink-200 hover:text-pink-600"
            >
              Clear countries
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   UNIVERSITY CARD
───────────────────────────────────────────────────────────────────────── */

function UniversityCard({ university, index }: { university: ExplorerUniversity; index: number }) {
  const { isShortlisted, addToShortlist, showToast, setView, isLoggedIn, setPreviewCountry } = useExplorer();
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
      className="group relative flex flex-col overflow-hidden rounded-[1.5rem] border border-white/80 bg-white shadow-[0_14px_36px_rgba(15,23,42,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_48px_rgba(15,23,42,0.12)]"
      onMouseEnter={() => setPreviewCountry(university.country)}
      onMouseLeave={() => setPreviewCountry(null)}
    >
      <button
        type="button"
        onClick={() => setView('detail', university.id)}
        className="relative flex h-48 w-full items-end justify-start overflow-hidden text-left"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={university.image_url}
          alt={university.name}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(180deg, rgba(15,23,42,0.08) 0%, ${university.color}90 72%, ${university.color}dd 100%)` }}
        />
        <span className="absolute left-3 top-3 rounded-full bg-white/82 px-2.5 py-1 text-[0.7rem] font-semibold text-slate-700 backdrop-blur-sm">
          {university.location}
        </span>
        {university.rank && (
          <span className="absolute right-3 top-3 rounded-full bg-slate-950/60 px-2.5 py-1 text-[0.7rem] font-semibold text-white backdrop-blur-sm">
            {university.rank}
          </span>
        )}
        <div className="relative z-10 w-full p-4 text-white">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold leading-tight tracking-tight">{university.name}</h3>
              <p className="mt-1 text-sm text-white/80">{university.emoji} {university.location}</p>
            </div>
            {saved && (
              <span className="rounded-full bg-emerald-500 px-2.5 py-1 text-[0.7rem] font-bold text-white">
                Saved
              </span>
            )}
          </div>
        </div>
      </button>

      <div className="flex flex-1 flex-col gap-3 px-5 pb-5 pt-4">
        <MatchBadge percentage={university.match_score} breakdown={university.match_breakdown} />

        {university.description && (
          <p className="text-sm leading-6 text-slate-600 line-clamp-3">{university.description}</p>
        )}

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
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 md:pt-8">
      <div className="pb-5 pt-2 md:pt-4">
        <FilterBar />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(420px,33vw)_minmax(0,1fr)] lg:items-start xl:gap-6">
        <div className="overflow-visible lg:self-start lg:h-[100svh] lg:min-h-[100svh]">
          <ExplorerRail />
        </div>

        <div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3">
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
  const { selectedCountries, toggleCountry, clearCountries, universities, previewCountry } = useExplorer();
  const availableCountryNames = Array.from(new Set(universities.map((university) => university.country))).sort((a, b) => a.localeCompare(b));

  return (
    <SearchWorldSelector
      selectedCountries={selectedCountries}
      onToggleCountry={toggleCountry}
      onClearCountries={clearCountries}
      availableCountryNames={availableCountryNames}
      previewCountry={previewCountry}
    />
  );
}

function ExplorerRail() {
  const railRef = useRef<HTMLDivElement>(null);
  const [railStyle, setRailStyle] = useState<CSSProperties | null>(null);

  useEffect(() => {
    function updateRailPosition() {
      const node = railRef.current;
      if (!node) return;

      if (window.innerWidth < 1024) {
        setRailStyle(null);
        return;
      }

      const rect = node.getBoundingClientRect();
      const top = 72;
      setRailStyle({
        position: 'fixed',
        left: `${rect.left}px`,
        top: `${top}px`,
        width: `${rect.width}px`,
        zIndex: 10,
        maxHeight: `calc(100vh - ${top + 16}px)`,
      });
    }

    updateRailPosition();
    window.addEventListener('resize', updateRailPosition);
    window.addEventListener('scroll', updateRailPosition, { passive: true });
    return () => {
      window.removeEventListener('resize', updateRailPosition);
      window.removeEventListener('scroll', updateRailPosition);
    };
  }, []);

  return (
    <div ref={railRef} className="relative h-full min-h-[70vh] lg:min-h-[100svh]">
      <div style={railStyle ?? undefined} className="flex h-full flex-col gap-4">
        <div className="min-h-[360px] flex-1 overflow-visible">
          <SearchGlobeRail />
        </div>
      </div>
    </div>
  );
}

function BrowseView() {
  return (
    <>
      <QuizStickyBar />
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
