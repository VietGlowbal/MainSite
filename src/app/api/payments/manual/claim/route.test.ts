import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  dispatchDueManualPaymentJobs: vi.fn(),
}));
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return { ...actual, after: (callback: () => unknown) => callback() };
});
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock('@/server/payments/manual-outbox', () => ({ dispatchDueManualPaymentJobs: mocks.dispatchDueManualPaymentJobs }));

import { POST } from './route';

describe('POST /api/payments/manual/claim', () => {
  it('requires same-origin requests before recording the claim', async () => {
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })) } });
    const rpc = vi.fn();
    mocks.createAdminClient.mockReturnValue({ rpc });
    const response = await POST(new NextRequest('https://glowbal.test/api/payments/manual/claim', { method: 'POST', body: JSON.stringify({ reference: 'GLOWMANUALABC123' }), headers: { 'content-type': 'application/json' } }));
    expect(response.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('dispatches a full due batch so a failed student email cannot block the founder email', async () => {
    mocks.dispatchDueManualPaymentJobs.mockResolvedValue(1);
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })) },
    });
    mocks.createAdminClient.mockReturnValue({
      rpc: vi.fn(async () => ({
        data: { ok: true, status: 'claimed', review_deadline_at: '2026-08-16T00:00:00.000Z' },
        error: null,
      })),
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: null })),
          })),
        })),
      })),
    });

    const response = await POST(new NextRequest('https://glowbal.test/api/payments/manual/claim', {
      method: 'POST',
      body: JSON.stringify({ reference: 'GLOWMANUALABC123' }),
      headers: { 'content-type': 'application/json', origin: 'https://glowbal.test' },
    }));

    expect(response.status).toBe(200);
    expect(mocks.dispatchDueManualPaymentJobs).toHaveBeenCalledWith(10);
  });
});
