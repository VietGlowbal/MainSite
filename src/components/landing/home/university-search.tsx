'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * UniversitySearch — the interactive entry point into the funnel.
 *
 * Phase 1 keeps this lightweight: typing a name (or picking a popular search)
 * routes the visitor into the full explorer at /universities, which is the
 * "choose a university" step of the GlowBal journey. Deeper in-line preview
 * results arrive in Phase 3.
 */
const POPULAR = [
  'University of Birmingham',
  'National University of Singapore',
  'University of Melbourne',
  'University of Toronto',
  'RMIT University',
];

export function UniversitySearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  function go(term?: string) {
    const t = (term ?? query).trim();
    router.push(t ? `/universities?q=${encodeURIComponent(t)}` : '/universities');
  }

  return (
    <div className="mx-auto max-w-2xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go();
        }}
        className="flex flex-col gap-3 sm:flex-row"
        role="search"
      >
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <label htmlFor="home-university-search" className="sr-only">
            Search for a university
          </label>
          <input
            id="home-university-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search university name…"
            className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-base text-slate-900 shadow-[0_8px_24px_rgba(30,40,80,0.06)] outline-none transition placeholder:text-slate-400 focus:border-pink-300 focus:ring-2 focus:ring-pink-200"
          />
        </div>
        <button
          type="submit"
          className="inline-flex h-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] px-7 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(255,77,140,0.28)] transition hover:-translate-y-0.5"
        >
          Explore
        </button>
      </form>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <span className="text-sm font-medium text-slate-500">Popular:</span>
        {POPULAR.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => go(name)}
            className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm text-slate-600 transition hover:border-pink-300 hover:text-pink-600"
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}
