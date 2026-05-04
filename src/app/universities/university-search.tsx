'use client';

import { useMemo, useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { University } from '@/lib/types';

type ScoredUniversity = University & {
  match_score: number | null;
  is_saved: boolean;
};

type Props = {
  universities: ScoredUniversity[];
  hasProfile: boolean;
  isLoggedIn: boolean;
};

const COUNTRIES = [
  'All countries',
  'United States', 'United Kingdom', 'Canada', 'Australia',
  'Germany', 'Netherlands', 'France', 'Singapore', 'Japan',
  'Switzerland', 'Ireland', 'Sweden', 'Spain', 'Italy',
  'South Korea', 'Hong Kong', 'New Zealand',
  'United Arab Emirates', 'Qatar',
];

const DIFFICULTY_OPTIONS = ['All', 'Extremely Competitive', 'Very Competitive', 'Competitive', 'Moderate'];

function MatchRing({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 16;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : score >= 30 ? '#f97316' : '#ef4444';

  return (
    <div className="relative w-12 h-12 shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="16" fill="none" stroke="#f1f5f9" strokeWidth="2.5" />
        <circle
          cx="18" cy="18" r="16" fill="none"
          stroke={color} strokeWidth="2.5" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-700">
        {score}%
      </span>
    </div>
  );
}

export function UniversitySearch({ universities, hasProfile, isLoggedIn }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [query, setQuery] = useState('');
  const [country, setCountry] = useState('All countries');
  const [difficulty, setDifficulty] = useState('All');
  const [savedIds, setSavedIds] = useState<Set<number>>(
    new Set(universities.filter((u) => u.is_saved).map((u) => u.id)),
  );
  const [isPending, startTransition] = useTransition();
  const [savingId, setSavingId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    return universities.filter((uni) => {
      const q = query.toLowerCase();
      const matchesQuery =
        !q ||
        uni.name.toLowerCase().includes(q) ||
        (uni.country ?? '').toLowerCase().includes(q) ||
        (uni.strengths ?? '').toLowerCase().includes(q) ||
        (uni.best_for ?? '').toLowerCase().includes(q);

      const matchesCountry = country === 'All countries' || uni.country === country;
      const matchesDifficulty =
        difficulty === 'All' || (uni.admission_difficulty ?? '').includes(difficulty);

      return matchesQuery && matchesCountry && matchesDifficulty;
    });
  }, [universities, query, country, difficulty]);

  const handleSave = async (universityId: number, matchScore: number | null) => {
    if (!isLoggedIn) {
      window.location.href = '/auth';
      return;
    }

    setSavingId(universityId);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    if (savedIds.has(universityId)) {
      // Remove
      await supabase
        .from('user_universities')
        .delete()
        .eq('user_id', userData.user.id)
        .eq('university_id', universityId);

      startTransition(() => {
        setSavedIds((prev) => {
          const next = new Set(prev);
          next.delete(universityId);
          return next;
        });
      });
    } else {
      // Add + generate tasks
      const { data: inserted } = await supabase
        .from('user_universities')
        .insert({
          user_id: userData.user.id,
          university_id: universityId,
          status: 'interested',
          match_score: matchScore,
        })
        .select('id')
        .single();

      if (inserted) {
        // Generate tasks from templates
        const { data: templates } = await supabase
          .from('task_templates')
          .select('*')
          .order('sort_order');

        if (templates && templates.length > 0) {
          const tasks = templates.map((t: { title: string; description: string; category: string; sort_order: number; tips: unknown }) => ({
            user_university_id: inserted.id,
            title: t.title,
            description: t.description,
            category: t.category,
            sort_order: t.sort_order,
            tips: t.tips,
            deadline: null, // Could compute from university deadline
          }));

          await supabase.from('application_tasks').insert(tasks);
        }
      }

      startTransition(() => {
        setSavedIds((prev) => new Set(prev).add(universityId));
      });
    }

    setSavingId(null);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search universities, subjects, countries…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 min-w-[240px] rounded-2xl border border-black/5 bg-white/80 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none placeholder:text-slate-400 focus:border-pink-300 focus:ring-2 focus:ring-pink-100"
        />
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="rounded-2xl border border-black/5 bg-white/80 px-4 py-3 text-sm text-slate-700 shadow-sm outline-none focus:border-pink-300"
        >
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
          className="rounded-2xl border border-black/5 bg-white/80 px-4 py-3 text-sm text-slate-700 shadow-sm outline-none focus:border-pink-300"
        >
          {DIFFICULTY_OPTIONS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      {/* Results count */}
      <p className="text-sm text-slate-400">
        {filtered.length} {filtered.length === 1 ? 'university' : 'universities'} found
      </p>

      {/* Results grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((uni) => {
          const isSaved = savedIds.has(uni.id);
          const isSaving = savingId === uni.id;

          return (
            <article
              key={uni.id}
              className={`glow-card relative flex flex-col gap-3 transition-all ${
                isSaved ? 'ring-2 ring-pink-200' : ''
              }`}
            >
              {/* Match score */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                    {uni.country} · {uni.type ?? 'University'}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-900 leading-snug">
                    {uni.name}
                  </h3>
                </div>
                {uni.match_score !== null && <MatchRing score={uni.match_score} />}
              </div>

              {/* Stats row */}
              <div className="flex flex-wrap gap-2 text-xs">
                {uni.qs_rank && (
                  <span className="rounded-full bg-sky-50 border border-sky-200 px-2 py-0.5 font-semibold text-sky-600">
                    QS #{uni.qs_rank}
                  </span>
                )}
                {uni.accept_rate && (
                  <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 font-semibold text-amber-600">
                    {uni.accept_rate} accept
                  </span>
                )}
                {uni.tuition_usd && (
                  <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 font-semibold text-emerald-600">
                    ${uni.tuition_usd}
                  </span>
                )}
              </div>

              {/* Strengths */}
              {uni.strengths && (
                <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                  <span className="font-semibold text-slate-600">Strengths:</span> {uni.strengths}
                </p>
              )}

              {/* Best for */}
              {uni.best_for && (
                <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                  <span className="font-semibold text-slate-600">Best for:</span> {uni.best_for}
                </p>
              )}

              {/* Save button */}
              <button
                type="button"
                onClick={() => handleSave(uni.id, uni.match_score)}
                disabled={isSaving}
                className={`mt-auto flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all ${
                  isSaved
                    ? 'border-pink-300 bg-pink-50 text-pink-600 hover:bg-pink-100'
                    : 'border-black/5 bg-white/80 text-slate-600 hover:border-pink-200 hover:text-pink-600'
                }`}
              >
                {isSaving ? (
                  'Saving…'
                ) : isSaved ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>
                    Saved
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                    Add to my list
                  </>
                )}
              </button>
            </article>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="glow-card text-center py-12">
          <p className="text-slate-500">No universities match your filters. Try broadening your search.</p>
        </div>
      )}
    </div>
  );
}
