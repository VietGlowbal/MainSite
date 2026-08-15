import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { readFileSync } from 'node:fs';

const mocks = vi.hoisted(() => ({ authorizeManualReview: vi.fn(), sameOrigin: vi.fn(), loadManualReview: vi.fn(), dispatchDueManualPaymentJobs: vi.fn() }));
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: vi.fn((callback: () => unknown) => callback()),
}));
vi.mock('@/server/payments/manual-review-auth', () => ({ authorizeManualReview: mocks.authorizeManualReview, sameOrigin: mocks.sameOrigin, loadManualReview: mocks.loadManualReview }));
vi.mock('@/server/payments/manual-outbox', () => ({ dispatchDueManualPaymentJobs: mocks.dispatchDueManualPaymentJobs }));

import { POST as confirm } from './confirm/route';
import { POST as reject } from './reject/route';
import { GET as readReview } from './review/route';

describe('manual founder review security', () => {
  it('does not mutate on a read-only review GET when the capability is unavailable', async () => {
    vi.clearAllMocks();
    mocks.loadManualReview.mockResolvedValue(null);
    const response = await readReview(new NextRequest('https://glowbal.test/api/admin/payments/manual/review?token=bad'));
    expect(response.status).toBe(404);
    expect(mocks.loadManualReview).toHaveBeenCalledWith('bad');
    expect(mocks.dispatchDueManualPaymentJobs).not.toHaveBeenCalled();
  });

  it('rejects unauthorized confirm and reject without calling the RPC', async () => {
    mocks.sameOrigin.mockReturnValue(true);
    mocks.authorizeManualReview.mockResolvedValue(null);
    const request = () => new NextRequest('https://glowbal.test/api/admin/payments/manual/confirm', { method: 'POST', body: JSON.stringify({ token: 'bad' }), headers: { 'content-type': 'application/json', origin: 'https://glowbal.test' } });
    expect((await confirm(request())).status).toBe(403);
    expect((await reject(new NextRequest('https://glowbal.test/api/admin/payments/manual/reject', { method: 'POST', body: JSON.stringify({ token: 'bad' }), headers: { 'content-type': 'application/json', origin: 'https://glowbal.test' } }))).status).toBe(403);
  });

  it('does not report a founder confirmation as successful when fulfilment failed', async () => {
    vi.clearAllMocks();
    mocks.sameOrigin.mockReturnValue(true);
    mocks.dispatchDueManualPaymentJobs.mockResolvedValue(0);
    mocks.authorizeManualReview.mockResolvedValue({
      userId: 'founder-id',
      reviewId: 'review-id',
      tokenVersion: 1,
      admin: {
        rpc: vi.fn().mockResolvedValue({
          data: { status: 'paid_unfulfilled', error_code: '23514' },
          error: null,
        }),
      },
    });

    const response = await confirm(new NextRequest(
      'https://glowbal.test/api/admin/payments/manual/confirm',
      {
        method: 'POST',
        body: JSON.stringify({ token: 'valid-token' }),
        headers: {
          'content-type': 'application/json',
          origin: 'https://glowbal.test',
        },
      },
    ));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      status: 'paid_unfulfilled',
      error: 'Payment received but access could not be activated',
    });
    expect(mocks.dispatchDueManualPaymentJobs).not.toHaveBeenCalled();
  });

  it('keeps the legacy admin review endpoint from reporting failed fulfilment as success', () => {
    const route = readFileSync(
      'src/app/api/admin/payments/review-action/route.ts',
      'utf8',
    );
    expect(route).toContain("status === 'paid_unfulfilled'");
    expect(route).toContain('Payment received but access could not be activated');
    expect(route).toMatch(/status:\s*409/);
  });

});
