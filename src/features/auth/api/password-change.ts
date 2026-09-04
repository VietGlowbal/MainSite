/**
 * Changing your own password while signed in (server-only).
 *
 * The sibling of `./password-reset`, for the case where the user still knows
 * their password and simply wants a new one. It lives in the repository layer
 * for the same reason: this is the only slice allowed to reach Supabase.
 *
 * ─── WHY THIS ASKS FOR THE CURRENT PASSWORD ─────────────────────────────────
 *
 * `supabase.auth.updateUser({ password })` needs nothing but a session, and
 * Supabase's "secure password change" project setting — which would require a
 * recent re-authentication — is an organisation-owner toggle we cannot reach
 * (the same permission wall as leaked-password protection, `docs/known-issues.md
 * §0i`). Without a current-password prompt, anyone who reaches an unlocked
 * browser, or replays a stolen session cookie, can set a password of their
 * choosing and convert temporary access into permanent account ownership —
 * locking the real owner out of their own applications.
 *
 * So the check is done here instead, and the session alone is never enough.
 */
import { createClient as createStandaloneClient } from '@supabase/supabase-js';
import { createClient } from '@/server/db/server';

export type PasswordChangeOutcome =
  | { status: 'ok' }
  /** The current password did not verify. */
  | { status: 'wrong_password' }
  | { status: 'update_failed'; reason: string };

export interface PasswordChangeInput {
  /** Taken from the verified session by the caller — never from the request body. */
  email: string;
  currentPassword: string;
  newPassword: string;
}

/**
 * Verifies the current password, then sets the new one and cuts every other
 * session loose.
 *
 * The caller MUST have validated `newPassword` first (length, breach corpus,
 * different from the current one). Nothing below re-checks it.
 */
export async function changeOwnPassword({
  email,
  currentPassword,
  newPassword,
}: PasswordChangeInput): Promise<PasswordChangeOutcome> {
  /*
   * Step 1 — prove the current password, on a client that owns no cookies.
   *
   * `signInWithPassword` is the only way to check a password against Supabase;
   * there is no "verify" endpoint. Running it on the request's cookie-bound
   * client would rewrite the caller's session cookies mid-request as a side
   * effect of a check that is supposed to be read-only, so this uses a separate
   * client with `persistSession: false` — its tokens live in memory for the
   * duration of the call and never touch the response.
   */
  const verifier = createStandaloneClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );

  const { error: signInError } = await verifier.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (signInError) {
    return { status: 'wrong_password' };
  }

  /*
   * A successful check still minted a real refresh token on Supabase's side.
   * `scope: 'local'` revokes exactly that one — it is a server call, not just a
   * local cleanup — so a verification does not leave a usable credential behind
   * for the rest of its 30-day life. Best effort: step 3 sweeps up anything
   * that survives here anyway.
   */
  const { error: verifierSignOutError } = await verifier.auth.signOut({ scope: 'local' });
  if (verifierSignOutError) {
    console.warn('[auth/password-change] verifier session not revoked', verifierSignOutError.message);
  }

  // Step 2 — the actual change, on the caller's own session.
  const supabase = await createClient();
  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) {
    return { status: 'update_failed', reason: updateError.message };
  }

  /*
   * Step 3 — revoke every OTHER session, keeping this one.
   *
   * This is the point of the whole exercise. A password is changed because it
   * may be known to someone else; if the sessions that person already holds
   * keep working, the change has protected nothing — refresh tokens outlive the
   * password that created them. `scope: 'others'` deliberately spares the
   * caller's own session, so the user is not signed out of the tab they are
   * standing in the moment they secure their account.
   *
   * Failure here is logged, not returned: the password IS changed by now, and
   * telling the user it failed would send them round again for no gain.
   */
  const { error: revokeError } = await supabase.auth.signOut({ scope: 'others' });
  if (revokeError) {
    console.error('[auth/password-change] other sessions not revoked', revokeError.message);
  }

  return { status: 'ok' };
}
