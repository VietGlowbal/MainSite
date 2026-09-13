import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  userClient: vi.fn(),
  adminClient: vi.fn(),
  createParseJob: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.userClient }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.adminClient }));
vi.mock('@/lib/course-parser/job-queue', () => ({
  createParseJob: mocks.createParseJob,
}));

import { POST } from './route';

describe('POST /api/applications/[id]/retry-parse', () => {
  const userId = 'user-123';
  const appId = 'app-456';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeRequest() {
    return new NextRequest(`http://localhost/api/applications/${appId}/retry-parse`, {
      method: 'POST',
    });
  }

  it('returns 401 when unauthenticated', async () => {
    mocks.userClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    });

    const res = await POST(makeRequest(), { params: Promise.resolve({ id: appId }) });
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('returns 404 when application is not found', async () => {
    mocks.userClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
          })),
        })),
      })),
    });

    const res = await POST(makeRequest(), { params: Promise.resolve({ id: appId }) });
    expect(res.status).toBe(404);
  });

  it('returns 403 when application belongs to another user', async () => {
    mocks.userClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { id: appId, user_id: 'other-user', parse_status: 'failed' },
              error: null,
            }),
          })),
        })),
      })),
    });

    const res = await POST(makeRequest(), { params: Promise.resolve({ id: appId }) });
    expect(res.status).toBe(403);
  });

  it('idempotently preserves completed parse without restarting or updating', async () => {
    mocks.userClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { id: appId, user_id: userId, parse_status: 'complete' },
              error: null,
            }),
          })),
        })),
      })),
    });

    const adminUpdateMock = vi.fn();
    mocks.adminClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: { status: 'complete' }, error: null }),
          })),
        })),
        update: adminUpdateMock,
      })),
    });

    const res = await POST(makeRequest(), { params: Promise.resolve({ id: appId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(
      expect.objectContaining({
        success: true,
        parseStatus: 'complete',
        phase: 'ready',
        alreadyComplete: true,
      }),
    );
    expect(adminUpdateMock).not.toHaveBeenCalled();
  });

  it('idempotently returns pending when job is already queued', async () => {
    mocks.userClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { id: appId, user_id: userId, parse_status: 'pending' },
              error: null,
            }),
          })),
        })),
      })),
    });

    const adminUpdateMock = vi.fn();
    mocks.adminClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: { status: 'pending' }, error: null }),
          })),
        })),
        update: adminUpdateMock,
      })),
    });

    const res = await POST(makeRequest(), { params: Promise.resolve({ id: appId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(
      expect.objectContaining({
        success: true,
        parseStatus: 'pending',
        phase: 'queued',
        alreadyQueued: true,
      }),
    );
    expect(adminUpdateMock).not.toHaveBeenCalled();
  });

  it('idempotently returns processing when job is actively processing (not stale)', async () => {
    const recent = new Date(Date.now() - 30 * 1000).toISOString(); // 30s ago
    mocks.userClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { id: appId, user_id: userId, parse_status: 'processing', updated_at: recent },
              error: null,
            }),
          })),
        })),
      })),
    });

    const adminUpdateMock = vi.fn();
    mocks.adminClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { status: 'processing', updated_at: recent },
              error: null,
            }),
          })),
        })),
        update: adminUpdateMock,
      })),
    });

    const res = await POST(makeRequest(), { params: Promise.resolve({ id: appId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(
      expect.objectContaining({
        success: true,
        parseStatus: 'processing',
        active: true,
      }),
    );
    expect(adminUpdateMock).not.toHaveBeenCalled();
  });

  it('does not let a fresh failed job hide a stale processing application', async () => {
    const staleApplication = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const freshJob = new Date(Date.now() - 30 * 1000).toISOString();
    mocks.userClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { id: appId, user_id: userId, parse_status: 'processing', updated_at: staleApplication },
              error: null,
            }),
          })),
        })),
      })),
    });

    const jobUpdateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({ data: [{ id: 'job-1', status: 'pending' }], error: null }),
        }),
      }),
    });
    const appUpdateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    mocks.adminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'course_parse_jobs') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: 'job-1', status: 'failed', attempts: 1, updated_at: freshJob, parsed_data: {} },
                  error: null,
                }),
              })),
            })),
            update: jobUpdateMock,
          };
        }
        return { update: appUpdateMock };
      }),
    });

    const res = await POST(makeRequest(), { params: Promise.resolve({ id: appId }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(expect.objectContaining({ parseStatus: 'pending', phase: 'queued' }));
    expect(jobUpdateMock).toHaveBeenCalled();
  });

  it('successfully retries failed parsing by re-enqueuing to pending with attempts=0', async () => {
    mocks.userClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { id: appId, user_id: userId, parse_status: 'failed', updated_at: new Date().toISOString() },
              error: null,
            }),
          })),
        })),
      })),
    });

    const createJobUpdateChain = () => {
      const chain: { eq: ReturnType<typeof vi.fn>; select: ReturnType<typeof vi.fn>; then: (resolve: (v: unknown) => unknown) => Promise<unknown> } = {
        eq: vi.fn(() => chain),
        select: vi.fn().mockResolvedValue({ data: [{ id: 'job-1', status: 'pending' }], error: null }),
        then: (resolve) => Promise.resolve({ data: [{ id: 'job-1', status: 'pending' }], error: null }).then(resolve),
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

    const jobUpdateChain = createJobUpdateChain();
    const jobUpdateMock = vi.fn().mockReturnValue(jobUpdateChain);
    const appUpdateChain = createAppUpdateChain();
    const appUpdateMock = vi.fn().mockReturnValue(appUpdateChain);

    mocks.adminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'course_parse_jobs') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: 'job-1',
                    status: 'failed',
                    attempts: 1,
                    updated_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
                  },
                  error: null,
                }),
              })),
            })),
            update: jobUpdateMock,
          };
        }
        if (table === 'course_applications') {
          return {
            update: appUpdateMock,
          };
        }
        return {};
      }),
    });

    const res = await POST(makeRequest(), { params: Promise.resolve({ id: appId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      success: true,
      parseStatus: 'pending',
      phase: 'queued',
    });

    // Check course_parse_jobs reset to pending and attempts reset to 0
    expect(jobUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'pending',
        phase: 'queued',
        attempts: 0,
        locked_by: null,
        error_message: null,
      }),
    );

    // Check course_applications set to pending (NOT processing!)
    expect(appUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        parse_status: 'pending',
        progress_percentage: 0,
        parse_error: null,
      }),
    );
  });

  it('allows retry for stale processing job (>10 minutes)', async () => {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    mocks.userClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { id: appId, user_id: userId, parse_status: 'processing', updated_at: fifteenMinutesAgo },
              error: null,
            }),
          })),
        })),
      })),
    });

    const createJobUpdateChain = () => {
      const chain: { eq: ReturnType<typeof vi.fn>; select: ReturnType<typeof vi.fn>; then: (resolve: (v: unknown) => unknown) => Promise<unknown> } = {
        eq: vi.fn(() => chain),
        select: vi.fn().mockResolvedValue({ data: [{ id: 'job-stale', status: 'pending' }], error: null }),
        then: (resolve) => Promise.resolve({ data: [{ id: 'job-stale', status: 'pending' }], error: null }).then(resolve),
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

    const jobUpdateChain = createJobUpdateChain();
    const jobUpdateMock = vi.fn().mockReturnValue(jobUpdateChain);
    const appUpdateChain = createAppUpdateChain();
    const appUpdateMock = vi.fn().mockReturnValue(appUpdateChain);

    mocks.adminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'course_parse_jobs') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: 'job-stale',
                    status: 'processing',
                    attempts: 1,
                    updated_at: fifteenMinutesAgo,
                  },
                  error: null,
                }),
              })),
            })),
            update: jobUpdateMock,
          };
        }
        if (table === 'course_applications') {
          return {
            update: appUpdateMock,
          };
        }
        return {};
      }),
    });

    const res = await POST(makeRequest(), { params: Promise.resolve({ id: appId }) });
    expect(res.status).toBe(200);
    expect(jobUpdateMock).toHaveBeenCalled();
    expect(appUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        parse_status: 'pending',
      }),
    );
  });

  it('enforces 429 rate limit when maximum retries exceeded in window', async () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    mocks.userClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { id: appId, user_id: userId, parse_status: 'failed', updated_at: tenMinutesAgo },
              error: null,
            }),
          })),
        })),
      })),
    });

    mocks.adminClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: 'job-1',
                status: 'failed',
                attempts: 3, // Exhausted
                updated_at: tenMinutesAgo,
              },
              error: null,
            }),
          })),
        })),
      })),
    });

    const res = await POST(makeRequest(), { params: Promise.resolve({ id: appId }) });
    expect(res.status).toBe(429);
    await expect(res.json()).resolves.toEqual({
      error: 'Rate limit exceeded. Maximum 3 retries per hour.',
    });
  });
});
