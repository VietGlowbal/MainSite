import { Suspense } from 'react';
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

  const userName =
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split('@')[0] ||
    null;
  const userAvatarUrl = (user?.user_metadata?.avatar_url as string | undefined) ?? null;

  return (
    <Suspense fallback={null}>
      <OnboardingWizard
        initialProfile={profile}
        isSignedIn={!!user}
        userName={userName}
        userAvatarUrl={userAvatarUrl}
      />
    </Suspense>
  );
}
