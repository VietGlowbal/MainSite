'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';

/* ─────────────────────────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────────────────────────── */

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

type AIScholarship = {
  name: string;
  provider: string;
  amount: string;
  currency?: string;
  coverage?: string;
  eligibility: string;
  deadline?: string;
  applicationUrl?: string;
  matchReason: string;
  matchScore: number;
  difficulty: 'easy' | 'medium' | 'hard';
  courseApplicationId: string;
  isUniversitySpecific: boolean;
  type: string;
};

type Props = {
  applications: Application[];
  existingScholarships: ExistingScholarship[];
};

/* ─────────────────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────────────────── */

function difficultyBadge(d: string) {
  switch (d) {
    case 'easy':
      return { label: 'Low competition', cls: 'bg-green-50 text-green-700 border-green-200' };
    case 'medium':
      return { label: 'Moderate', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'hard':
      return { label: 'Highly competitive', cls: 'bg-red-50 text-red-700 border-red-200' };
    default:
      return { label: d, cls: 'bg-slate-50 text-slate-600 border-slate-200' };
  }
}

function typeBadge(t: string) {
  const map: Record<string, { label: string; cls: string }> = {
    merit: { label: 'Merit-based', cls: 'bg-violet-50 text-violet-700' },
    need: { label: 'Need-based', cls: 'bg-blue-50 text-blue-700' },
    subject: { label: 'Subject-specific', cls: 'bg-cyan-50 text-cyan-700' },
    country: { label: 'Country-specific', cls: 'bg-emerald-50 text-emerald-700' },
    diversity: { label: 'Diversity', cls: 'bg-pink-50 text-pink-700' },
    general: { label: 'General', cls: 'bg-slate-50 text-slate-600' },
    sport: { label: 'Sports', cls: 'bg-orange-50 text-orange-700' },
    research: { label: 'Research', cls: 'bg-indigo-50 text-indigo-700' },
  };
  return map[t] || { label: t, cls: 'bg-slate-50 text-slate-600' };
}

/* ─────────────────────────────────────────────────────────────────────────
   COMPONENT
───────────────────────────────────────────────────────────────────────── */

export function ScholarshipDashboard({ applications, existingScholarships }: Props) {
  const { t } = useLanguage();
  const [scholarships, setScholarships] = useState<AIScholarship[]>([]);
  const [loading, setLoading] = useState(false);
  useLoadingIndicator(loading, t('Finding scholarships for you'));
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'match' | 'amount' | 'difficulty'>('match');

  const handleSearch = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/scholarships/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationIds: selectedApps.length > 0 ? selectedApps : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to search for scholarships');
        return;
      }

      setScholarships(data.scholarships || []);
      setSearched(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleApp = (id: string) => {
    setSelectedApps((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  // Filter and sort
  const filtered = scholarships
    .filter((s) => filterType === 'all' || s.type === filterType)
    .sort((a, b) => {
      if (sortBy === 'match') return b.matchScore - a.matchScore;
      if (sortBy === 'difficulty') {
        const order = { easy: 0, medium: 1, hard: 2 };
        return (order[a.difficulty] ?? 1) - (order[b.difficulty] ?? 1);
      }
      return 0; // amount sort not easily comparable
    });

  const uniqueTypes = [...new Set(scholarships.map((s) => s.type))];

  return (
    <div className="space-y-6">
      {/* Tab intro (the page shell owns the <h1>) */}
      <p className="text-sm text-slate-500">
        {t('AI-powered scholarship search matched to your course applications. We find funding you’re eligible for — including exclusive opportunities.')}
      </p>

      {/* Applications selector */}
      {applications.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">
              {t('Your courses')}
              <span className="ml-2 text-xs font-normal text-slate-400">
                {t('Select which applications to find scholarships for (or leave blank to search all)')}
              </span>
            </h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {applications.map((app) => {
                const isSelected = selectedApps.includes(app.id);
                return (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() => toggleApp(app.id)}
                    className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-all ${
                      isSelected
                        ? 'border-pink-300 bg-pink-50/50 shadow-sm'
                        : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/50'
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                        isSelected
                          ? 'border-pink-400 bg-pink-500 text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isSelected && '✓'}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-800">
                        {app.country_flag && <span className="mr-1">{app.country_flag}</span>}
                        {app.course_name}
                      </p>
                      <p className="truncate text-[11px] text-slate-400">
                        {app.university_name}
                        {app.degree_level && ` · ${app.degree_level}`}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Search button */}
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={handleSearch}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-pink-500 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    {t('Searching with AI…')}
                  </>
                ) : (
                  <>
                    <SparklesIcon />
                    {t(searched ? 'Search again' : 'Find scholarships')}
                  </>
                )}
              </button>
              {selectedApps.length > 0 && (
                <span className="text-xs text-slate-400">
                  {selectedApps.length} {t(selectedApps.length > 1 ? 'courses selected' : 'course selected')}
                </span>
              )}
            </div>

            {error && (
              <p className="mt-3 text-sm text-red-600">{t(error)}</p>
            )}
          </section>

          {/* Existing saved scholarships (from course extraction) */}
          {existingScholarships.length > 0 && !searched && (
            <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-slate-700">
                {t('Previously found scholarships')}
                <span className="ml-2 text-xs font-normal text-slate-400">
                  {t('Extracted when you imported your courses')}
                </span>
              </h2>
              <div className="space-y-2">
                {existingScholarships.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{s.title}</p>
                      {s.description && (
                        <p className="mt-0.5 text-xs text-slate-500">{s.description}</p>
                      )}
                    </div>
                    {s.url && (
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-white"
                      >
                        {t('View')} →
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* AI Results */}
          {searched && scholarships.length > 0 && (
            <section className="space-y-4">
              {/* Filters bar */}
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
                <span className="text-xs font-semibold text-slate-500">{t('Filter:')}</span>
                <button
                  type="button"
                  onClick={() => setFilterType('all')}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    filterType === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {t('All')} ({scholarships.length})
                </button>
                {uniqueTypes.map((type) => {
                  const badge = typeBadge(type);
                  const count = scholarships.filter((s) => s.type === type).length;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFilterType(type)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                        filterType === type ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {t(badge.label)} ({count})
                    </button>
                  );
                })}

                <span className="ml-auto text-xs text-slate-400">{t('Sort:')}</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none"
                >
                  <option value="match">{t('Best match')}</option>
                  <option value="difficulty">{t('Easiest first')}</option>
                  <option value="amount">{t('Amount')}</option>
                </select>
              </div>

              {/* Results grid */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((s, i) => (
                  <ScholarshipCard key={`${s.name}-${i}`} scholarship={s} applications={applications} />
                ))}
              </div>

              {filtered.length === 0 && (
                <p className="py-8 text-center text-sm text-slate-400">
                  {t('No scholarships match this filter.')}
                </p>
              )}
            </section>
          )}

          {searched && scholarships.length === 0 && !loading && !error && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white py-12 text-center">
              <p className="text-sm text-slate-500">
                {t('No scholarships found for your current applications. Try importing more courses or updating your profile.')}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   SCHOLARSHIP CARD
───────────────────────────────────────────────────────────────────────── */

function ScholarshipCard({
  scholarship: s,
  applications,
}: {
  scholarship: AIScholarship;
  applications: Application[];
}) {
  const { t } = useLanguage();
  const app = applications.find((a) => a.id === s.courseApplicationId);
  const diff = difficultyBadge(s.difficulty);
  const tBadge = typeBadge(s.type);

  return (
    <div className="flex flex-col rounded-xl border border-slate-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      {/* Header */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-900 line-clamp-2">{s.name}</h3>
          <p className="mt-0.5 text-xs text-slate-400">{s.provider}</p>
        </div>
        {/* Match score */}
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-50 to-emerald-100 text-xs font-bold text-emerald-700">
          {s.matchScore}
        </span>
      </div>

      {/* Amount */}
      <div className="mb-3 rounded-lg bg-gradient-to-r from-pink-50 to-violet-50 px-3 py-2">
        <p className="text-base font-bold text-slate-900">{s.amount}</p>
        {s.coverage && (
          <p className="text-[11px] text-slate-500">{s.coverage}</p>
        )}
      </div>

      {/* Badges */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${diff.cls}`}>
          {t(diff.label)}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${tBadge.cls}`}>
          {t(tBadge.label)}
        </span>
        {s.isUniversitySpecific && (
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
            {t('University scholarship')}
          </span>
        )}
      </div>

      {/* Eligibility */}
      <p className="mb-2 text-xs leading-relaxed text-slate-500 line-clamp-2">
        {s.eligibility}
      </p>

      {/* Match reason */}
      <p className="mb-3 text-[11px] italic text-emerald-600 line-clamp-2">
        &ldquo;{s.matchReason}&rdquo;
      </p>

      {/* Course link */}
      {app && (
        <p className="mb-3 text-[10px] text-slate-400">
          {t('For:')} {app.country_flag} {app.course_name} — {app.university_name}
        </p>
      )}

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between pt-2 border-t border-slate-50">
        {s.deadline && (
          <span className="text-[10px] text-slate-400">
            {t('Deadline:')} {s.deadline}
          </span>
        )}
        {s.applicationUrl ? (
          <a
            href={s.applicationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-medium text-white hover:bg-slate-700"
          >
            {t('Apply')} <span aria-hidden>→</span>
          </a>
        ) : (
          <span className="ml-auto text-[10px] text-slate-300">{t('No link available')}</span>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   EMPTY STATE
───────────────────────────────────────────────────────────────────────── */

function EmptyState() {
  const { t } = useLanguage();
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-pink-50">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-pink-500">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-slate-800">{t('No courses imported yet')}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
        {t('Import a course on the Apply page first, then come back here to find scholarships matched to your applications.')}
      </p>
      <Link
        href="/apply"
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-pink-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-pink-600"
      >
        {t('Go to Apply')}
      </Link>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   ICONS
───────────────────────────────────────────────────────────────────────── */

function SparklesIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  );
}
