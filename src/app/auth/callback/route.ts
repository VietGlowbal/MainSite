import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Check if user has completed onboarding
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from('student_profiles')
          .select('onboarding_completed, study_level, target_subjects, preferred_countries')
          .eq('user_id', user.id)
          .maybeSingle();

        // Consider onboarding complete if the flag is set OR if the profile
        // already has core fields filled in (covers cases where the flag
        // wasn't set due to a race condition or schema migration)
        const hasCompletedOnboarding =
          profile?.onboarding_completed ||
          (profile?.study_level && profile?.preferred_countries?.length > 0);

        if (hasCompletedOnboarding) {
          return NextResponse.redirect(`${origin}/universities`);
        }
        return NextResponse.redirect(`${origin}/onboarding`);
      }

      return NextResponse.redirect(`${origin}/onboarding`);
    }
  }

  return NextResponse.redirect(`${origin}/auth?error=auth_callback_failed`);
}
