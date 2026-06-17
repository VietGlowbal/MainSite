import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * End of first-time onboarding. We surface the GlowBal Plus offer here (the
 * "first sign-in" upsell), but softly: /plus?welcome=1 shows a celebratory
 * banner with a "Maybe later — see my matches" skip link, so it's an
 * invitation rather than a hard paywall.
 */
export default async function OnboardingCompletePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth');

  redirect('/plus?welcome=1');
}
