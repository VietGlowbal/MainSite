/**
 * Password reset — redeeming a recovery token (server-only).
 *
 * Lives in the repository layer because it is the only slice allowed to reach
 * Supabase directly; the route handler orchestrates and does not talk to the
 * database itself (see `eslint.config.mjs`, NO_SERVER_DB).
 */
import { createClient } from '@/server/db/server';

export type ResetOutcome =
  | { status: 'ok' }
  /** Token was wrong, already used, or expired. Indistinguishable on purpose. */
  | { status: 'invalid_token' }
  | { status: 'update_failed'; reason: string };

/**
 * Redeems a recovery token and sets the new password in one step.
 *
 * `verifyOtp` both proves the caller holds the token from the reset email AND
 * establishes the session that `updateUser` then writes through. Doing them
 * together is the point: the password change is bound to possession of the
 * email, so an already-signed-in session on a shared machine cannot be used to
 * change the password without knowing the current one.
 *
 * The caller MUST validate the password before calling this. A recovery token
 * is single-use, so redeeming it and then rejecting a weak password would burn
 * the user's link and force them to request another email.
 */
export async function redeemRecoveryToken(token: string, password: string): Promise<ResetOutcome> {
  const supabase = await createClient();

  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: token,
    type: 'recovery',
  });
  if (verifyError) {
    return { status: 'invalid_token' };
  }

  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) {
    return { status: 'update_failed', reason: updateError.message };
  }

  return { status: 'ok' };
}
