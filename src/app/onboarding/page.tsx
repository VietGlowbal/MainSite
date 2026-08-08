import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { onboardingIsComplete } from '@/features/onboarding/domain';
import { createClient } from '@/lib/supabase/server';
import { OnboardingWizard } from './onboarding-wizard';

/**
 * GLOWBAL onboarding entry — rebuilt from Figma câu 1–9.
 *
 * Renders the stepped wizard that replaced the single-page form. Suspense lets
 * `useSearchParams` work in the client component without deopting the page out
 * of static rendering.
 */
export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = user
    ? (await supabase.from('student_profiles').select('*').eq('user_id', user.id).maybeSingle()).data
    : null;

  // The questionnaire is a first-time experience. Its answers remain
  // editable from /profile, but a completed student should never be sent back
  // through the test by a stale bookmark or a hand-typed URL.
  if (onboardingIsComplete(profile)) redirect('/profile');

  return (
    <Suspense fallback={null}>
      <OnboardingWizard
        initialProfile={profile}
        isSignedIn={!!user}
      />
    </Suspense>
  );
}
