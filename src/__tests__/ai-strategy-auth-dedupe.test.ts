import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guard for docs/performance.md fix 7.
 *
 * `supabase.auth.getUser()` is a round-trip to the Supabase Auth API on every
 * call. The `/ai-strategy/*` cluster used to make three of them per request —
 * the segment layout, the page, and `ApplicationNav`'s own fallback — which on
 * a Vietnamese connection is three serial trips to Singapore before the shell
 * can flush.
 *
 * `getServerIdentity()` replaces them with one React-`cache()`d read that
 * verifies the access token's ES256 signature locally against the cached JWKS.
 * It is not a weaker check: the project signs with asymmetric keys (verified
 * from a live token's `alg`/`kid` header), so a forged or tampered token fails
 * verification exactly as it would at the Auth API. If the project ever moves
 * back to the legacy HS256 shared secret, `getClaims()` transparently falls
 * back to calling the Auth server — correctness is preserved either way and
 * only the speed-up is lost.
 *
 * These are source-text assertions rather than behavioural ones on purpose: the
 * regression they catch is someone reintroducing the round-trip in a new page,
 * which no runtime test of the existing pages would see. Same pattern as
 * `application-document-pages-performance.test.ts`.
 */

function tsxFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...tsxFilesUnder(path));
    else if (entry.name.endsWith('.tsx') && !entry.name.includes('.test.')) out.push(path);
  }
  return out;
}

describe('/ai-strategy resolves the session once per request', () => {
  it('has no Auth API round-trip left anywhere in the cluster', () => {
    const offenders = tsxFilesUnder(join('src', 'app', 'ai-strategy')).filter((file) => {
      const source = readFileSync(file, 'utf8');
      // Ignore prose: the fix is explained in comments that name the old call.
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      return code.includes('auth.getUser()');
    });

    expect(offenders).toEqual([]);
  });

  it('threads the resolved id into ApplicationNav from the segment layout', () => {
    const layout = readFileSync(join('src', 'app', 'ai-strategy', '[applicationId]', 'layout.tsx'), 'utf8');

    expect(layout).toContain('getServerIdentity()');
    expect(layout).toContain('userId={user.id}');
  });

  it('gives ApplicationNav the cached identity as its own fallback', () => {
    const nav = readFileSync(join('src', 'components', 'application-nav.tsx'), 'utf8');
    const code = nav.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

    expect(code).toContain('getServerIdentity()');
    expect(code).not.toContain('auth.getUser()');
  });

  it('keeps the public pages that only need a signed-in flag off the Auth API', () => {
    // These render for anonymous visitors too, so the round-trip was pure cost
    // on the highest-traffic routes in the audit.
    const publicPages = [
      join('src', 'app', 'ai-strategy', 'page.tsx'),
      join('src', 'app', 'how-it-works', 'page.tsx'),
      join('src', 'app', 'plus', 'page.tsx'),
      join('src', 'app', 'universities', '[id]', 'page.tsx'),
      join('src', 'app', 'mentors', '[id]', 'page.tsx'),
    ];

    for (const page of publicPages) {
      const code = readFileSync(page, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      expect(code, `${page} should use getServerIdentity()`).toContain('getServerIdentity()');
      expect(code, `${page} should not call the Auth API`).not.toContain('auth.getUser()');
    }
  });
});
