import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { OnboardingSinglePage } from '@/components/onboarding/onboarding-single-page';

/**
 * GLOWBAL onboarding entry.
 *
 * Renders the single-page form that replaced the old multi-step quiz.
 * Suspense lets `useSearchParams` work in the client component without
 * deopting the whole page out of static rendering.
 */
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
      <Suspense fallback={null}>
        <OnboardingSinglePage initialProfile={profile} isSignedIn={!!user} />
      </Suspense>
    </main>
  );
}
