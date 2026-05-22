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
  'Life abroad',
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
    <div className="space-y-8">
      {/* HERO — search bar + steps */}
      <section className="relative overflow-hidden rounded-[2rem] border border-black/5 bg-white/95 px-5 py-6 shadow-[0_12px_32px_rgba(22,33,62,0.06)] backdrop-blur md:px-8 md:py-7">
        <span
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-20 h-64 w-64 rounded-full opacity-50 blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(255,77,140,0.18), transparent 60%)' }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-28 -left-16 h-72 w-72 rounded-full opacity-40 blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.16), transparent 60%)' }}
        />

        <div className="relative space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="glow-pill">Mentorship Hub</span>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
                Meet a mentor who&rsquo;s walked the path
              </h1>
              <p className="mt-1 max-w-xl text-sm text-slate-500">
                Browse current students and recent grads at your dream universities. Pick a time, share what you want help with, and book a real video session.
              </p>
            </div>
            <Link
              href="/mentors/apply"
              className="inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-pink-300 bg-white/80 px-4 py-2 text-sm font-semibold text-pink-600 shadow-sm transition hover:-translate-y-0.5 hover:bg-pink-50 sm:self-end"
            >
              <span aria-hidden>✨</span>
              Become a mentor
            </Link>
          </div>

          {/* Search inputs */}
          <div className="grid gap-2 lg:grid-cols-[1.4fr_1fr_1fr_auto]">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <SearchIcon size={16} />
              </span>
              <input
                type="text"
                placeholder="Search by mentor, university, or topic"
                value={filters.query ?? ''}
                onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value || undefined }))}
                className="w-full rounded-full border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-100"
              />
            </div>

            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <MapPinIcon size={16} />
              </span>
              <select
                value={filters.country ?? ''}
                onChange={(e) => setFilters((f) => ({ ...f, country: e.target.value || undefined }))}
                className="w-full appearance-none rounded-full border border-slate-200 bg-white py-3 pl-10 pr-9 text-sm text-slate-700 focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-100"
              >
                <option value="">Any location</option>
                {allCountries.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden>▼</span>
            </div>

            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <CalendarIcon size={16} />
              </span>
              <input
                type="date"
                value={filters.available_from ?? ''}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setFilters((f) => ({ ...f, available_from: e.target.value || undefined }))}
                className="w-full rounded-full border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm text-slate-700 focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-100"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowAllFilters((s) => !s)}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-cyan-300"
            >
              {showAllFilters ? 'Hide filters' : 'More filters'}
            </button>
          </div>

          {/* Popular topic chips */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">Popular help with:</span>
            {POPULAR_TOPICS.map((topic) => (
              <button
                key={topic}
                type="button"
                onClick={() => setFilters((f) => ({ ...f, query: topic }))}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500 transition hover:border-pink-200 hover:text-pink-600"
              >
                {topic}
              </button>
            ))}
          </div>

          {/* Expanded filter rail */}
          {showAllFilters && (
            <div className="grid gap-4 rounded-2xl border border-slate-100 bg-white/80 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <FilterBlock label="University">
                <select
                  value={filters.university_id ?? ''}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      university_id: e.target.value ? Number(e.target.value) : undefined,
                    }))
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-cyan-300 focus:outline-none"
                >
                  <option value="">All universities</option>
                  {allUniversities.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </FilterBlock>

              <FilterBlock label="Languages">
                <div className="flex flex-wrap gap-1.5">
                  {allLanguages.slice(0, 8).map((lang) => {
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
                        className={`rounded-full border px-2.5 py-1 text-xs transition ${
                          active
                            ? 'border-cyan-300 bg-cyan-50 text-cyan-700'
                            : 'border-slate-200 bg-white text-slate-500 hover:border-cyan-200'
                        }`}
                      >
                        {lang}
                      </button>
                    );
                  })}
                </div>
              </FilterBlock>

              <FilterBlock label="Status">
                <div className="flex gap-1.5">
                  {[
                    { v: undefined, label: 'Any' },
                    { v: true, label: 'Currently studying' },
                    { v: false, label: 'Alumni' },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setFilters((f) => ({ ...f, currently_enrolled: opt.v as boolean | undefined }))}
                      className={`rounded-full border px-2.5 py-1 text-xs transition ${
                        filters.currently_enrolled === opt.v
                          ? 'border-pink-300 bg-pink-50 text-pink-600'
                          : 'border-slate-200 bg-white text-slate-500 hover:border-pink-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </FilterBlock>

              <FilterBlock label="Sort by">
                <select
                  value={filters.sort ?? 'rating'}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, sort: e.target.value as MentorBrowseFilters['sort'] }))
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-cyan-300 focus:outline-none"
                >
                  <option value="rating">Top rated</option>
                  <option value="newest">Newest mentors</option>
                  <option value="price_asc">Price: low → high</option>
                  <option value="price_desc">Price: high → low</option>
                </select>
              </FilterBlock>
            </div>
          )}

          {/* Stepper */}
          <div className="grid gap-3 rounded-2xl border border-slate-100 bg-white/80 p-3 sm:grid-cols-3">
            <Step
              num="1"
              title="Find your university"
              done={stepStatus.location}
              hint="Pick a country or specific school above"
            />
            <Step
              num="2"
              title="Choose a time"
              done={stepStatus.time}
              hint="Mentors share a calendar with open slots"
            />
            <Step
              num="3"
              title="Choose a mentor"
              done={stepStatus.mentor}
              hint={`${results.length} mentor${results.length === 1 ? '' : 's'} match your search`}
            />
          </div>
        </div>
      </section>

      {/* Results */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-slate-900">{results.length}</span> mentor{results.length === 1 ? '' : 's'} found
        </p>
        {Object.keys(filters).length > 0 && (
          <button
            type="button"
            onClick={() => setFilters({})}
            className="text-xs font-semibold text-pink-600 hover:underline"
          >
            Clear all filters
          </button>
        )}
      </div>

      {results.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white/80 p-12 text-center">
          <p className="text-lg font-semibold text-slate-700">No mentors match your search</p>
          <p className="mt-2 text-sm text-slate-500">
            Try widening the country or removing the date filter — or invite a mentor at your school.
          </p>
          <Link
            href="/mentors/apply"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(255,77,140,0.22)]"
          >
            Become a mentor
          </Link>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
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
      <p className="mb-1.5 text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      {children}
    </div>
  );
}

function Step({ num, title, done, hint }: { num: string; title: string; done: boolean; hint: string }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border p-3 transition ${
        done ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-white'
      }`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          done ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'
        }`}
        aria-hidden
      >
        {done ? '✓' : num}
      </span>
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${done ? 'text-emerald-700' : 'text-slate-700'}`}>{title}</p>
        <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
      </div>
    </div>
  );
}
