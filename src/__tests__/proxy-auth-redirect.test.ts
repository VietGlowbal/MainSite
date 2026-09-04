import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The `/auth/*` exemptions in `src/proxy.ts`.
 *
 * A signed-in user is normally bounced off the auth pages, which is right for a
 * sign-in form and wrong for the three screens below. The reset page is the one
 * that bites: the redirect ALSO clears the query string, so a recovery token
 * arriving in a signed-in browser is not deferred but destroyed, and the
 * single-use link has to be requested again.
 *
 * It is reachable in normal use, not a corner case — the "set a password" card
 * on /profile/security mails the link to a user who is signed in by definition.
 */
const auth = vi.hoisted(() => ({
  getClaims: vi.fn(),
  getUser: vi.fn(),
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

describe('signed-in redirect away from /auth', () => {
  beforeEach(() => {
    auth.getClaims.mockReset();
    auth.getUser.mockReset();
    auth.getClaims.mockResolvedValue({ data: { claims: { sub: 'user-1' } }, error: null });
    auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  });

  it('bounces a signed-in user off the sign-in page', async () => {
    const response = await proxy(new NextRequest('http://localhost/auth'));

    expect(response.headers.get('location')).toBe('http://localhost/apply');
  });

  it('lets a signed-in user open a recovery link, token intact', async () => {
    const response = await proxy(
      new NextRequest('http://localhost/auth/reset-password?token=abc123'),
    );

    // No redirect at all — not even one that preserves the query. The page has
    // to render for the token to be posted to the confirm route.
    expect(response.headers.get('location')).toBeNull();
  });

  it('leaves the callback and complete-profile exemptions alone', async () => {
    for (const pathname of ['/auth/callback', '/auth/complete-profile']) {
      const response = await proxy(new NextRequest(`http://localhost${pathname}`));
      expect(response.headers.get('location')).toBeNull();
    }
  });

  it('still honours an explicit redirect target from the sign-in page', async () => {
    const response = await proxy(new NextRequest('http://localhost/auth?redirect=/profile'));

    expect(response.headers.get('location')).toBe('http://localhost/profile');
  });
});
