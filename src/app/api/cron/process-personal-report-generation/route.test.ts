import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ authorized: vi.fn(), process: vi.fn() }));

vi.mock('@/lib/cron-auth', () => ({ isAuthorizedCron: mocks.authorized }));
vi.mock('@/features/apply/api', () => ({
  DEFAULT_PERSONAL_REPORT_GENERATION_BATCH: 2,
  MAX_PERSONAL_REPORT_GENERATION_BATCH: 5,
  processApplicationPersonalReportGenerations: mocks.process,
}));

describe('POST /api/cron/process-personal-report-generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorized.mockReturnValue(true);
    mocks.process.mockResolvedValue({ claimed: 0, complete: 0, retry: 0, blocked: 0 });
  });

  it('rejects callers without cron authentication', async () => {
    const { POST } = await import('./route');
    mocks.authorized.mockReturnValue(false);
    expect((await POST(new Request('http://localhost/api/cron/process-personal-report-generation'))).status).toBe(401);
    expect(mocks.process).not.toHaveBeenCalled();
  });

  it('uses the default durable-worker batch and returns its outcome', async () => {
    const { POST } = await import('./route');
    mocks.process.mockResolvedValue({ claimed: 1, complete: 1, retry: 0, blocked: 0 });

    const response = await POST(new Request('http://localhost/api/cron/process-personal-report-generation'));
    expect(mocks.process).toHaveBeenCalledWith(2);
    await expect(response.json()).resolves.toEqual({ claimed: 1, complete: 1, retry: 0, blocked: 0 });
  });

  it('clamps requested batches to the worker maximum', async () => {
    const { POST } = await import('./route');
    await POST(new Request('http://localhost/api/cron/process-personal-report-generation?batch=999'));
    expect(mocks.process).toHaveBeenCalledWith(5);
  });
});
