import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  rpc: vi.fn(),
  recoveryRead: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.admin }));

import { claimPendingJobs, reapStaleParseJobs } from './job-queue';

describe('course-parser job-queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.recoveryRead.mockResolvedValue({ data: [], error: null });
  });

  describe('claimPendingJobs', () => {
    it('recovers jobs already claimed when the gateway loses the RPC response', async () => {
      const job = { id: 'job-1' };
      mocks.rpc.mockResolvedValue({ data: null, error: { message: 'Gateway Timeout' } });
      mocks.recoveryRead.mockResolvedValue({ data: [job], error: null });

      mocks.admin.mockReturnValue({
        rpc: mocks.rpc,
        from: vi.fn(() => ({
          select: vi.fn(() => ({ eq: vi.fn(() => ({ eq: () => mocks.recoveryRead() })) })),
        })),
      });

      await expect(claimPendingJobs('worker-1', 5)).resolves.toEqual([job]);
      expect(mocks.rpc).toHaveBeenCalledOnce();
      expect(mocks.recoveryRead).toHaveBeenCalledOnce();
    });
  });

  describe('reapStaleParseJobs', () => {
    it('recovers stale processing jobs within retry budget and resets application to pending', async () => {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const staleJob = {
        id: 'job-stale-1',
        application_id: 'app-1',
        status: 'processing',
        attempts: 1,
        max_attempts: 3,
        started_at: tenMinutesAgo,
        updated_at: tenMinutesAgo,
        error_message: null,
      };

      const createJobUpdateChain = (jobId: string) => {
        const chain: { eq: ReturnType<typeof vi.fn>; select: ReturnType<typeof vi.fn>; then: (resolve: (v: unknown) => unknown) => Promise<unknown> } = {
          eq: vi.fn(() => chain),
          select: vi.fn().mockResolvedValue({ data: [{ id: jobId, status: 'processing' }], error: null }),
          then: (resolve) => Promise.resolve({ data: [{ id: jobId, status: 'processing' }], error: null }).then(resolve),
        };
        return chain;
      };
      const createAppUpdateChain = () => {
        const chain: { eq: ReturnType<typeof vi.fn>; then: (resolve: (v: unknown) => unknown) => Promise<unknown> } = {
          eq: vi.fn(() => chain),
          then: (resolve) => Promise.resolve({ error: null }).then(resolve),
        };
        return chain;
      };

      const jobUpdateChain = createJobUpdateChain(staleJob.id);
      const jobUpdateMock = vi.fn().mockReturnValue(jobUpdateChain);
      const appUpdateChain = createAppUpdateChain();
      const appUpdateMock = vi.fn().mockReturnValue(appUpdateChain);

      mocks.admin.mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'course_parse_jobs') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: [staleJob], error: null }),
              }),
              update: jobUpdateMock,
            };
          }
          if (table === 'course_applications') {
            return {
              update: appUpdateMock,
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  lte: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            };
          }
          return {};
        }),
      });

      const result = await reapStaleParseJobs(5);

      expect(result.reaped).toBe(1);
      expect(result.recovered).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.jobs[0].action).toBe('recovered');

      // Check that job was reset to pending with cleared locked_by
      expect(jobUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'pending',
          locked_by: null,
          error_message: expect.stringContaining('Job processing timed out'),
        }),
      );

      // Check that application was reset to pending with cleared progress
      expect(appUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          parse_status: 'pending',
          progress_percentage: 0,
          parse_error: null,
        }),
      );
    });

    it('marks exhausted stale processing jobs as failed and sets error on application', async () => {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const exhaustedJob = {
        id: 'job-exhausted-1',
        application_id: 'app-2',
        status: 'processing',
        attempts: 3,
        max_attempts: 3,
        started_at: tenMinutesAgo,
        updated_at: tenMinutesAgo,
        error_message: null,
      };

      const createJobUpdateChain = (jobId: string) => {
        const chain: { eq: ReturnType<typeof vi.fn>; select: ReturnType<typeof vi.fn>; then: (resolve: (v: unknown) => unknown) => Promise<unknown> } = {
          eq: vi.fn(() => chain),
          select: vi.fn().mockResolvedValue({ data: [{ id: jobId, status: 'processing' }], error: null }),
          then: (resolve) => Promise.resolve({ data: [{ id: jobId, status: 'processing' }], error: null }).then(resolve),
        };
        return chain;
      };
      const createAppUpdateChain = () => {
        const chain: { eq: ReturnType<typeof vi.fn>; then: (resolve: (v: unknown) => unknown) => Promise<unknown> } = {
          eq: vi.fn(() => chain),
          then: (resolve) => Promise.resolve({ error: null }).then(resolve),
        };
        return chain;
      };

      const jobUpdateChain = createJobUpdateChain(exhaustedJob.id);
      const jobUpdateMock = vi.fn().mockReturnValue(jobUpdateChain);
      const appUpdateChain = createAppUpdateChain();
      const appUpdateMock = vi.fn().mockReturnValue(appUpdateChain);

      mocks.admin.mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'course_parse_jobs') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: [exhaustedJob], error: null }),
              }),
              update: jobUpdateMock,
            };
          }
          if (table === 'course_applications') {
            return {
              update: appUpdateMock,
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  lte: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            };
          }
          return {};
        }),
      });

      const result = await reapStaleParseJobs(5);

      expect(result.reaped).toBe(1);
      expect(result.recovered).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.jobs[0].action).toBe('failed');

      // Check job failed
      expect(jobUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          completed_at: expect.any(String),
          error_message: expect.stringContaining('timed out after maximum attempts'),
        }),
      );

      // Check application failed
      expect(appUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          parse_status: 'failed',
          parse_error: expect.stringContaining('Reading this course page timed out'),
        }),
      );
    });

    it('ignores active processing jobs updated recently', async () => {
      const oneMinuteAgo = new Date(Date.now() - 1 * 60 * 1000).toISOString();
      const activeJob = {
        id: 'job-active-1',
        application_id: 'app-3',
        status: 'processing',
        attempts: 1,
        max_attempts: 3,
        started_at: oneMinuteAgo,
        updated_at: oneMinuteAgo,
        error_message: null,
      };

      const jobUpdateMock = vi.fn();
      const appUpdateMock = vi.fn();

      mocks.admin.mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'course_parse_jobs') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: [activeJob], error: null }),
              }),
              update: jobUpdateMock,
            };
          }
          if (table === 'course_applications') {
            return {
              update: appUpdateMock,
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  lte: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            };
          }
          return {};
        }),
      });

      const result = await reapStaleParseJobs(5);

      expect(result.reaped).toBe(0);
      expect(result.recovered).toBe(0);
      expect(result.failed).toBe(0);
      expect(jobUpdateMock).not.toHaveBeenCalled();
      expect(appUpdateMock).not.toHaveBeenCalled();
    });

    it('uses the latest heartbeat instead of the original claim time', async () => {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const oneMinuteAgo = new Date(Date.now() - 1 * 60 * 1000).toISOString();
      const heartbeatingJob = {
        id: 'job-heartbeating-1',
        application_id: 'app-heartbeating-1',
        status: 'processing',
        attempts: 1,
        max_attempts: 3,
        started_at: tenMinutesAgo,
        updated_at: oneMinuteAgo,
        error_message: null,
      };

      const jobUpdateMock = vi.fn();
      const appUpdateMock = vi.fn();

      mocks.admin.mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'course_parse_jobs') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: [heartbeatingJob], error: null }),
              }),
              update: jobUpdateMock,
            };
          }
          if (table === 'course_applications') {
            return {
              update: appUpdateMock,
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  lte: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            };
          }
          return {};
        }),
      });

      const result = await reapStaleParseJobs(5);

      expect(result.reaped).toBe(0);
      expect(result.recovered).toBe(0);
      expect(result.failed).toBe(0);
      expect(jobUpdateMock).not.toHaveBeenCalled();
      expect(appUpdateMock).not.toHaveBeenCalled();
    });
  });
});
