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
  enqueueApplicationPersonalReportGeneration,
  markApplicationPersonalReportGenerationComplete,
  retryApplicationPersonalReportGeneration,
} from './personal-report-generation-job-queue';

const JOB = {
  id: 'job-1', user_id: 'user-1', application_id: 'app-1', status: 'pending', trigger: 'manual', force_requested: false, attempts: 0,
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
    mocks.update.mockImplementation(() => ({
      eq: vi.fn(() => ({ select: vi.fn(() => ({ single: mocks.write })), error: null })),
    }));
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

  it('clears the lease and schedules retry after an AI failure', async () => {
    await retryApplicationPersonalReportGeneration('job-1', 2, 'AI_FAILED', 'Model response was invalid.');

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
});
