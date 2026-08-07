import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  getClaims: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth }),
}));

import { proxy } from '@/proxy';

describe('authenticated navigation performance', () => {
  beforeEach(() => {
    auth.getClaims.mockReset();
    auth.getUser.mockReset();
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
