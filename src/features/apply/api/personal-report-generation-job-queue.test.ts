import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  read: vi.fn(),
  write: vi.fn(),
  update: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.admin }));

import {
  consumeApplicationPersonalReportGenerationForce,
  enqueueApplicationPersonalReportGeneration,
  MAX_AUTOMATIC_RETRIES,
  markApplicationPersonalReportGenerationComplete,
  retryApplicationPersonalReportGeneration,
} from './personal-report-generation-job-queue';

const JOB = {
  id: 'job-1', user_id: 'user-1', application_id: 'app-1', status: 'pending', trigger: 'manual', force_requested: false, attempts: 0,
  idempotency_key: null,
  next_attempt_at: '2026-08-27T00:00:00.000Z', locked_at: null, locked_by: null,
  confirmed_snapshot_id: null, input_hash: null, report_version_id: null,
  error_code: null, error_message: null, created_at: '2026-08-27T00:00:00.000Z',
  updated_at: '2026-08-27T00:00:00.000Z', completed_at: null,
};

function client() {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: mocks.read })) })) })),
      insert: vi.fn(() => ({ select: vi.fn(() => ({ single: mocks.write })) })),
      update: mocks.update,
    })),
  };
}

describe('personal-report-generation-job-queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.read.mockResolvedValue({ data: null, error: null });
    mocks.write.mockResolvedValue({ data: JOB, error: null });
    mocks.update.mockImplementation(() => {
      const chain: Record<string, unknown> = {
        error: null,
        eq: vi.fn(() => chain),
        select: vi.fn(() => chain),
        single: mocks.write,
        maybeSingle: async () => ({ data: { id: 'job-1' }, error: null }),
      };
      return chain;
    });
    mocks.admin.mockReturnValue({ from: client().from, rpc: mocks.rpc });
  });

  it('does not reset an active job when the client requests generation again', async () => {
    const active = { ...JOB, status: 'processing', attempts: 2 };
    mocks.read.mockResolvedValue({ data: active, error: null });
    const supabase = client();

    const result = await enqueueApplicationPersonalReportGeneration(supabase as never, {
      userId: 'user-1', applicationId: 'app-1', trigger: 'manual',
    });

    expect(result).toEqual({ job: active, migrationMissing: false });
    expect(mocks.write).not.toHaveBeenCalled();
  });

  it('inserts a pending job when none exists', async () => {
    const supabase = client();
    const result = await enqueueApplicationPersonalReportGeneration(supabase as never, {
      userId: 'user-1', applicationId: 'app-1', trigger: 'manual',
    });

    expect(result).toEqual({ job: JOB, migrationMissing: false });
    expect(mocks.write).toHaveBeenCalledOnce();
  });

  it('runs a forced retry immediately instead of preserving its backoff', async () => {
    const retry = { ...JOB, status: 'retry', next_attempt_at: '2099-01-01T00:00:00.000Z' };
    mocks.read.mockResolvedValue({ data: retry, error: null });
    const result = await enqueueApplicationPersonalReportGeneration(client() as never, {
      userId: 'user-1', applicationId: 'app-1', trigger: 'manual', force: true,
    });

    expect(result.job).toEqual(JOB);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'pending', force_requested: false, next_attempt_at: expect.any(String),
      error_code: null, error_message: null,
    }));
  });

  it('clears the lease and schedules retry after an AI failure', async () => {
    await expect(retryApplicationPersonalReportGeneration('job-1', 2, 'AI_FAILED', 'Model response was invalid.')).resolves.toBe('retry');

    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'retry', locked_at: null, locked_by: null, error_code: 'AI_FAILED',
      next_attempt_at: expect.any(String),
    }));
  });

  it('records the completed report lineage', async () => {
    await markApplicationPersonalReportGenerationComplete('job-1', {
      reportVersionId: 'report-1', confirmedSnapshotId: 'snapshot-1', inputHash: 'hash-1',
    });

    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'complete', report_version_id: 'report-1', confirmed_snapshot_id: 'snapshot-1', input_hash: 'hash-1',
    }));
  });

  it('treats a repeated idempotency key as a no-op even after completion', async () => {
    const complete = { ...JOB, status: 'complete', idempotency_key: 'request-1' };
    mocks.read.mockResolvedValue({ data: complete, error: null });

    const result = await enqueueApplicationPersonalReportGeneration(client() as never, {
      userId: 'user-1', applicationId: 'app-1', trigger: 'manual', idempotencyKey: 'request-1',
    });

    expect(result.job).toEqual(complete);
    expect(mocks.write).not.toHaveBeenCalled();
  });

  it('requeues a force request that arrives while a worker completes', async () => {
    mocks.update
      .mockImplementationOnce(() => {
        const chain: Record<string, unknown> = { error: null, eq: vi.fn(() => chain), select: vi.fn(() => chain), maybeSingle: async () => ({ data: null, error: null }) };
        return chain;
      })
      .mockImplementationOnce(() => {
        const chain: Record<string, unknown> = { error: null, eq: vi.fn(() => chain) };
        return chain;
      });

    await markApplicationPersonalReportGenerationComplete('job-1', {
      reportVersionId: 'report-1', confirmedSnapshotId: 'snapshot-1', inputHash: 'hash-1',
    });

    expect(mocks.update).toHaveBeenCalledTimes(2);
    expect(mocks.update.mock.calls[1]![0]).toMatchObject({ status: 'pending', completed_at: null });
  });

  it('blocks after five automatic retries', async () => {
    await expect(retryApplicationPersonalReportGeneration(
      'job-1',
      MAX_AUTOMATIC_RETRIES + 1,
      'AI_FAILED',
      'Model response was invalid.',
    )).resolves.toBe('blocked');

    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'blocked',
      force_requested: false,
      error_code: 'MAX_RETRIES_EXCEEDED',
      completed_at: expect.any(String),
    }));
  });

  it('consumes a forced run marker before generation', async () => {
    await consumeApplicationPersonalReportGenerationForce({
      ...JOB,
      status: 'processing',
      force_requested: true,
      locked_by: 'worker-1',
    });

    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      force_requested: false,
      updated_at: expect.any(String),
    }));
  });
});
