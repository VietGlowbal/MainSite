import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import {
  authErrorBody,
  hasPasswordIdentity,
  PASSWORD_MAX_LENGTH,
  validatePasswordChange,
} from '@/features/auth/domain';
import { changeOwnPassword, checkPasswordBreach } from '@/features/auth/api';
import { passwordChangeLimiter } from '@/lib/rate-limiter';
import { sendEmail } from '@/lib/send-email';
import { passwordChangedEmail } from '@/lib/emails/password-changed';
import { resolveAuthOrigin } from '@/lib/auth-origin';

/**
 * POST /api/account/password — change your own password while signed in.
 *
 * The third and last piece of the password story. `/api/auth/reset-password`
 * covers "I cannot get in", its `/confirm` sibling covers "here is my new one
 * from the email link", and this covers "I am in, and I want a different
 * password" — the case a student reaches when they suspect their password has
 * leaked but have not been locked out.
 *
 * Unlike the reset routes, this one is NOT enumeration-sensitive: the caller has
 * already proved who they are, so errors can name the real problem. It has a
 * different exposure instead — it accepts the current password and reports
 * whether it was right, which is a guessing oracle for anyone holding a stolen
 * session. Hence the limiter, and hence the notification email on success.
 */
const BodySchema = z.object({
  // No `min` on either: an empty current password gets its own message from
  // `validatePasswordChange`, and an empty new one gets `password_blank`.
  // Letting Zod collapse both into "invalid input" would lose that.
  currentPassword: z.string().max(PASSWORD_MAX_LENGTH),
  newPassword: z.string().max(PASSWORD_MAX_LENGTH),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(authErrorBody('invalid_json'), { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(authErrorBody('invalid_input'), { status: 400 });
  }
  const { currentPassword, newPassword } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // `getUser` revalidates against Supabase rather than trusting the cookie, so
  // this is a real authentication check and not a cookie-shape check.
  if (!user?.email) {
    return NextResponse.json(authErrorBody('not_signed_in'), { status: 401 });
  }

  // A Google-only account has no password hash, so there is no current password
  // to verify and nothing this route can do. The UI branches on the same rule
  // and offers the email route instead; this is the guard for a direct POST.
  if (!hasPasswordIdentity(user.identities)) {
    return NextResponse.json(authErrorBody('password_not_set'), { status: 400 });
  }

  // Local rules first — free, and they keep a mistyped length out of the
  // attempt budget below.
  const problem = validatePasswordChange(currentPassword, newPassword);
  if (problem) {
    return NextResponse.json(authErrorBody(problem.code, problem.vars), { status: 400 });
  }

  /*
   * Keyed on the user, not the IP. The threat is a specific account being
   * guessed at, and an attacker with a stolen session for that account is
   * bounded by the account's budget however many addresses they come from.
   * Placed after validation so a real user's typo does not spend an attempt,
   * and before the breach lookup so a wordlist cannot pump outbound requests.
   */
  if (!passwordChangeLimiter.checkLimit(`user:${user.id}`).allowed) {
    return NextResponse.json(authErrorBody('rate_limited'), { status: 429 });
  }

  // Same policy and same fail-open behaviour as sign-up and reset — see
  // `features/auth/api/pwned-passwords.ts`.
  const breach = await checkPasswordBreach(newPassword);
  if (breach.status === 'breached') {
    return NextResponse.json(authErrorBody('password_breached'), { status: 400 });
  }
  if (breach.status === 'unavailable') {
    console.warn('[account/password] breach check skipped', breach.reason);
  }

  const outcome = await changeOwnPassword({
    email: user.email,
    currentPassword,
    newPassword,
  });

  if (outcome.status === 'wrong_password') {
    return NextResponse.json(authErrorBody('current_password_incorrect'), { status: 400 });
  }
  if (outcome.status === 'update_failed') {
    console.error('[account/password] update failed', outcome.reason);
    return NextResponse.json(authErrorBody('reset_failed'), { status: 500 });
  }

  /*
   * Tell the account holder it happened. This is the control that catches the
   * case the current-password prompt did not: someone who both held a session
   * AND knew the password. It goes out after the change, best effort — a mail
   * failure must not report the change as failed, because it did succeed and a
   * retry would then be rejected as `password_unchanged`.
   */
  try {
    const origin = resolveAuthOrigin(new URL(request.url).origin);
    const resetUrl = new URL('/auth?mode=forgot', origin).toString();
    const firstName =
      (user.user_metadata?.full_name as string | undefined)?.trim().split(/\s+/)[0] || undefined;

    const emailResult = await sendEmail({
      to: user.email,
      subject: 'Your GlowBal password was changed',
      html: passwordChangedEmail(resetUrl, firstName),
      text: `The password on your GlowBal account was changed, and every other signed-in device has been signed out. If this was not you, reset your password immediately at ${resetUrl}`,
      category: 'security',
      template: 'password-changed',
      userId: user.id,
      tags: { kind: 'password-changed' },
    });
    if (!emailResult.ok) {
      console.error('[account/password] notification not sent', emailResult.error);
    }
  } catch (err) {
    console.error('[account/password] notification failed', err);
  }

  return NextResponse.json({ ok: true });
}
