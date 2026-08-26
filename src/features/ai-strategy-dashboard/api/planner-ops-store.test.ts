import { describe, expect, it, vi } from 'vitest';
import { claimPlannerGeneration, finishPlannerGeneration } from './planner-ops-store';

describe('Planner Ops generation lease boundary', () => {
  it('claims through the database lease RPC and returns a controlled concurrent result', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: 'run-1', error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    const client = { rpc } as never;
    await expect(claimPlannerGeneration(client, { applicationId: 'app-1', trigger: 'manual_refresh', sourceFingerprint: null })).resolves.toBe('run-1');
    await expect(claimPlannerGeneration(client, { applicationId: 'app-1', trigger: 'manual_refresh', sourceFingerprint: null })).resolves.toBeNull();
    expect(rpc).toHaveBeenCalledWith('claim_canonical_planner_generation', expect.objectContaining({ p_lease_seconds: 300 }));
  });

  it('releases the lease when a run finishes', async () => {
    const update = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }));
    const client = { from: vi.fn(() => ({ update })) } as never;
    await finishPlannerGeneration(client, 'run-1', { status: 'success', sourceFingerprint: 'fp' });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'success', lease_expires_at: null }));
  });
});
