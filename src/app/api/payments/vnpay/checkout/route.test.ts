import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const { createClientMock, createAdminClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  createAdminClientMock: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: createAdminClientMock }));

import { POST } from './route';

function request(body: unknown) {
  return new Request('http://localhost/api/payments/vnpay/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe('POST /api/payments/vnpay/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VNPAY_TMN_CODE', 'LJ655PKA');
    vi.stubEnv('VNPAY_HASH_SECRET', 'secret');
    vi.stubEnv('VNPAY_PAYMENT_URL', 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html');
    createClientMock.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1', email: 'student@example.com' } } })) },
    });
    createAdminClientMock.mockReturnValue({});
  });

  it('rejects malformed JSON before authentication', async () => {
    const response = await POST(new Request('http://localhost/api/payments/vnpay/checkout', { method: 'POST', body: '{' }) as unknown as NextRequest);
    expect(response.status).toBe(400);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it('requires an authenticated user', async () => {
    createClientMock.mockResolvedValueOnce({ auth: { getUser: vi.fn(async () => ({ data: { user: null } })) } });
    const response = await POST(request({ product: 'plus', plan: 'plus-starter', idempotency_key: 'test-key-1' }));
    expect(response.status).toBe(401);
  });

  it('fails closed when VNPay server credentials are missing', async () => {
    vi.stubEnv('VNPAY_HASH_SECRET', '');
    const response = await POST(request({ product: 'plus', plan: 'plus-starter', idempotency_key: 'test-key-1' }));
    expect(response.status).toBe(503);
  });
});
