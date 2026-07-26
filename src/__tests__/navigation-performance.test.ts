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

  it('validates the session locally instead of fetching the user over the network', async () => {
    await proxy(new NextRequest('http://localhost/universities'));

    expect(auth.getClaims).toHaveBeenCalledOnce();
    expect(auth.getUser).not.toHaveBeenCalled();
  });

  it('provides an immediate loading boundary for the Apply route', () => {
    expect(existsSync(path.join(process.cwd(), 'src/app/apply/loading.tsx'))).toBe(true);
  });

  it('does not reload role flags for duplicate auth events from the same user', () => {
    const nav = readFileSync(
      path.join(process.cwd(), 'src/components/nav-reveal.tsx'),
      'utf8',
    );

    expect(nav).toContain('if (loadedUserId.current === authUser.id) return;');
  });
});
