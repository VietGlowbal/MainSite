import { createClient } from '@/lib/supabase/server';
import { OnboardingForm } from './profile-form';

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = user
    ? (await supabase.from('student_profiles').select('*').eq('user_id', user.id).maybeSingle()).data
    : null;

  return (
    <main className="onboarding-page-redesign relative min-h-screen overflow-hidden bg-[var(--color-bg)]">
      {/* Background globe decoration */}
      <div className="onboarding-globe-bg pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.08]">
        <div className="onboarding-globe-container" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-10">
        {/* Welcome header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 md:text-5xl">
            WELCOME TO <span className="glowbal-wordmark">GLOWBAL</span>
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-base text-slate-600">
            Help you approach global education, <span className="font-semibold text-[var(--glowbal-mint)]">with ease</span> and <span className="italic text-[var(--glowbal-pink)]">without fear</span>
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--glowbal-pink)] to-[var(--glowbal-pink-light)] px-4 py-1.5 text-sm font-bold text-white shadow-md">
              1,000+
            </span>
            <span className="text-sm font-semibold text-slate-700">global universities</span>
            <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--glowbal-mint)] to-[var(--glowbal-mint-light)] px-4 py-1.5 text-sm font-bold text-white shadow-md">
              total $5,000,000
            </span>
            <span className="text-sm font-semibold text-slate-700">scholarship value</span>
          </div>
          <p className="mx-auto mt-2 max-w-xl text-xs text-slate-500">
            More than 1000 global universities with full-ride scholarship opportunities are waiting for you to discover!
          </p>
        </div>

        {/* Question card */}
        <OnboardingForm initialProfile={profile} isSignedIn={!!user} />
      </div>
    </main>
  );
}
