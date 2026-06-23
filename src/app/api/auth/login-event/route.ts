import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { captureReferral, REF_COOKIE } from '@/lib/referrals';

/**
 * POST /api/auth/login-event
 *
 * Records one login_events row for the current user. Supabase only exposes
 * last_sign_in_at (a single timestamp), so this is how we count "logins" per
 * user for the admin dashboard. Called from the client nav on a SIGNED_IN auth
 * event — the SINGLE source of login_events so counts never double up.
 *
 * It also acts as the last-touch attribution fallback for email/password
 * logins (which never hit /auth/callback): if a `gb_ref` cookie is present it
 * attributes the user to that ambassador and clears the cookie.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const provider = (user.app_metadata?.provider as string | undefined) ?? '';
  const source = provider === 'google' ? 'oauth' : provider === 'email' ? 'password' : 'unknown';
  const refCode = request.cookies.get(REF_COOKIE)?.value;

  try {
    const admin = createAdminClient();
    await admin.from('login_events').insert({ user_id: user.id, source });
    if (refCode) {
      await captureReferral(admin, user.id, refCode);
    }
  } catch {
    // Best-effort — never surface a tracking failure to the client.
  }

  const res = NextResponse.json({ ok: true });
  if (refCode) res.cookies.set(REF_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
