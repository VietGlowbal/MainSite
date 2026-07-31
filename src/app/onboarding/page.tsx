import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { OnboardingContainer, ONBOARDING_FLOW_ID, ONBOARDING_FLOW_VERSION } from '@/features/onboarding';
import type { StoredOnboardingResponse } from '@/features/onboarding';

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

  const [{ data: profile }, { data: response }] = user
    ? await Promise.all([
      supabase.from('student_profiles').select('*').eq('user_id', user.id).maybeSingle(),
      supabase
        .from('student_onboarding_responses')
        .select('flow_id, flow_version, answers, completed_steps, status')
        .eq('user_id', user.id)
        .eq('flow_id', ONBOARDING_FLOW_ID)
        .eq('flow_version', ONBOARDING_FLOW_VERSION)
        .maybeSingle(),
    ])
    : [{ data: null }, { data: null }];

  return (
    <main className="onboarding-page-redesign relative min-h-screen overflow-hidden bg-[var(--color-bg)]">
      <Suspense fallback={null}>
        <OnboardingContainer
          initialProfile={profile}
          initialResponse={response as StoredOnboardingResponse}
          isSignedIn={!!user}
        />
      </Suspense>
    </main>
  );
}
