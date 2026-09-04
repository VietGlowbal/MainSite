/**
 * Have I Been Pwned — breached-password check via the k-anonymity range API.
 *
 * This is the compensating control for Supabase's "leaked password protection"
 * toggle, which is OFF and is an organisation-owner setting we cannot reach
 * (`docs/known-issues.md §0i`). Same idea, same corpus, running in code we own.
 *
 * THE PASSWORD NEVER LEAVES THIS PROCESS. It is hashed locally with SHA-1 and
 * only the first FIVE hex characters of that digest go over the wire. HIBP
 * replies with every breached suffix sharing the prefix and the match is made
 * here. A 5-hex-character prefix has ~1M sibling hashes, so the request
 * identifies nothing. This is the documented, intended use of the endpoint —
 * do not "simplify" it by sending the full hash or the password itself.
 *
 * SHA-1 is not a security choice here and is not a weakness: it is the digest
 * HIBP's corpus is indexed by. It is used as a lookup key, never to store or
 * verify a credential — Supabase still hashes the real password with bcrypt.
 */
import { countBreaches, splitHashForRange } from '../domain/password';

const RANGE_ENDPOINT = 'https://api.pwnedpasswords.com/range/';
const DEFAULT_TIMEOUT_MS = 2500;

export type BreachCheck =
  | { status: 'clean' }
  | { status: 'breached'; count: number }
  /**
   * The check could not be completed. Callers MUST decide explicitly what to do
   * with this; it is a distinct state precisely so that "we could not tell" can
   * never be mistaken for "we checked and it was fine".
   */
  | { status: 'unavailable'; reason: string };

export interface BreachCheckDeps {
  /** Injectable so tests never touch the network. */
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

/** Uppercase hex SHA-1, via Web Crypto so this works on Node and Edge alike. */
async function sha1Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

/**
 * Looks the password up in the breach corpus.
 *
 * Never throws: every failure path returns `unavailable`. A sign-up flow must
 * not break because a third-party API is slow, rate-limiting us, or down.
 */
export async function checkPasswordBreach(
  password: string,
  deps: BreachCheckDeps = {},
): Promise<BreachCheck> {
  const doFetch = deps.fetch ?? globalThis.fetch;
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  try {
    const { prefix, suffix } = splitHashForRange(await sha1Hex(password));

    const response = await doFetch(`${RANGE_ENDPOINT}${prefix}`, {
      method: 'GET',
      headers: {
        // Makes HIBP pad the response with synthetic zero-count rows so its
        // SIZE stops correlating with how many real matches the prefix had.
        // `countBreaches` discards those rows.
        'Add-Padding': 'true',
        Accept: 'text/plain',
        'User-Agent': 'GlowBal-signup-breach-check',
      },
      signal: AbortSignal.timeout(timeoutMs),
      // The corpus changes rarely and the prefix is not user-identifying, but a
      // cached 404/500 would be poison. Let the platform decide nothing for us.
      cache: 'no-store',
    });

    if (!response.ok) {
      return { status: 'unavailable', reason: `hibp_http_${response.status}` };
    }

    const count = countBreaches(await response.text(), suffix);
    return count > 0 ? { status: 'breached', count } : { status: 'clean' };
  } catch (error) {
    const reason = error instanceof Error ? error.name : 'unknown';
    return { status: 'unavailable', reason: `hibp_${reason}` };
  }
}
