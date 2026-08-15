import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { captureReferral, REF_COOKIE } from '@/lib/referrals';
import { sendEmail } from '@/lib/send-email';
import { welcomeEmail } from '@/lib/emails/welcome';

function redirectClearingRef(url: string): NextResponse {
  const res = NextResponse.redirect(url);
  res.cookies.set(REF_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}

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
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        try {
          const refCode = (await cookies()).get(REF_COOKIE)?.value;
          if (refCode) {
            await captureReferral(createAdminClient(), user.id, refCode);
          }
        } catch {
          /* non-fatal — never block auth on attribution */
        }

        const metaPhone = (user.user_metadata?.phone as string | undefined)?.trim();
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
            if (Object.keys(patch).length > 2) {
              await admin.from('student_profiles').upsert(patch, { onConflict: 'user_id' });
            }
          } catch {
            /* non-fatal — values remain on auth metadata */
          }
        }

        const { data: profile } = await supabase
          .from('student_profiles')
          .select('onboarding_completed, study_level, target_subjects, preferred_countries')
          .eq('user_id', user.id)
          .maybeSingle();

        const hasCompletedOnboarding = Boolean(
          profile?.onboarding_completed ||
            (profile?.study_level && profile?.preferred_countries?.length > 0),
        );

        // /auth/callback also serves non-signup auth flows. Only accounts created
        // by our email/password signup route carry this marker, so an existing
        // user logging in through another callback can never receive a surprise
        // "welcome" email. The marker is cleared after a successful/duplicate
        // delivery, while the event key remains a second layer of idempotency.
        const welcomePending = user.user_metadata?.glowbal_welcome_pending === true;
        if (user.email && welcomePending) {
          const fullName = (user.user_metadata?.full_name as string | undefined)?.trim();
          const firstName = fullName?.split(/\s+/)[0] || undefined;
          const defaultNext = hasCompletedOnboarding ? '/ai-strategy' : '/onboarding';
          const welcomeResult = await sendEmail({
            to: user.email,
            subject: 'Welcome to GlowBal — you’re in',
            html: welcomeEmail({
              firstName,
              nextUrl: `${origin}${safeNext ?? defaultNext}`,
              onboardingComplete: hasCompletedOnboarding,
            }),
            text: `Welcome to GlowBal. Your account is ready. Continue here: ${origin}${safeNext ?? defaultNext}`,
            category: 'product_transactional',
            template: 'welcome',
            userId: user.id,
            idempotencyKey: `welcome:${user.id}`,
            tags: { kind: 'welcome' },
          });
          if (!welcomeResult.ok) {
            console.error('[auth/callback] welcome email failed', welcomeResult.error);
          } else if (!welcomeResult.skipped || welcomeResult.reason === 'duplicate') {
            try {
              await createAdminClient().auth.admin.updateUserById(user.id, {
                user_metadata: {
                  ...user.user_metadata,
                  glowbal_welcome_pending: false,
                },
              });
            } catch {
              /* event-key idempotency remains the fallback if metadata update fails */
            }
          }
        }

        if (safeNext) {
          return redirectClearingRef(`${origin}${safeNext}`);
        }
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
