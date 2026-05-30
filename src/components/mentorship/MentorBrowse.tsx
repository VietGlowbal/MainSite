'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { MentorWithUniversity, MentorBrowseFilters } from '@/types/mentorship';
import { MentorCard } from './MentorCard';
import { CalendarIcon, MapPinIcon, SearchIcon } from './mentor-icons';

const POPULAR_TOPICS = [
  'Personal statement',
  'Interview prep',
  'Visa & accommodation',
  'Scholarship strategy',
  'Course choice',
  'Career advice',
  'Studying abroad',
  'Course choice',
];

const DEFAULT_LANGUAGES = [
  'English',
  'Vietnamese',
  'Mandarin',
  'Spanish',
  'French',
  'German',
  'Japanese',
  'Korean',
  'Arabic',
  'Portuguese',
];

type Props = {
  mentors: MentorWithUniversity[];
  initialUniversityId?: number;
  initialSlotsByMentor: Record<string, string[]>; // mentorId → ISO date strings (YYYY-MM-DD) of open slots
};

/**
 * The mentorship hub home — search hero + filters + mentor grid.
 *
 * The "How to meet your mentor" stepper from the Canva mock translates into
 * a 3-step orientation card that doubles as a search summary. As the user
 * fills in fields they tick green and the result count updates live.
 */
