import { createClient } from '@/lib/supabase/server';
import { GlowbalOption3GlobeDemo } from '@/components/demo/glowbal-option3-globe-demo';

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
      <GlowbalOption3GlobeDemo initialProfile={profile} isSignedIn={!!user} mode="live" />
    </main>
  );
}
