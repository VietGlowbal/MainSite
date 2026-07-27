import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PLUS_SALES_ENABLED } from '@/lib/plus';

/**
 * End of first-time onboarding.
 *
 * When Plus is on sale we surface the offer here (the "first sign-in" upsell),
 * but softly: /plus?welcome=1 shows a celebratory banner with a "Maybe later —
 * see my matches" skip link, so it's an invitation rather than a hard paywall.
 *
 * With sales off that page has nothing to sell, so sending every new user to it
 * would end onboarding on a dead end. They go straight to their matches — which
 * is where the skip link pointed anyway.
 */
export default async function OnboardingCompletePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth');

  redirect(PLUS_SALES_ENABLED ? '/plus?welcome=1' : '/universities');
}
