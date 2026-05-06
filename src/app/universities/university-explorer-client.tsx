'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useScroll } from 'framer-motion';
import {
  UniversityExplorerProvider,
  useExplorer,
  filterUniversities,
  type ExplorerUniversity,
  type ApplicationEntry,
} from '@/lib/explorer-context';
import { APPLICATION_STAGES, FILTER_CATEGORIES } from '@/lib/university-data';

/* ─────────────────────────────────────────────────────────────────────────
   TAB BAR
───────────────────────────────────────────────────────────────────────── */

function TabBar() {
  const { activeView, setView, shortlist } = useExplorer();

  const tabs = [
    { key: 'browse' as const, label: 'Browse' },
    { key: 'shortlist' as const, label: 'Shortlist', badge: shortlist.length },
    { key: 'applications' as const, label: 'My Applications' },
  ];

  return (
    <nav className="sticky top-0 z-20 border-b border-black/[.05] bg-white/80 backdrop-blur-xl">
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
              className={`relative rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                isActive
                  ? 'bg-pink-50 text-pink-600 border border-pink-200'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700 border border-transparent'
              }`}
            >
              {tab.label}
              {tab.badge != null && tab.badge > 0 && (
                <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ff4d8c] px-1.5 text-xs font-bold text-white">
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

/* ─────────────────────────────────────────────────────────────────────────
   HERO
───────────────────────────────────────────────────────────────────────── */

function HeroSection() {
  return (
    <section className="px-6 py-12 md:py-16">
      <div className="mx-auto max-w-6xl">
        <span className="glow-pill">University Explorer</span>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl">
          Find your{' '}
          <span className="glowbal-wordmark">perfect match</span>
        </h1>
        <p className="mt-3 max-w-xl text-base text-slate-500">
          Browse top universities worldwide, build your shortlist, and track every step of your application journey.
        </p>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   FILTER BAR
───────────────────────────────────────────────────────────────────────── */

function FilterBar() {
  const { activeFilter, setFilter, universities } = useExplorer();
  const filteredCount = filterUniversities(universities, activeFilter).length;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-4">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-black/[.05] bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
        {FILTER_CATEGORIES.map((category) => {
          const isActive = activeFilter === category;
          return (
            <button
              key={category}
              type="button"
              onClick={() => setFilter(category)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-all ${
                isActive
                  ? 'bg-[linear-gradient(135deg,#FF4D8C,#FF85B3)] text-white shadow-[0_4px_14px_rgba(255,77,140,0.3)]'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'
              }`}
            >
              {category}
            </button>
          );
        })}
        <span className="ml-auto text-sm text-slate-400">
          {filteredCount} {filteredCount === 1 ? 'university' : 'universities'}
        </span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   UNIVERSITY CARD
───────────────────────────────────────────────────────────────────────── */

function UniversityCard({ university, index }: { university: ExplorerUniversity; index: number }) {
  const { isShortlisted, setView } = useExplorer();
  const shortlisted = isShortlisted(university.id);

  return (
    <motion.button
      type="button"
      onClick={() => setView('detail', university.id)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.6), ease: 'easeOut' }}
      className="group glow-card flex flex-col gap-3 text-left p-0 overflow-hidden hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(22,33,62,0.12)] transition-all duration-300"
    >
      {/* Colour banner */}
      <div
        className="relative flex h-28 items-center justify-center"
        style={{ backgroundColor: university.color }}
      >
        <span className="text-5xl drop-shadow-sm" role="img" aria-label={university.name}>
          {university.emoji}
        </span>
        {university.rank && (
          <span className="absolute right-3 top-3 rounded-full bg-black/30 px-2.5 py-0.5 text-xs font-bold text-white backdrop-blur-sm">
            {university.rank}
          </span>
        )}
        {shortlisted && (
          <span className="absolute left-3 top-3 rounded-full bg-emerald-500 px-2.5 py-0.5 text-xs font-bold text-white">
            Shortlisted
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2.5 px-5 pb-5">
        <div>
          <h3 className="text-base font-semibold leading-snug text-slate-900">{university.name}</h3>
          <p className="mt-0.5 text-sm text-slate-400">{university.location}</p>
        </div>

        {university.match_score != null && (
          <p className="text-xs font-semibold text-pink-600">
            {university.match_score}% profile match
          </p>
        )}

        <div className="flex flex-wrap gap-1.5">
          {university.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-auto flex items-center justify-between pt-1 text-xs text-slate-400">
          {university.accept_rate ? (
            <span>Accept: <span className="font-semibold text-[#00b4d8]">{university.accept_rate}</span></span>
          ) : <span />}
          {university.tuition_usd && (
            <span className="truncate text-right">{university.tuition_usd}</span>
          )}
        </div>
      </div>
    </motion.button>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   UNIVERSITY GRID
───────────────────────────────────────────────────────────────────────── */

function UniversityGrid() {
  const { activeFilter, universities } = useExplorer();
  const filtered = filterUniversities(universities, activeFilter);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-12">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((university, i) => (
          <UniversityCard key={university.id} university={university} index={i} />
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

/* ─────────────────────────────────────────────────────────────────────────
   UNIVERSITY STICKY BAR (detail view)
───────────────────────────────────────────────────────────────────────── */

interface StickyBarProps {
  university: ExplorerUniversity;
  shortlisted: boolean;
  onShortlist: () => void;
  onBack: () => void;
}

function UniversityStickyBar({ university, shortlisted, onShortlist, onBack }: StickyBarProps) {
  const { scrollY } = useScroll();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    return scrollY.on('change', (y: number) => {
      setIsVisible(y > 260);
    });
  }, [scrollY]);

  return (
    <motion.div
      aria-hidden={!isVisible}
      initial={false}
      animate={{ y: isVisible ? 0 : -80, opacity: isVisible ? 1 : 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        pointerEvents: isVisible ? 'auto' : 'none',
      }}
    >
      <div style={{ margin: '10px auto', maxWidth: '72rem', padding: '0 1.5rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            borderRadius: '999px',
            border: '1px solid rgba(0,0,0,0.06)',
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 8px 24px rgba(22,33,62,0.1)',
            padding: '0.5rem 0.75rem 0.5rem 0.5rem',
          }}
        >
          {/* Back button */}
          <button
            type="button"
            onClick={onBack}
            style={{
              flexShrink: 0,
              borderRadius: '999px',
              border: '1px solid rgba(0,0,0,0.07)',
              background: 'rgba(255,255,255,0.9)',
              padding: '0.35rem 0.75rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: 'rgb(100 116 139)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            ← Browse
          </button>

          {/* Emoji badge */}
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: university.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.1rem',
              flexShrink: 0,
            }}
          >
            {university.emoji}
          </div>

          {/* Name + location */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'rgb(15 23 42)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {university.name}
            </p>
            <p style={{ margin: 0, fontSize: '0.72rem', color: 'rgb(100 116 139)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {university.location}{university.rank ? ` · ${university.rank}` : ''}
            </p>
          </div>

          {/* Match score */}
          {university.match_score != null && (
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#ff4d8c' }}>{university.match_score}%</p>
              <p style={{ margin: 0, fontSize: '0.65rem', color: 'rgb(148 163 184)' }}>Match</p>
            </div>
          )}

          {/* Shortlist button */}
          <button
            type="button"
            onClick={onShortlist}
            disabled={shortlisted}
            style={{
              flexShrink: 0,
              borderRadius: '999px',
              border: shortlisted ? '1px solid rgb(167 243 208)' : 'none',
              background: shortlisted
                ? 'rgb(240 253 244)'
                : 'linear-gradient(135deg, #ff4d8c, #ff85b3)',
              padding: '0.45rem 1rem',
              fontSize: '0.8rem',
              fontWeight: 700,
              color: shortlisted ? 'rgb(5 150 105)' : 'white',
              cursor: shortlisted ? 'default' : 'pointer',
              boxShadow: shortlisted ? 'none' : '0 4px 14px rgba(255,77,140,0.3)',
              whiteSpace: 'nowrap',
            }}
          >
            {shortlisted ? 'Shortlisted ✓' : '+ Shortlist'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   DETAIL VIEW
───────────────────────────────────────────────────────────────────────── */

function ShortlistSidebar({ university }: { university: ExplorerUniversity }) {
  const { addToShortlist, isShortlisted, showToast } = useExplorer();
  const shortlisted = isShortlisted(university.id);

  const stats = [
    { label: 'Acceptance Rate', value: university.accept_rate ?? '—' },
    { label: 'Rank', value: university.rank || '—' },
    { label: 'Tuition (USD)', value: university.tuition_usd ?? '—' },
    { label: 'Living Cost (USD)', value: university.living_cost_usd ?? '—' },
  ];

  return (
    <div className="sticky top-20 space-y-4 glow-card">
      <h3 className="text-lg font-semibold text-slate-900">{university.name}</h3>

      {university.match_score != null && (
        <p className="text-sm">
          <span className="font-bold text-pink-600">{university.match_score}%</span>
          <span className="text-slate-400"> profile match</span>
        </p>
      )}

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
        onClick={() => {
          if (!shortlisted) {
            addToShortlist(university.id);
            showToast(`${university.name} added to shortlist`);
          }
        }}
        disabled={shortlisted}
        className={`w-full rounded-full py-3 text-sm font-semibold transition-all ${
          shortlisted
            ? 'cursor-default bg-emerald-50 text-emerald-600 border border-emerald-200'
            : 'glow-button-primary'
        }`}
      >
        {shortlisted ? 'Shortlisted ✓' : 'Add to Shortlist'}
      </button>
    </div>
  );
}

function DetailView() {
  const { selectedUniversityId, setView, universities, addToShortlist, isShortlisted, showToast } = useExplorer();
  const university = universities.find((u) => u.id === selectedUniversityId);

  // Scroll to top whenever a university detail opens
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

  const shortlisted = isShortlisted(university.id);

  return (
    <>
      {/* Sticky bar — appears after scrolling past the banner */}
      <UniversityStickyBar
        university={university}
        shortlisted={shortlisted}
        onShortlist={() => {
          if (!shortlisted) {
            addToShortlist(university.id);
            showToast(`${university.name} added to shortlist`);
          }
        }}
        onBack={() => setView('browse')}
      />

      <div className="mx-auto max-w-6xl px-4 py-8">
        <button
          type="button"
          onClick={() => setView('browse')}
          className="glow-button-secondary mb-6 text-sm px-4 py-2"
        >
          ← Back to Browse
        </button>

      <div className="flex flex-col gap-8 md:flex-row">
        {/* Main */}
        <div className="flex-1 min-w-0 space-y-6">
          <div
            className="flex h-48 items-center justify-center rounded-2xl md:h-56"
            style={{ backgroundColor: university.color }}
          >
            <span className="text-8xl drop-shadow" role="img" aria-label={university.name}>
              {university.emoji}
            </span>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              {university.match_score != null && (
                <span className="glow-pill">{university.match_score}% match</span>
              )}
              {university.rank && (
                <span className="rounded-full bg-sky-50 border border-sky-200 px-3 py-0.5 text-xs font-semibold text-sky-600">
                  {university.rank}
                </span>
              )}
            </div>
            <h2 className="mt-3 text-2xl font-semibold text-slate-900 md:text-3xl">{university.name}</h2>
            <p className="mt-1 text-sm text-slate-400">{university.location}</p>
          </div>

          {university.description && (
            <p className="leading-7 text-slate-600">{university.description}</p>
          )}

          {/* Stats grid */}
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

          {/* Requirements */}
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

          {/* Additional info */}
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

        {/* Sidebar */}
        <aside className="w-full shrink-0 md:w-72 lg:w-80">
          <ShortlistSidebar university={university} />
        </aside>
      </div>
    </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   SHORTLIST VIEW
───────────────────────────────────────────────────────────────────────── */

function ShortlistView() {
  const { shortlist, removeFromShortlist, showToast, proceedToApplications, setView, universities } = useExplorer();

  const shortlistedUniversities = shortlist
    .map((id) => universities.find((u) => u.id === id))
    .filter((u): u is ExplorerUniversity => u != null);

  if (shortlistedUniversities.length === 0) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-center px-4 py-24 text-center">
        <span className="text-6xl" role="img" aria-label="Empty shortlist">📋</span>
        <h2 className="mt-6 text-2xl font-semibold text-slate-900">Your shortlist is empty</h2>
        <p className="mt-2 text-sm text-slate-400">Browse universities and add your favourites to get started.</p>
        <button
          type="button"
          onClick={() => setView('browse')}
          className="glow-button-primary mt-6 px-6 py-3 text-sm"
        >
          Browse Universities
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h2 className="mb-6 text-2xl font-semibold text-slate-900">Your Shortlist</h2>
      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="flex-1 space-y-3">
          {shortlistedUniversities.map((university) => (
            <div
              key={university.id}
              className="glow-card flex items-center gap-4 p-4"
            >
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: university.color }}
              >
                <span className="text-2xl" role="img" aria-label={university.name}>{university.emoji}</span>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-base font-semibold text-slate-900">{university.name}</h3>
                <p className="mt-0.5 text-sm text-slate-400">{university.location}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {university.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{tag}</span>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => { removeFromShortlist(university.id); showToast(`${university.name} removed`); }}
                className="glow-button-secondary h-9 w-9 p-0 text-slate-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50"
                aria-label={`Remove ${university.name}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <aside className="w-full shrink-0 lg:w-72">
          <div className="sticky top-20 glow-card space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">Summary</h3>
            <div className="profile-info-row">
              <span className="profile-info-label">Universities selected</span>
              <span className="text-2xl font-semibold text-slate-900">{shortlistedUniversities.length}</span>
            </div>
            <button
              type="button"
              onClick={() => proceedToApplications()}
              className="glow-button-primary w-full py-3 text-sm"
            >
              Proceed to Applications
            </button>
            <p className="text-center text-xs text-slate-400">
              All shortlisted universities will be moved to your applications tracker.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   APPLICATION TRACKER
───────────────────────────────────────────────────────────────────────── */

function ProgressTimeline({ currentStage }: { currentStage: number }) {
  return (
    <div className="flex w-full items-start justify-between">
      {APPLICATION_STAGES.map((stage, index) => {
        const isCompleted = index < currentStage;
        const isActive = index === currentStage;
        const isLast = index === APPLICATION_STAGES.length - 1;

        return (
          <div key={stage.label} className="flex flex-1 items-start">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-all ${
                  isCompleted
                    ? 'bg-emerald-500 text-white'
                    : isActive
                      ? 'bg-[linear-gradient(135deg,#FF4D8C,#FF85B3)] text-white shadow-[0_4px_14px_rgba(255,77,140,0.35)]'
                      : 'bg-slate-100 text-slate-400'
                }`}
              >
                {isCompleted ? '✓' : stage.icon}
              </div>
              <span
                className={`mt-2 text-center text-xs leading-tight ${
                  isCompleted ? 'text-emerald-600' : isActive ? 'text-pink-600 font-semibold' : 'text-slate-400'
                }`}
                style={{ maxWidth: '5rem' }}
              >
                {stage.label}
              </span>
            </div>
            {!isLast && (
              <div className="mt-4 flex flex-1 items-center px-1">
                <div className={`h-0.5 w-full rounded-full ${index < currentStage ? 'bg-emerald-400' : 'bg-slate-200'}`} />
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

  if (applications.length === 0) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-center px-4 py-24 text-center">
        <span className="text-6xl" role="img" aria-label="No applications">📭</span>
        <h2 className="mt-6 text-2xl font-semibold text-slate-900">No applications yet</h2>
        <p className="mt-2 text-sm text-slate-400">
          Browse universities, shortlist your favourites, and proceed to applications.
        </p>
        <button
          type="button"
          onClick={() => setView('browse')}
          className="glow-button-primary mt-6 px-6 py-3 text-sm"
        >
          Browse Universities
        </button>
      </div>
    );
  }

  const finalStageIndex = APPLICATION_STAGES.length - 1;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h2 className="mb-6 text-2xl font-semibold text-slate-900">My Applications</h2>
      <div className="space-y-5">
        {applications.map((app) => {
          const university = universities.find((u) => u.id === app.universityId);
          if (!university) return null;
          const isFinalStage = app.currentStage === finalStageIndex;
          const currentStageInfo = APPLICATION_STAGES[app.currentStage];

          return (
            <div key={app.universityId} className="glow-card overflow-hidden p-0">
              {isFinalStage && (
                <div className="border-b border-emerald-200 bg-emerald-50 px-6 py-3 text-center">
                  <span className="text-sm font-bold text-emerald-600">Congratulations! Offer Received 🎉</span>
                </div>
              )}
              <div className="p-6">
                <div className="mb-6 flex items-center gap-4">
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: university.color }}
                  >
                    <span className="text-2xl" role="img" aria-label={university.name}>{university.emoji}</span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-semibold text-slate-900">{university.name}</h3>
                    <p className="text-sm text-slate-400">{university.location}</p>
                  </div>
                </div>

                <ProgressTimeline currentStage={app.currentStage} />

                <p className="mt-4 text-sm text-slate-500">
                  <span className="mr-1.5">{currentStageInfo.icon}</span>
                  {currentStageInfo.description}
                </p>

                <div className="mt-5">
                  <button
                    type="button"
                    onClick={() => advanceApplication(app.universityId)}
                    disabled={isFinalStage}
                    className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-all ${
                      isFinalStage
                        ? 'cursor-not-allowed bg-slate-100 text-slate-400'
                        : 'glow-button-primary'
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
      <TabBar />
      <main>
        <AnimatePresence mode="wait">
          {activeView === 'browse' && (
            <motion.div key="browse" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              <BrowseView />
            </motion.div>
          )}
          {activeView === 'detail' && (
            <motion.div key="detail" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              <DetailView />
            </motion.div>
          )}
          {activeView === 'shortlist' && (
            <motion.div key="shortlist" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              <ShortlistView />
            </motion.div>
          )}
          {activeView === 'applications' && (
            <motion.div key="applications" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              <ApplicationTrackerView />
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
