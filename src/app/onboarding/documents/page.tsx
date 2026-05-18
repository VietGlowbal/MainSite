import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { OnboardingDocumentUpload } from './document-upload';

export default async function OnboardingDocumentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth');

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--color-bg)] px-4 py-12 text-slate-800 md:px-8">
      {/* Background globe decoration */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.06]">
        <div className="onboarding-globe-container" />
      </div>

      <div className="relative z-10 mx-auto max-w-3xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
            <span className="text-[var(--glowbal-pink)]">Last step</span> before we reveal your best match, are there anything else you would like to tell us?
          </h1>
          <p className="mx-auto max-w-lg text-sm leading-7">
            <span className="font-bold text-[var(--glowbal-mint)]">The more</span>{' '}
            <span className="font-bold text-slate-700">details you</span>{' '}
            <span className="font-bold text-[var(--glowbal-pink)]">provide, the</span>{' '}
            <span className="font-bold text-slate-700">bet</span>
            <span className="font-bold text-[var(--glowbal-mint)]">ter our</span>{' '}
            <span className="font-bold text-slate-900">recommendations</span>{' '}
            <span className="font-bold text-slate-700">will be!</span>
          </p>
        </div>

        {/* Upload form */}
        <OnboardingDocumentUpload />

        {/* Skip */}
        <div className="text-center">
          <a
            href="/onboarding/complete"
            className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-white/80 px-6 py-3 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-white hover:shadow-md"
          >
            Skip for now
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </div>
    </main>
  );
}
