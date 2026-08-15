import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }));

import { POST } from './route';

function request(body: unknown, origin = 'https://glowbal.test') {
  return new NextRequest('https://glowbal.test/api/plus/redeem', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', origin },
  });
}

function signedIn(rpc = vi.fn()) {
  mocks.createClient.mockResolvedValue({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })) },
  });
  mocks.createAdminClient.mockReturnValue({ rpc });
  return rpc;
}

describe('POST /api/plus/redeem', () => {
  it('rejects cross-origin promo redemption before authentication', async () => {
    const response = await POST(request(
      { code: 'gogogogoglowbal', plan: 'plus-pro' },
      'https://attacker.test',
    ));

    expect(response.status).toBe(403);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('rejects an invalid promo without calling the grant RPC', async () => {
    const rpc = signedIn();
    const response = await POST(request({ code: 'wrong-code', plan: 'plus-pro' }));

    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects the retired promo code', async () => {
    const rpc = signedIn();
    const response = await POST(request({ code: 'glowbalglowbal', plan: 'plus-pro' }));

    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('atomically grants the selected plan to the authenticated user', async () => {
    const rpc = signedIn(vi.fn(async () => ({
      data: { ok: true, plan: 'plus-pro', expires_at: '2027-08-15T00:00:00Z' },
      error: null,
    })));
    const response = await POST(request({ code: '  GOGOGOGOGLOWBAL ', plan: 'plus-pro' }));

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('redeem_plus_promo', {
      p_user_id: 'user-1',
      p_campaign: 'gogogogoglowbal-v2',
      p_plan: 'plus-pro',
    });
  });

  it('does not grant the same campaign to one account twice', async () => {
    signedIn(vi.fn(async () => ({
      data: { ok: false, reason: 'already_redeemed' },
      error: null,
    })));
    const response = await POST(request({ code: 'gogogogoglowbal', plan: 'plus-pro' }));

    expect(response.status).toBe(409);
  });
});