export function MentorBrowse({ mentors, initialUniversityId, initialSlotsByMentor }: Props) {
  const [filters, setFilters] = useState<MentorBrowseFilters>({
    university_id: initialUniversityId,
  });
  const [showAllFilters, setShowAllFilters] = useState(false);

  const allCountries = useMemo(() => {
    const set = new Set<string>();
    mentors.forEach((m) => m.university?.country && set.add(m.university.country));
    return Array.from(set).sort();
  }, [mentors]);

  const allUniversities = useMemo(() => {
    const map = new Map<number, { id: number; name: string; country: string }>();
    mentors.forEach((m) => m.university && map.set(m.university.id, m.university));
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [mentors]);

  const allLanguages = useMemo(() => {
    const set = new Set<string>(DEFAULT_LANGUAGES);
    mentors.forEach((m) => m.languages.forEach((l) => set.add(l)));
    return Array.from(set).sort();
  }, [mentors]);

  // Filtering — runs entirely client-side for the live "Showing X mentors" UX.
  const results = useMemo(() => {
    let r = [...mentors];
    if (filters.query) {
      const q = filters.query.toLowerCase();
      r = r.filter(
        (m) =>
          m.display_name.toLowerCase().includes(q) ||
          m.subject.toLowerCase().includes(q) ||
          m.university?.name.toLowerCase().includes(q) ||
          m.university?.country.toLowerCase().includes(q) ||
          m.help_topics.some((t) => t.toLowerCase().includes(q)) ||
          (m.strengths ?? []).some((s) => s.toLowerCase().includes(q)),
      );
    }
    if (filters.country) {
      r = r.filter((m) => m.university?.country === filters.country);
    }
    if (filters.university_id) {
      r = r.filter((m) => m.university_id === filters.university_id);
    }
    if (filters.languages && filters.languages.length > 0) {
      r = r.filter((m) => filters.languages!.some((l) => m.languages.includes(l)));
    }
    if (filters.currently_enrolled !== undefined) {
      r = r.filter((m) => m.currently_enrolled === filters.currently_enrolled);
    }
    if (filters.available_from) {
      r = r.filter((m) => {
        const slots = initialSlotsByMentor[m.id] ?? [];
        return slots.some((iso) => iso >= filters.available_from!);
      });
    }

    switch (filters.sort) {
      case 'newest':
        r.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'price_asc':
        r.sort((a, b) => Number(a.hourly_rate_amount ?? 0) - Number(b.hourly_rate_amount ?? 0));
        break;
      case 'price_desc':
        r.sort((a, b) => Number(b.hourly_rate_amount ?? 0) - Number(a.hourly_rate_amount ?? 0));
        break;
      default:
        r.sort((a, b) => {
          const diff = Number(b.avg_rating) - Number(a.avg_rating);
          if (diff !== 0) return diff;
          return b.total_sessions - a.total_sessions;
        });
    }
    return r;
  }, [mentors, filters, initialSlotsByMentor]);

  const stepStatus = {
    location: !!(filters.country || filters.university_id),
    time: !!filters.available_from,
    mentor: results.length > 0,
  };

  return (
    <div className="space-y-6">
      {/* HERO — search bar + steps */}
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-200/60 bg-gradient-to-br from-white via-pink-50/30 to-purple-50/20 px-6 py-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)] backdrop-blur md:px-10 md:py-10">
        <span
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full opacity-40 blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(255,77,140,0.25), transparent 70%)' }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full opacity-30 blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.2), transparent 70%)' }}
        />

        <div className="relative space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-2xl">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl lg:text-[2.75rem] lg:leading-tight">
                Find the right mentor for your journey
              </h1>
              <p className="mt-3 text-base leading-relaxed text-slate-600 md:text-lg">
                Connect with current students and recent graduates from top universities
              </p>
            </div>
            <Link
              href="/mentors/apply"
              className="inline-flex shrink-0 items-center gap-2 self-start rounded-full border-2 border-pink-500 bg-white px-5 py-2.5 text-sm font-semibold text-pink-600 shadow-sm transition hover:bg-pink-50 hover:shadow-md sm:self-start"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Become a mentor
            </Link>
          </div>

          {/* Search inputs */}
          <div className="grid gap-3 md:grid-cols-[2fr_1.2fr_1.2fr_auto]">
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <SearchIcon size={18} />
              </span>
              <input
                type="text"
                placeholder="Search by mentor name, university or topic"
                value={filters.query ?? ''}
                onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value || undefined }))}
                className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-sm text-slate-700 placeholder:text-slate-400 shadow-sm transition focus:border-pink-400 focus:outline-none focus:ring-4 focus:ring-pink-100"
              />
            </div>

            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <MapPinIcon size={18} />
              </span>
              <select
                value={filters.country ?? ''}
                onChange={(e) => setFilters((f) => ({ ...f, country: e.target.value || undefined }))}
                className="h-12 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-12 pr-10 text-sm text-slate-700 shadow-sm transition focus:border-pink-400 focus:outline-none focus:ring-4 focus:ring-pink-100"
              >
                <option value="">Any location</option>
                {allCountries.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs" aria-hidden>▼</span>
            </div>

            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <CalendarIcon size={18} />
              </span>
              <input
                type="date"
                value={filters.available_from ?? ''}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setFilters((f) => ({ ...f, available_from: e.target.value || undefined }))}
                className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-sm text-slate-700 shadow-sm transition focus:border-pink-400 focus:outline-none focus:ring-4 focus:ring-pink-100"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowAllFilters((s) => !s)}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-pink-300 hover:bg-pink-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              {showAllFilters ? 'Less' : 'Filters'}
              {Object.keys(filters).filter(k => !['query', 'country', 'available_from'].includes(k)).length > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-pink-500 text-[0.65rem] font-bold text-white">
                  {Object.keys(filters).filter(k => !['query', 'country', 'available_from'].includes(k)).length}
                </span>
              )}
            </button>
          </div>

          {/* Popular topic chips */}
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-600">Popular help with:</span>
            {POPULAR_TOPICS.map((topic) => (
              <button
                key={topic}
                type="button"
                onClick={() => setFilters((f) => ({ ...f, query: topic }))}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:border-pink-300 hover:bg-pink-50 hover:text-pink-700 hover:shadow"
              >
                {topic}
              </button>
            ))}
          </div>

          {/* Expanded filter rail */}
          {showAllFilters && (
            <div className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
              <FilterBlock label="Expertise">
                <select
                  value={filters.university_id ?? ''}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      university_id: e.target.value ? Number(e.target.value) : undefined,
                    }))
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm transition focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-100"
                >
                  <option value="">All universities</option>
                  {allUniversities.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </FilterBlock>

              <FilterBlock label="Languages">
                <div className="flex flex-wrap gap-1.5">
                  {allLanguages.slice(0, 6).map((lang) => {
                    const active = filters.languages?.includes(lang);
                    return (
                      <button
                        key={lang}
                        type="button"
                        onClick={() =>
                          setFilters((f) => {
                            const cur = f.languages ?? [];
                            const next = active ? cur.filter((l) => l !== lang) : [...cur, lang];
                            return { ...f, languages: next.length > 0 ? next : undefined };
                          })
                        }
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                          active
                            ? 'border-pink-400 bg-pink-50 text-pink-700 shadow-sm'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-pink-200 hover:bg-pink-50/50'
                        }`}
                      >
                        {lang}
                      </button>
                    );
                  })}
                </div>
              </FilterBlock>

              <FilterBlock label="Availability">
                <div className="flex flex-col gap-1.5">
                  {[
                    { v: undefined, label: 'Any' },
                    { v: true, label: 'Current student' },
                    { v: false, label: 'Alumni' },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setFilters((f) => ({ ...f, currently_enrolled: opt.v as boolean | undefined }))}
                      className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                        filters.currently_enrolled === opt.v
                          ? 'border-pink-400 bg-pink-50 text-pink-700 shadow-sm'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-pink-200 hover:bg-pink-50/50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </FilterBlock>

              <FilterBlock label="Price">
                <select
                  value={filters.sort ?? 'rating'}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, sort: e.target.value as MentorBrowseFilters['sort'] }))
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm transition focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-100"
                >
                  <option value="rating">Best match</option>
                  <option value="newest">Newest</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                </select>
              </FilterBlock>
            </div>
          )}

          {/* How it works stepper */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-bold text-slate-900">How it works</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <Step
                num="1"
                title="Find your mentor"
                done={stepStatus.location}
                hint="Search by university or topic"
                icon={
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                }
              />
              <Step
                num="2"
                title="Choose a time"
                done={stepStatus.time}
                hint="Pick a time that works for you"
                icon={
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                }
              />
              <Step
                num="3"
                title="Book & connect"
                done={stepStatus.mentor}
                hint={`${results.length} mentor${results.length === 1 ? '' : 's'} available`}
                icon={
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                }
              />
            </div>
          </div>
        </div>
      </section>

      {/* Results header with stats */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-2xl font-bold text-slate-900">
            {results.length} mentor{results.length === 1 ? '' : 's'} found
          </p>
          <p className="text-sm text-slate-500">
            {filters.university_id && 'at your selected university'}
            {filters.country && !filters.university_id && `in ${filters.country}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {Object.keys(filters).length > 0 && (
            <button
              type="button"
              onClick={() => setFilters({})}
              className="inline-flex items-center gap-2 text-sm font-semibold text-pink-600 transition hover:text-pink-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear all
            </button>
          )}
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
            </svg>
            <span className="text-xs font-medium text-slate-600">
              Sort by: {filters.sort === 'newest' ? 'Newest' : filters.sort === 'price_asc' ? 'Price ↑' : filters.sort === 'price_desc' ? 'Price ↓' : 'Best match'}
            </span>
          </div>
        </div>
      </div>

      {results.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-16 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
            <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <p className="text-xl font-bold text-slate-700">No mentors found</p>
          <p className="mt-2 text-sm text-slate-500">
            Try adjusting your filters or search for a different university
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setFilters({})}
              className="inline-flex items-center gap-2 rounded-lg border-2 border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
            >
              Clear filters
            </button>
            <Link
              href="/mentors/apply"
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:shadow-xl"
            >
              Become a mentor
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((m) => (
            <MentorCard key={m.id} mentor={m} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-600">
        {label}
      </p>
      {children}
    </div>
  );
}

function Step({ num, title, done, hint, icon }: { num: string; title: string; done: boolean; hint: string; icon: React.ReactNode }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border-2 p-4 transition ${
        done 
          ? 'border-emerald-400 bg-emerald-50' 
          : 'border-slate-200 bg-white'
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold transition ${
          done 
            ? 'bg-emerald-500 text-white' 
            : 'bg-slate-100 text-slate-500'
        }`}
        aria-hidden
      >
        {done ? (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <span className="opacity-60">{icon}</span>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-bold ${done ? 'text-emerald-900' : 'text-slate-700'}`}>
          {title}
        </p>
        <p className={`mt-0.5 text-xs ${done ? 'text-emerald-600' : 'text-slate-500'}`}>
          {hint}
        </p>
      </div>
    </div>
  );
}
