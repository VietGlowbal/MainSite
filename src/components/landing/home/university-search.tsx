'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FUNDING_TYPE_LABELS } from '@/lib/scholarships';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';

/**
 * UniversitySearch — the interactive entry point into the funnel (Phase 3).
 *
 * Flow: type a university → see matches → select one → preview how many
 * scholarships are connected (with a few locked cards) → hit the login gate to
 * "create a free profile" before unlocking full details. Deeper browsing still
 * routes into the full explorer at /universities.
 *
 * Matches are fetched (debounced) from /api/home/search so we never ship the
 * whole universities/scholarships set to the browser.
 */

type PreviewScholarship = {
  id: number;
  name: string;
  provider: string | null;
  country: string | null;
  amountLabel: string | null;
  fundingType: string[];
  deadlineLabel: string | null;
};

type UniversityMatch = {
  id: number;
  name: string;
  country: string | null;
  scholarshipCount: number;
  preview: PreviewScholarship[];
};

const POPULAR = [
  'University of Birmingham',
  'National University of Singapore',
  'University of Melbourne',
  'University of Toronto',
  'RMIT University',
];

function fundingLabel(token: string): string {
  return (FUNDING_TYPE_LABELS as Record<string, string>)[token] ?? token;
}

export function UniversitySearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<UniversityMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const visibleLoading = query.trim().length >= 2 && loading;
  useLoadingIndicator(visibleLoading, 'Searching universities');
  const [selected, setSelected] = useState<UniversityMatch | null>(null);
  const [gateOpen, setGateOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Debounced fetch of matches whenever the query changes (and nothing selected).
  useEffect(() => {
    if (selected) return;
    const q = query.trim();
    if (q.length < 2) {
      return;
    }
    const handle = setTimeout(async () => {
      setLoading(true);
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch(`/api/home/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const data = (await res.json()) as { matches: UniversityMatch[] };
        setMatches(data.matches ?? []);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setMatches([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [query, selected]);

  const visibleMatches = query.trim().length < 2 ? [] : matches;

  const reset = useCallback(() => {
    setSelected(null);
    setQuery('');
    setMatches([]);
  }, []);

  return (
    <div className="mx-auto max-w-2xl">
      {!selected ? (
        <>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <label htmlFor="home-university-search" className="sr-only">Search for a university</label>
            <input
              id="home-university-search"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search university name…"
              autoComplete="off"
              className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-base text-slate-900 shadow-[0_8px_24px_rgba(30,40,80,0.06)] outline-none transition placeholder:text-slate-400 focus:border-pink-300 focus:ring-2 focus:ring-pink-200"
            />
            {visibleLoading ? (
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400">Searching…</span>
            ) : null}
          </div>

          {/* Results */}
          {query.trim().length >= 2 ? (
            <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(30,40,80,0.06)]">
              {visibleMatches.length > 0 ? (
                <ul className="divide-y divide-slate-100">
                  {visibleMatches.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(m)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                      >
                        <span>
                          <span className="block text-sm font-semibold text-slate-900">{m.name}</span>
                          {m.country ? <span className="block text-xs text-slate-500">{m.country}</span> : null}
                        </span>
                        <span className="shrink-0 rounded-full bg-pink-50 px-2.5 py-1 text-xs font-semibold text-pink-600">
                          {m.scholarshipCount} {m.scholarshipCount === 1 ? 'scholarship' : 'scholarships'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : !loading ? (
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="text-sm text-slate-500">No matches for “{query.trim()}”.</span>
                  <button type="button" onClick={() => router.push('/universities')} className="text-sm font-semibold text-pink-600">
                    Browse all →
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <span className="text-sm font-medium text-slate-500">Popular:</span>
              {POPULAR.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setQuery(name)}
                  className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm text-slate-600 transition hover:border-pink-300 hover:text-pink-600"
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <SelectedUniversity match={selected} onBack={reset} onUnlock={() => setGateOpen(true)} />
      )}

      {gateOpen ? <LoginGate university={selected} onClose={() => setGateOpen(false)} /> : null}
    </div>
  );
}

function SelectedUniversity({
  match,
  onBack,
  onUnlock,
}: {
  match: UniversityMatch;
  onBack: () => void;
  onUnlock: () => void;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_12px_30px_rgba(30,40,80,0.06)] sm:p-7">
      <button type="button" onClick={onBack} className="text-sm font-semibold text-slate-500 transition hover:text-slate-900">
        ← Search again
      </button>

      <div className="mt-3">
        <h3 className="text-xl font-semibold text-slate-900">{match.name}</h3>
        {match.country ? <p className="text-sm text-slate-500">{match.country}</p> : null}
        <p className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {match.scholarshipCount > 0
            ? `We found ${match.scholarshipCount} ${match.scholarshipCount === 1 ? 'scholarship' : 'scholarships'} and student supporters connected to this university.`
            : 'Create a free profile to discover scholarships and student supporters connected to this university.'}
        </p>
      </div>

      {match.preview.length > 0 ? (
        <ul className="mt-5 space-y-3">
          {match.preview.map((s) => (
            <li key={s.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{s.name}</p>
                  <p className="text-xs text-slate-500">{s.provider ?? s.country ?? ''}</p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Locked
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {s.amountLabel ? <span className="text-sm font-bold text-slate-900">{s.amountLabel}</span> : null}
                {s.fundingType.slice(0, 2).map((f) => (
                  <span key={f} className="rounded-full bg-pink-50 px-2 py-0.5 text-[11px] font-medium text-pink-600">{fundingLabel(f)}</span>
                ))}
                {s.deadlineLabel ? <span className="text-xs text-slate-400">Deadline {s.deadlineLabel}</span> : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <button
        type="button"
        onClick={onUnlock}
        className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(255,77,140,0.28)] transition hover:-translate-y-0.5"
      >
        Create free profile to view scholarships
      </button>
    </div>
  );
}

function LoginGate({
  university,
  onClose,
}: {
  university: UniversityMatch | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const dest = university ? `/api/home/save-university?u=${university.id}` : '/universities';
  const goSignup = () => router.push(`/auth?mode=signup&redirect=${encodeURIComponent(dest)}`);
  const goLogin = () => router.push(`/auth?mode=login&redirect=${encodeURIComponent(dest)}`);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-gate-title"
    >
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-[0_30px_70px_rgba(15,23,42,0.3)]">
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>

        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-50 text-pink-600">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
        </span>

        <h2 id="login-gate-title" className="mt-4 text-xl font-semibold text-slate-900">
          Create your free GlowBal profile
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {university ? <>Unlock full scholarship details for <strong>{university.name}</strong> — </> : null}
          eligibility, required documents, deadlines, and save opportunities to
          your plan. It’s free to start.
        </p>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={goSignup}
            className="inline-flex items-center justify-center rounded-full bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(255,77,140,0.28)] transition hover:-translate-y-0.5"
          >
            Create free profile
          </button>
          <button
            type="button"
            onClick={goLogin}
            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            I already have an account
          </button>
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          No spam. We only ask for the basics to save your plan.
        </p>
      </div>
    </div>
  );
}
