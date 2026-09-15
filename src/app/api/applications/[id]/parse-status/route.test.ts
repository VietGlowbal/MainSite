import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  userClient: vi.fn(),
  adminClient: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.userClient }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.adminClient }));

import { GET } from './route';

describe('GET /api/applications/[id]/parse-status', () => {
  const userId = 'user-123';
  const appId = 'app-456';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeRequest() {
    return new NextRequest(`http://localhost/api/applications/${appId}/parse-status`);
  }

  it('returns 401 when unauthenticated', async () => {
    mocks.userClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    });

    const res = await GET(makeRequest(), { params: Promise.resolve({ id: appId }) });
    expect(res.status).toBe(401);
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

    const res = await GET(makeRequest(), { params: Promise.resolve({ id: appId }) });
    expect(res.status).toBe(404);
  });

  it('returns 403 when application belongs to another user', async () => {
    mocks.userClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { id: appId, user_id: 'other-user', parse_status: 'complete' },
              error: null,
            }),
          })),
        })),
      })),
    });

    const res = await GET(makeRequest(), { params: Promise.resolve({ id: appId }) });
    expect(res.status).toBe(403);
  });

  it('returns ready phase and canRetry=false when complete', async () => {
    mocks.userClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: {
                id: appId,
                user_id: userId,
                parse_status: 'complete',
                progress_percentage: 100,
                updated_at: new Date().toISOString(),
              },
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
              data: { status: 'complete', phase: 'ready', attempts: 1, max_attempts: 3 },
              error: null,
            }),
          })),
        })),
      })),
    });

    const res = await GET(makeRequest(), { params: Promise.resolve({ id: appId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(
      expect.objectContaining({
        id: appId,
        parseStatus: 'complete',
        progressPercentage: 100,
        phase: 'ready',
        isStale: false,
        canRetry: false,
      }),
    );
  });

  it('detects stale processing job (>10 min) and exposes canRetry=true and phase=timeout', async () => {
    const staleUpdatedAt = new Date(Date.now() - 11 * 60 * 1000).toISOString();

    mocks.userClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: {
                id: appId,
                user_id: userId,
                parse_status: 'processing',
                progress_percentage: 20,
                updated_at: staleUpdatedAt,
              },
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
                status: 'processing',
                attempts: 1,
                max_attempts: 3,
                updated_at: staleUpdatedAt,
                started_at: staleUpdatedAt,
              },
              error: null,
            }),
          })),
        })),
      })),
    });

    const res = await GET(makeRequest(), { params: Promise.resolve({ id: appId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(
      expect.objectContaining({
        id: appId,
        parseStatus: 'processing',
        progressPercentage: 20,
        phase: 'timeout',
        isStale: true,
        canRetry: true,
      }),
    );
  });

  it('suppresses retry while a worker lease is active despite a stale application projection', async () => {
    mocks.userClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: {
                id: appId,
                user_id: userId,
                parse_status: 'failed',
                progress_percentage: 0,
                parse_error: 'A previous attempt failed',
                updated_at: new Date().toISOString(),
              },
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
                status: 'processing',
                phase: 'extracting',
                attempts: 1,
                max_attempts: 3,
                updated_at: new Date().toISOString(),
                started_at: new Date().toISOString(),
              },
              error: null,
            }),
          })),
        })),
      })),
    });

    const res = await GET(makeRequest(), { params: Promise.resolve({ id: appId }) });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(expect.objectContaining({
      active: true,
      isStale: false,
      canRetry: false,
    }));
  });

  it('classifies retryable and terminal errors accurately', async () => {
    mocks.userClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: {
                id: appId,
                user_id: userId,
                parse_status: 'failed',
                parse_error: 'That page gave us no text to read — empty_page',
                progress_percentage: 0,
                updated_at: new Date().toISOString(),
              },
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
                status: 'failed',
                attempts: 1,
                max_attempts: 3,
                error_message: 'empty_page',
              },
              error: null,
            }),
          })),
        })),
      })),
    });

    const res = await GET(makeRequest(), { params: Promise.resolve({ id: appId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.phase).toBe('failed');
    expect(body.canRetry).toBe(true);
    expect(body.errorType).toBe('terminal');
  });
});
