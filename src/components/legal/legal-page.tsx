'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useLanguage } from '@/lib/i18n';

/**
 * Shared shell for simple legal / policy pages (Privacy, Terms).
 *
 * Kept deliberately lightweight: a centred, readable column and a back link.
 * Content is passed as `sections` so each page stays a tiny data-only file.
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
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-white text-slate-800">
      <div className="mx-auto max-w-3xl px-5 py-14 sm:px-6">
        <Link
          href="/"
          className="text-sm font-semibold text-slate-600 transition hover:text-[#E11D48]"
        >
          {t('← Back to home')}
        </Link>
        <h1 className="mt-6 text-2xl font-bold tracking-[-0.02em] text-slate-900 sm:text-3xl lg:text-4xl">{t(title)}</h1>
        <p className="mt-2 text-sm text-slate-400">
          {t('Last updated:')} {lastUpdated}
        </p>
        <div className="mt-6 text-base leading-7 text-slate-600">{intro}</div>

        <div className="mt-10 space-y-8">
          {sections.map((s) => (
            <section key={s.heading}>
              <h2 className="text-lg font-bold text-slate-900">{t(s.heading)}</h2>
              <div className="mt-2 text-base leading-7 text-slate-600">{s.body}</div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

