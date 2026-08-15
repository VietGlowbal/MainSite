import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getManualPaymentConfig: vi.fn(() => ({ bankLabel: 'Bank', accountHolder: 'GlowBal', accountNumberMasked: '••••901', bankQrUrl: 'https://cdn.example.test/qr.png' })),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@/server/payments/manual-config', () => ({ getManualPaymentConfig: mocks.getManualPaymentConfig }));

import { GET } from './route';

function query(data: unknown) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => ({ data, error: null })),
  };
  return chain;
}

describe('GET /api/payments/manual/status', () => {
  it('uses the own review state after reload and does not allow a claimed transfer to be claimed again', async () => {
    const tx = query({ reference: 'GLOWMANUALABC123', provider: 'manual_bank_transfer', product_type: 'plus', status: 'pending', amount_vnd: 455000, expires_at: new Date(Date.now() + 60_000).toISOString() });
    const review = query({ transaction_id: 'tx-1', state: 'claimed', claimed_at: new Date().toISOString(), review_deadline_at: new Date(Date.now() + 60_000).toISOString() });
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })) }, from: vi.fn((table: string) => table === 'payment_transactions' ? tx : review) });
    const response = await GET(new NextRequest('https://glowbal.test/api/payments/manual/status?reference=GLOWMANUALABC123'));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.status).toBe('claimed');
    expect(body.status_label).toBe('Transfer reported — awaiting founder');
    expect(body.can_claim).toBe(false);
  });
});
