import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { authErrorBody, PASSWORD_MAX_LENGTH, validatePassword } from '@/features/auth/domain';
import { checkPasswordBreach, redeemRecoveryToken } from '@/features/auth/api';
import { passwordResetLimiter } from '@/lib/rate-limiter';

/**
 * POST /api/auth/reset-password/confirm — set a new password.
 *
 * Takes the recovery token from the emailed link and the new password together.
 * The token is redeemed here rather than at an earlier redirect, so changing
 * the password requires holding the email at that moment — being signed in on
 * the machine is not enough. See `../route.ts` for why.
 *
 * THE ORDER OF THE THREE CHECKS BELOW IS DELIBERATE. A recovery token is
 * single-use: redeeming it first and then rejecting the password would burn the
 * user's link and make them ask for another email just because they picked
 * something too short. So both password checks run BEFORE the token is spent.
 */
const BodySchema = z.object({
  token: z.string().min(1).max(512),
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
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
  const { token, password } = parsed.data;

  // Guessing a token is infeasible, but an unlimited endpoint that runs a
  // network call and a Supabase write per request is still worth bounding.
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!passwordResetLimiter.checkLimit(`confirm-ip:${ip}`).allowed) {
    return NextResponse.json(authErrorBody('rate_limited'), { status: 429 });
  }

  // 1. Cheap, local rules.
  const problem = validatePassword(password);
  if (problem) {
    return NextResponse.json(authErrorBody(problem.code, problem.vars), { status: 400 });
  }

  // 2. Breach corpus. Fails OPEN exactly as sign-up does — see
  //    `features/auth/api/pwned-passwords.ts`. A reset must not be blocked
  //    because HIBP is unreachable; the user is mid-lockout already.
  const breach = await checkPasswordBreach(password);
  if (breach.status === 'breached') {
    return NextResponse.json(authErrorBody('password_breached'), { status: 400 });
  }
  if (breach.status === 'unavailable') {
    console.warn('[auth/reset-password/confirm] breach check skipped', breach.reason);
  }

  // 3. Only now spend the token.
  const outcome = await redeemRecoveryToken(token, password);

  if (outcome.status === 'invalid_token') {
    return NextResponse.json(authErrorBody('reset_link_invalid'), { status: 400 });
  }
  if (outcome.status === 'update_failed') {
    console.error('[auth/reset-password/confirm] update failed', outcome.reason);
    return NextResponse.json(authErrorBody('reset_failed'), { status: 500 });
  }

  // `redeemRecoveryToken` left a valid session in the cookies, so the client can
  // go straight to the app rather than asking for the password just set.
  return NextResponse.json({ ok: true });
}
