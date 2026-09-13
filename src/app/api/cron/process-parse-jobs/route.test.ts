import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  isAuthorizedCron: vi.fn(),
  claimPendingJobs: vi.fn(),
  reapStaleParseJobs: vi.fn(),
  processParseJob: vi.fn(),
}));

vi.mock('@/lib/cron-auth', () => ({ isAuthorizedCron: mocks.isAuthorizedCron }));
vi.mock('@/lib/course-parser/job-queue', () => ({
  claimPendingJobs: mocks.claimPendingJobs,
  reapStaleParseJobs: mocks.reapStaleParseJobs,
}));
vi.mock('@/lib/course-parser/job-processor', () => ({
  processParseJob: mocks.processParseJob,
}));

import { GET, POST } from './route';

describe('GET/POST /api/cron/process-parse-jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isAuthorizedCron.mockReturnValue(true);
    mocks.reapStaleParseJobs.mockResolvedValue({ reaped: 0, recovered: 0, failed: 0, jobs: [] });
    mocks.claimPendingJobs.mockResolvedValue([]);
  });

  it('rejects unauthorized requests with 401', async () => {
    mocks.isAuthorizedCron.mockReturnValue(false);
    const req = new NextRequest('http://localhost/api/cron/process-parse-jobs');
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(mocks.claimPendingJobs).not.toHaveBeenCalled();
    expect(mocks.reapStaleParseJobs).not.toHaveBeenCalled();
  });

  it('invokes watchdog reaper before claiming jobs and reports reaped statistics', async () => {
    mocks.reapStaleParseJobs.mockResolvedValue({
      reaped: 2,
      recovered: 1,
      failed: 1,
      jobs: [
        { id: 'job-1', applicationId: 'app-1', action: 'recovered', attempts: 1, reason: 'timeout' },
        { id: 'job-2', applicationId: 'app-2', action: 'failed', attempts: 3, reason: 'exhausted' },
      ],
    });

    const req = new NextRequest('http://localhost/api/cron/process-parse-jobs');
    const res = await POST(req);
    expect(res.status).toBe(200);

    // Watchdog invoked before claiming jobs
    expect(mocks.reapStaleParseJobs).toHaveBeenCalledWith(5);
    expect(mocks.claimPendingJobs).toHaveBeenCalledWith(expect.any(String), 5);

    const body = await res.json();
    expect(body).toEqual(
      expect.objectContaining({
        reaped: 2,
        recovered: 1,
        staleFailed: 1,
        claimed: 0,
        processed: 0,
      }),
    );
  });

  it('claims and processes pending jobs concurrently', async () => {
    const job1 = { id: 'job-1', application_id: 'app-1', course_url: 'https://example.com/1' };
    const job2 = { id: 'job-2', application_id: 'app-2', course_url: 'https://example.com/2' };
    mocks.claimPendingJobs.mockResolvedValue([job1, job2]);
    mocks.processParseJob
      .mockResolvedValueOnce({ applicationId: 'app-1', status: 'complete' })
      .mockResolvedValueOnce({ applicationId: 'app-2', status: 'retry', reason: 'fetch_failed' });

    const req = new NextRequest('http://localhost/api/cron/process-parse-jobs?batch=10');
    const res = await GET(req);
    expect(res.status).toBe(200);

    expect(mocks.claimPendingJobs).toHaveBeenCalledWith(expect.any(String), 10);
    expect(mocks.processParseJob).toHaveBeenCalledTimes(2);

    const body = await res.json();
    expect(body).toEqual(
      expect.objectContaining({
        claimed: 2,
        processed: 2,
        complete: 1,
        retried: 1,
        failed: 0,
      }),
    );
  });

  it('clamps requested batch to maximum batch limit (20)', async () => {
    const req = new NextRequest('http://localhost/api/cron/process-parse-jobs?batch=100');
    await POST(req);
    expect(mocks.claimPendingJobs).toHaveBeenCalledWith(expect.any(String), 20);
  });
});
