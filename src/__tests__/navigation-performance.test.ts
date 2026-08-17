import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  getClaims: vi.fn(),
  getUser: vi.fn(),
}));

/** Records every table the proxy reads, so the gates' cost stays measurable. */
const tableRead = vi.hoisted(() => vi.fn());

/**
 * A student who is past both gates, so the proxy runs to completion rather than
 * short-circuiting into a redirect.
 */
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
    from: (table: string) => {
      tableRead(table);
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: completeProfile, error: null }) }),
        }),
      };
    },
  }),
}));

import { proxy } from '@/proxy';

describe('authenticated navigation performance', () => {
  beforeEach(() => {
    auth.getClaims.mockReset();
    auth.getUser.mockReset();
    tableRead.mockReset();
    auth.getClaims.mockResolvedValue({
      data: { claims: { sub: 'user-1' } },
      error: null,
    });
    auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
  });

  it('skips auth entirely for guest-first marketing routes', async () => {
    await proxy(new NextRequest('http://localhost/universities'));

    expect(auth.getClaims).not.toHaveBeenCalled();
    expect(auth.getUser).not.toHaveBeenCalled();
  });

  it('validates protected routes locally instead of fetching the user over the network', async () => {
    await proxy(new NextRequest('http://localhost/dashboard'));

    expect(auth.getClaims).toHaveBeenCalledOnce();
    expect(auth.getUser).not.toHaveBeenCalled();
  });

  /*
   * The contact-details gate (2026-08-17) widened the proxy's profile read from
   * the three onboarding-gated routes to every protected route — /dashboard and
   * /admin previously reached the app on `getClaims` alone and now pay one
   * indexed lookup on `user_id` as well. That was the deliberate price of a
   * hard gate that a student cannot sidestep by typing a different URL.
   *
   * What must not regress is the read becoming *two* reads: the two gates want
   * overlapping columns off the same row and share a single select. These tests
   * pin both halves — that the cost exists, and that it is exactly one.
   */
  it('pays exactly one profile read on a gated route, shared by both gates', async () => {
    await proxy(new NextRequest('http://localhost/apply'));

    expect(tableRead).toHaveBeenCalledTimes(1);
    expect(tableRead).toHaveBeenCalledWith('student_profiles');
  });

  it('pays exactly one profile read on a protected route the onboarding gate ignores', async () => {
    await proxy(new NextRequest('http://localhost/dashboard'));

    expect(tableRead).toHaveBeenCalledTimes(1);
  });

  /*
   * These four authenticate inside their own server components rather than via
   * PROTECTED_ROUTES, so a gate built from that list alone left them reachable
   * by typing the URL. `/universities` is an exact-match public route, which is
   * what lets its `/matches` child reach the gate at all.
   */
  it.each(['/ai-strategy/personal-report', '/scholarships', '/universities/matches', '/onboarding'])(
    'gates %s, which enforces auth in its own page rather than in PROTECTED_ROUTES',
    async (route) => {
      await proxy(new NextRequest(`http://localhost${route}`));
      expect(tableRead).toHaveBeenCalledWith('student_profiles');
    },
  );

  it('leaves payment returns ungated so a paid-for confirmation is never bounced', async () => {
    await proxy(new NextRequest('http://localhost/plus/success'));
    expect(tableRead).not.toHaveBeenCalled();
  });

  it('reads no profile at all for a guest, or on a public route', async () => {
    auth.getClaims.mockResolvedValue({ data: { claims: {} }, error: null });
    await proxy(new NextRequest('http://localhost/dashboard'));
    expect(tableRead).not.toHaveBeenCalled();

    await proxy(new NextRequest('http://localhost/universities'));
    expect(tableRead).not.toHaveBeenCalled();
  });

  it('provides an immediate loading boundary for the Apply route', () => {
    expect(existsSync(path.join(process.cwd(), 'src/app/apply/loading.tsx'))).toBe(true);
  });

  it('uses one auth source and deduplicates completion reads for the same user', () => {
    const nav = readFileSync(
      path.join(process.cwd(), 'src/components/nav-reveal.tsx'),
      'utf8',
    );
    const session = readFileSync(
      path.join(process.cwd(), 'src/components/navigation-session.tsx'),
      'utf8',
    );

    expect(nav).not.toContain('auth.getUser');
    expect(nav).not.toContain('onAuthStateChange');
    expect(session).toContain('if (currentUserId === authUser.id)');
  });
});
