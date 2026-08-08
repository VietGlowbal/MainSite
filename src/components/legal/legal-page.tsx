import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Shared shell for simple legal / policy pages (Privacy, Terms).
 *
 * Kept deliberately lightweight: a centred, readable column and a back link.
 * Content is passed as `sections` so each page stays a tiny data-only file.
 *
 * ⚠️ NO HEADER OF ITS OWN. These routes are not in the own-chrome lists in
 * nav-reveal.tsx / navigation-visibility.ts, so the root layout's TopNav +
 * MobileNav are already above this. It used to render a second brand bar with
 * its own logo and "Back to home" link, which read as two stacked headers —
 * both linking home, one of them scrolling away and one of them not. The site
 * header is the home affordance; the back link below is the in-page one.
 */
export type LegalSection = { heading: string; body: ReactNode };

export function LegalPage({
  title,
  lastUpdated,
  intro,
  sections,
}: {
  title: string;
  lastUpdated: string;
  intro: ReactNode;
  sections: LegalSection[];
}) {
  return (
    <div className="min-h-screen bg-white text-slate-800">
      <div className="mx-auto max-w-3xl px-5 py-14 sm:px-6">
        <Link
          href="/"
          className="text-sm font-semibold text-slate-600 transition hover:text-pink-600"
        >
          ← Back to home
        </Link>
        <h1 className="mt-6 text-3xl font-semibold tracking-[-0.03em] text-slate-900 sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-slate-400">Last updated: {lastUpdated}</p>
        <div className="mt-6 text-base leading-7 text-slate-600">{intro}</div>

        <div className="mt-10 space-y-8">
          {sections.map((s) => (
            <section key={s.heading}>
              <h2 className="text-lg font-semibold text-slate-900">{s.heading}</h2>
              <div className="mt-2 text-base leading-7 text-slate-600">{s.body}</div>
            </section>
          ))}
        </div>

        <p className="mt-12 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This is a general template provided for convenience and is not legal
          advice. Please have it reviewed by a qualified professional before
          relying on it.
        </p>
      </div>
    </div>
  );
}
