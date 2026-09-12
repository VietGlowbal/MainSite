import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ admin: vi.fn(), rpc: vi.fn(), recoveryRead: vi.fn() }));

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.admin }));

import { claimPendingJobs } from './job-queue';

describe('claimPendingJobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.recoveryRead.mockResolvedValue({ data: [], error: null });
    mocks.admin.mockReturnValue({
      rpc: mocks.rpc,
      from: vi.fn(() => ({
        select: vi.fn(() => ({ eq: vi.fn(() => ({ eq: () => mocks.recoveryRead() })) })),
      })),
    });
  });

  it('recovers jobs already claimed when the gateway loses the RPC response', async () => {
    const job = { id: 'job-1' };
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'Gateway Timeout' } });
    mocks.recoveryRead.mockResolvedValue({ data: [job], error: null });

    await expect(claimPendingJobs('worker-1', 5)).resolves.toEqual([job]);
    expect(mocks.rpc).toHaveBeenCalledOnce();
    expect(mocks.recoveryRead).toHaveBeenCalledOnce();
  });
});
