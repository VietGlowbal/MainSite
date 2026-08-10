import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { captureReferral, REF_COOKIE } from '@/lib/referrals';
import { resolveRequestOrigin } from '@/lib/site-url';

/** Redirect that also clears the referral cookie once it's been captured. */
function redirectClearingRef(url: string): NextResponse {
  const res = NextResponse.redirect(url);
  res.cookies.set(REF_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}

export async function GET(request: Request) {
  const { searchParams, origin: requestOrigin } = new URL(request.url);
  const origin = resolveRequestOrigin(requestOrigin);
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
        // Referral attribution (last-touch): credit the ambassador whose link
        // this visitor last came through before authenticating. Best-effort.
        try {
          const refCode = (await cookies()).get(REF_COOKIE)?.value;
          if (refCode) {
            await captureReferral(createAdminClient(), user.id, refCode);
          }
        } catch {
          /* non-fatal — never block auth on attribution */
        }

        // Capture the phone number collected at sign-up. It rides along in user
        // metadata (set during signUp) because there's no session to write the
        // profile until the email link is clicked. Backfill it onto the profile
        // once, here, the first time we have a session. Best-effort.
        const metaPhone = (user.user_metadata?.phone as string | undefined)?.trim();
        // DOB rides along the same way (YYYY-MM-DD) and is backfilled onto the
        // contact record here the first time we have a session.
        const metaDob = (user.user_metadata?.date_of_birth as string | undefined)?.trim();
        if (metaPhone || metaDob) {
          try {
            const admin = createAdminClient();
            const { data: existing } = await admin
              .from('student_profiles')
              .select('phone, date_of_birth')
              .eq('user_id', user.id)
              .maybeSingle();
            const now = new Date().toISOString();
            const patch: Record<string, unknown> = { user_id: user.id, updated_at: now };
            if (metaPhone && !existing?.phone) {
              patch.phone = metaPhone;
              patch.marketing_consent = true;
              patch.marketing_consent_at = now;
              patch.marketing_consent_source = 'signup';
            }
            if (metaDob && /^\d{4}-\d{2}-\d{2}$/.test(metaDob) && !existing?.date_of_birth) {
              patch.date_of_birth = metaDob;
            }
            // Only write if there's something new beyond the keys we always set.
            if (Object.keys(patch).length > 2) {
              await admin.from('student_profiles').upsert(patch, { onConflict: 'user_id' });
            }
          } catch {
            /* non-fatal — the values are still on the auth user's metadata */
          }
        }

        if (safeNext) {
          return redirectClearingRef(`${origin}${safeNext}`);
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
          return redirectClearingRef(`${origin}/universities`);
        }
        return redirectClearingRef(`${origin}/onboarding`);
      }

      return NextResponse.redirect(`${origin}/onboarding`);
    }
  }

  return NextResponse.redirect(`${origin}/auth?error=auth_callback_failed`);
}
