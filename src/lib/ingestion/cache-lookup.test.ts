import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCrawlLimit = vi.fn();
const mockCourseLimit = vi.fn();
const mockOfficialUrlIn = vi.fn(() => ({ limit: mockCrawlLimit }));
const mockNeq = vi.fn(() => ({ in: mockOfficialUrlIn }));
const mockRunStatusIn = vi.fn(() => ({ neq: mockNeq }));
const mockCrawlSelect = vi.fn(() => ({ in: mockRunStatusIn }));
const mockCourseEq = vi.fn(() => ({ limit: mockCourseLimit }));
const mockCourseSelect = vi.fn(() => ({ eq: mockCourseEq }));
const mockFrom = vi.fn((table: string) =>
  table === 'courses'
    ? { select: mockCourseSelect }
    : { select: mockCrawlSelect }
);

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: mockFrom }),
}));

import { lookupCrawlCache } from '@/lib/ingestion/cache-lookup';

describe('lookupCrawlCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the explicit run relationship and safe URL equality filters', async () => {
    mockCrawlLimit.mockResolvedValueOnce({ data: [], error: null });

    await expect(
      lookupCrawlCache(
        'https://example.edu/program?utm_source=tracking'
      )
    ).resolves.toEqual({ found: false });

    expect(mockCrawlSelect).toHaveBeenCalledWith(
      expect.stringContaining(
        'crawl_runs!crawl_programmes_run_id_fkey!inner'
      )
    );
    expect(mockOfficialUrlIn).toHaveBeenCalledWith(
      'official_url',
      expect.arrayContaining([
        'https://example.edu/program',
        'https://example.edu/program?utm_source=tracking',
      ])
    );
  });

  it('prefers an approved run over a newer completed run', async () => {
    mockCrawlLimit.mockResolvedValueOnce({
      error: null,
      data: [
        {
          programme_id: 'new-completed',
          programme_name: 'New completed',
          degree_level: 'master',
          delivery_mode: 'full-time',
          official_url: 'https://example.edu/program',
          verification_status: 'HUMAN_VERIFIED',
          run_id: 'run-new',
          crawl_runs: {
            id: 'run-new',
            status: 'completed',
            finished_at: '2026-07-30T00:00:00Z',
            imported_at: '2026-07-30T00:00:00Z',
          },
        },
        {
          programme_id: 'approved',
          programme_name: 'Approved',
          degree_level: 'master',
          delivery_mode: 'full-time',
          official_url: 'https://example.edu/program',
          verification_status: 'RULE_VALIDATED',
          run_id: 'run-approved',
          crawl_runs: {
            id: 'run-approved',
            status: 'approved',
            finished_at: '2026-07-01T00:00:00Z',
            imported_at: '2026-07-01T00:00:00Z',
          },
        },
      ],
    });
    mockCourseLimit.mockResolvedValueOnce({
      data: [{ id: 'course-approved' }],
      error: null,
    });

    const result = await lookupCrawlCache('https://example.edu/program');

    expect(result).toMatchObject({
      found: true,
      runId: 'run-approved',
      programmeId: 'approved',
      courseId: 'course-approved',
    });
  });

  it('queues a worker when crawl data has not been promoted yet', async () => {
    mockCrawlLimit.mockResolvedValueOnce({
      error: null,
      data: [
        {
          programme_id: 'crawl-only',
          programme_name: 'Crawl only',
          official_url: 'https://example.edu/program',
          verification_status: 'RULE_VALIDATED',
          run_id: 'run-1',
          crawl_runs: {
            id: 'run-1',
            status: 'completed',
            finished_at: '2026-07-01T00:00:00Z',
          },
        },
      ],
    });
    mockCourseLimit.mockResolvedValueOnce({ data: [], error: null });

    await expect(
      lookupCrawlCache('https://example.edu/program')
    ).resolves.toEqual({ found: false });
  });
});
