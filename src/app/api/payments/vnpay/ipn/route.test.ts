import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signVnpayParams } from '@/lib/payments/vnpay';

const { createAdminClientMock, rpcMock } = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: createAdminClientMock }));

import { GET } from './route';

function signedUrl(overrides: Record<string, string> = {}) {
  const params = {
    vnp_TmnCode: 'LJ655PKA',
    vnp_TxnRef: 'GLOW-TEST-1',
    vnp_Amount: '12500000',
    vnp_ResponseCode: '00',
    vnp_TransactionStatus: '00',
    ...overrides,
  };
  const hash = signVnpayParams(params, 'secret');
  return `http://localhost/api/payments/vnpay/ipn?${new URLSearchParams({ ...params, vnp_SecureHash: hash })}`;
}

describe('GET /api/payments/vnpay/ipn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VNPAY_TMN_CODE', 'LJ655PKA');
    vi.stubEnv('VNPAY_HASH_SECRET', 'secret');
    vi.stubEnv('VNPAY_PAYMENT_URL', 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html');
    rpcMock.mockResolvedValue({ data: { rsp_code: '00', message: 'Confirm Success' }, error: null });
    createAdminClientMock.mockReturnValue({ rpc: rpcMock });
  });

  it('rejects a tampered callback before touching the database', async () => {
    const response = await GET(new Request(`${signedUrl()}&vnp_Amount=1`) as never);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ RspCode: '97', Message: 'Checksum failed' });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('passes a valid callback to the idempotent fulfilment function', async () => {
    const response = await GET(new Request(signedUrl()) as never);
    expect(await response.json()).toEqual({ RspCode: '00', Message: 'Confirm Success' });
    expect(rpcMock).toHaveBeenCalledWith('process_vnpay_ipn', expect.objectContaining({
      p_reference: 'GLOW-TEST-1',
      p_amount: 12500000,
      p_response_code: '00',
      p_transaction_status: '00',
    }));
  });
});
