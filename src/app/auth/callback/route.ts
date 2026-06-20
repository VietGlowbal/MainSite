import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Resolve the canonical site URL once. We prefer NEXT_PUBLIC_SITE_URL so
 * production deploys always redirect users to the custom domain instead of
 * the *.vercel.app hostname they may have arrived on. Falls back to the
 * request origin in dev.
 */
function canonicalOrigin(requestOrigin: string): string {
  let v = (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim().replace(/\/+$/, '');
  if (v && !/^https?:\/\//i.test(v)) {
    v = `${v.startsWith('localhost') ? 'http' : 'https'}://${v}`;
  }
  return v || requestOrigin;
}

export async function GET(request: Request) {
  const { searchParams, origin: requestOrigin } = new URL(request.url);
  const origin = canonicalOrigin(requestOrigin);
  const code = searchParams.get('code');
  const next = searchParams.get('next');
  const safeNext = next?.startsWith('/') ? next : null;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Check if user has completed onboarding
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Capture the phone number collected at sign-up. It rides along in user
        // metadata (set during signUp) because there's no session to write the
        // profile until the email link is clicked. Backfill it onto the profile
        // once, here, the first time we have a session. Best-effort.
        const metaPhone = (user.user_metadata?.phone as string | undefined)?.trim();
        if (metaPhone) {
          try {
            const admin = createAdminClient();
            const { data: existing } = await admin
              .from('student_profiles')
              .select('phone')
              .eq('user_id', user.id)
              .maybeSingle();
            if (!existing?.phone) {
              const now = new Date().toISOString();
              await admin.from('student_profiles').upsert(
                {
                  user_id: user.id,
                  phone: metaPhone,
                  marketing_consent: true,
                  marketing_consent_at: now,
                  marketing_consent_source: 'signup',
                  updated_at: now,
                },
                { onConflict: 'user_id' },
              );
            }
          } catch {
            /* non-fatal — the number is still on the auth user's metadata */
          }
        }

        if (safeNext) {
          return NextResponse.redirect(`${origin}${safeNext}`);
        }

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
