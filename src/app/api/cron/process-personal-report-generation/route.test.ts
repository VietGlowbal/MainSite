import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authorized: vi.fn(), claim: vi.fn(), complete: vi.fn(), retry: vi.fn(), block: vi.fn(), regenerate: vi.fn(),
}));

vi.mock('@/lib/cron-auth', () => ({ isAuthorizedCron: mocks.authorized }));
vi.mock('@/features/apply/api', () => ({
  regeneratePersonalReport: mocks.regenerate,
  claimApplicationPersonalReportGenerations: mocks.claim,
  markApplicationPersonalReportGenerationComplete: mocks.complete,
  retryApplicationPersonalReportGeneration: mocks.retry,
  blockApplicationPersonalReportGeneration: mocks.block,
}));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn(() => ({})) }));

const JOB = { id: 'job-1', user_id: 'user-1', application_id: 'app-1', trigger: 'manual', force_requested: false, attempts: 2 };

describe('POST /api/cron/process-personal-report-generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorized.mockReturnValue(true);
    mocks.claim.mockResolvedValue([]);
  });

  it('rejects callers without cron authentication', async () => {
    const { POST } = await import('./route');
    mocks.authorized.mockReturnValue(false);
    expect((await POST(new Request('http://localhost/api/cron/process-personal-report-generation'))).status).toBe(401);
    expect(mocks.claim).not.toHaveBeenCalled();
  });

  it('persists completed report lineage', async () => {
    const { POST } = await import('./route');
    mocks.claim.mockResolvedValue([JOB]);
    mocks.regenerate.mockResolvedValue({
      status: 'regenerated',
      record: { id: 'report-1', confirmedSnapshotId: 'snapshot-1', inputHash: 'hash-1' },
    });

    expect((await POST(new Request('http://localhost/api/cron/process-personal-report-generation'))).status).toBe(200);
    expect(mocks.complete).toHaveBeenCalledWith('job-1', {
      reportVersionId: 'report-1', confirmedSnapshotId: 'snapshot-1', inputHash: 'hash-1',
    });
  });

  it('retries AI failures and blocks missing prerequisites', async () => {
    const { POST } = await import('./route');
    mocks.claim.mockResolvedValue([JOB, { ...JOB, id: 'job-2', attempts: 1 }]);
    mocks.regenerate
      .mockResolvedValueOnce({ status: 'error', message: 'invalid response', record: null })
      .mockResolvedValueOnce({ status: 'not_configured' });

    await POST(new Request('http://localhost/api/cron/process-personal-report-generation'));

    expect(mocks.retry).toHaveBeenCalledWith('job-1', 2, 'AI_GENERATION_FAILED', 'invalid response');
    expect(mocks.block).toHaveBeenCalledWith('job-2', 'NOT_CONFIGURED', expect.any(String));
  });

  it('blocks a job with no evidence instead of retrying it forever', async () => {
    const { POST } = await import('./route');
    mocks.claim.mockResolvedValue([JOB]);
    mocks.regenerate.mockResolvedValue({ status: 'insufficient_evidence' });

    await POST(new Request('http://localhost/api/cron/process-personal-report-generation'));

    expect(mocks.block).toHaveBeenCalledWith(
      'job-1',
      'INSUFFICIENT_EVIDENCE',
      expect.stringContaining('Add reflections'),
    );
    expect(mocks.retry).not.toHaveBeenCalled();
  });
});
