import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/send-email';
import { passwordResetEmail } from '@/lib/emails/password-reset';
import { authErrorBody } from '@/features/auth/domain';
import { passwordResetLimiter } from '@/lib/rate-limiter';
import { resolveAuthOrigin } from '@/lib/auth-origin';

/**
 * POST /api/auth/reset-password — request a reset link.
 *
 * There was no password-reset flow at all before 2026-09-04: the old markup
 * carried a "Forgot password" control that was a no-op, and the Figma rebuild
 * dropped it rather than implementing it. A user whose password leaked had no
 * way to rotate it. See `docs/known-issues.md §0i`.
 *
 * Like sign-up, the mail goes out through Resend rather than Supabase's SMTP,
 * which is rate-limited on the free tier.
 *
 * TWO PROPERTIES THIS ROUTE MUST KEEP:
 *
 * 1. It ALWAYS answers 200 `{ ok: true }` — for a registered address, an
 *    unregistered one, or a Supabase failure. Anything else turns this endpoint
 *    into an account-existence oracle: an attacker submits an address and reads
 *    the status code to learn whether it holds an account. That is why the
 *    `generateLink` error below is logged and swallowed instead of returned.
 *
 * 2. It is rate limited on BOTH the caller's IP and the target email, because
 *    it sends mail to an address the caller chooses. One host spraying many
 *    addresses is caught by the IP bucket; a distributed attempt to bury one
 *    victim in reset mail is caught by the email bucket.
 */
const BodySchema = z.object({ email: z.string().email().max(320) });

/** Shared by both success paths so they are impossible to tell apart. */
const OK = { ok: true } as const;

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(authErrorBody('invalid_json'), { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  // A malformed address cannot belong to an account, so rejecting it leaks
  // nothing — and telling the user their address is unreadable is useful.
  if (!parsed.success) {
    return NextResponse.json(authErrorBody('invalid_input'), { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  for (const identifier of [`ip:${ip}`, `email:${email}`]) {
    if (!passwordResetLimiter.checkLimit(identifier).allowed) {
      return NextResponse.json(authErrorBody('rate_limited'), { status: 429 });
    }
  }

  const origin = resolveAuthOrigin(new URL(request.url).origin);

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
    });

    if (error || !data.properties?.hashed_token) {
      // Overwhelmingly this is "no user with that email", which is not an
      // incident and must not reach the caller. Logged so a genuine Supabase
      // outage is still visible to us.
      console.warn('[auth/reset-password] no link generated', error?.message ?? 'no hashed_token');
      return NextResponse.json(OK);
    }

    /*
     * We email a link to OUR page carrying the raw recovery token, rather than
     * Supabase's `action_link`. The token is then redeemed at the moment the new
     * password is submitted (`verifyOtp` in the confirm route), which binds the
     * password change to possession of the email.
     *
     * The alternative — letting `action_link` establish a session and then
     * trusting whoever holds that session — cannot distinguish "arrived from
     * the reset email" from "was already signed in on this browser", so it
     * would let anyone at an unlocked machine change the password without
     * knowing the current one.
     */
    const resetUrl = new URL('/auth/reset-password', origin);
    resetUrl.searchParams.set('token', data.properties.hashed_token);

    const firstName =
      (data.user?.user_metadata?.full_name as string | undefined)?.trim().split(/\s+/)[0] ||
      undefined;

    const emailResult = await sendEmail({
      to: email,
      subject: 'Reset your GlowBal password',
      html: passwordResetEmail(resetUrl.toString(), firstName),
      text: 'Reset your GlowBal password using the secure button in the HTML version of this email. If you did not request a reset, you can ignore this message — your password has not been changed.',
      category: 'security',
      template: 'password-reset',
      userId: data.user?.id,
      tags: { kind: 'password-reset' },
    });

    if (!emailResult.ok) {
      console.error('[auth/reset-password] send failed', emailResult.error);
    }
  } catch (err) {
    // Same reasoning as above: never let an internal failure become a signal.
    console.error('[auth/reset-password] unexpected failure', err);
  }

  return NextResponse.json(OK);
}
