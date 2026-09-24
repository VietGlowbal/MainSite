import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

/**
 * The per-request Content Security Policy set by `src/proxy.ts`.
 *
 * The contract that matters: the nonce in the response's policy is the same one
 * forwarded on the request, because Next reads it off the request header to
 * stamp its own scripts. If the two ever disagree every page stops hydrating.
 */
const auth = vi.hoisted(() => ({
  getClaims: vi.fn(async () => ({ data: { claims: { sub: 'user-1' } }, error: null })),
}));

const completeProfile = vi.hoisted(() => ({
  onboarding_completed: true,
  study_level: 'undergraduate',
  preferred_countries: ['GB'],
  phone: '+84912345678',
  date_of_birth: '2002-08-09',
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth,
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: completeProfile, error: null }) }),
      }),
    }),
  }),
}));

import { proxy } from '@/proxy';

function nonceIn(policy: string | null): string | undefined {
  return policy?.match(/'nonce-([^']+)'/)?.[1];
}

describe('proxy Content Security Policy', () => {
  // A public marketing route returns early; a signed-in app route runs the gates.
  it.each(['/universities', '/dashboard'])('%s sends an enforced policy whose nonce reaches the renderer', async (route) => {
    const response = await proxy(new NextRequest(`http://localhost${route}`));

    const enforced = response.headers.get('content-security-policy');
    const nonce = nonceIn(enforced);
    expect(nonce).toBeTruthy();
    expect(nonceIn(response.headers.get('content-security-policy-report-only'))).toBe(nonce);

    // NextResponse.next({ request: { headers } }) forwards request overrides as
    // `x-middleware-request-*`; this is what the layout and renderer receive.
    expect(response.headers.get('x-middleware-request-x-nonce')).toBe(nonce);
    expect(response.headers.get('x-middleware-request-content-security-policy')).toBe(enforced);
  });

  it('issues a fresh nonce on every request', async () => {
    const first = await proxy(new NextRequest('http://localhost/universities'));
    const second = await proxy(new NextRequest('http://localhost/universities'));
    expect(nonceIn(first.headers.get('content-security-policy'))).not.toBe(
      nonceIn(second.headers.get('content-security-policy')),
    );
  });

  it('asks no CDN to cache a page that carries a nonce', async () => {
    const response = await proxy(new NextRequest('http://localhost/universities'));
    expect(response.headers.get('vercel-cdn-cache-control')).toBeNull();
  });

  it('leaves API routes alone', async () => {
    const response = await proxy(new NextRequest('http://localhost/api/health'));
    expect(response.headers.get('content-security-policy')).toBeNull();
  });
});
