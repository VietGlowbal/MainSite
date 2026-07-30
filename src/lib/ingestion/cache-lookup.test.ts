import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockLimit = vi.fn();
const mockOfficialUrlIn = vi.fn(() => ({ limit: mockLimit }));
const mockNeq = vi.fn(() => ({ in: mockOfficialUrlIn }));
const mockRunStatusIn = vi.fn(() => ({ neq: mockNeq }));
const mockSelect = vi.fn(() => ({ in: mockRunStatusIn }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: mockFrom }),
}));

import { lookupCrawlCache } from '@/lib/ingestion/cache-lookup';

describe('lookupCrawlCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the explicit run relationship and safe URL equality filters', async () => {
    mockLimit.mockResolvedValueOnce({ data: [], error: null });

    await expect(
      lookupCrawlCache(
        'https://example.edu/program?utm_source=tracking'
      )
    ).resolves.toEqual({ found: false });

    expect(mockSelect).toHaveBeenCalledWith(
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
    mockLimit.mockResolvedValueOnce({
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

    const result = await lookupCrawlCache('https://example.edu/program');

    expect(result).toMatchObject({
      found: true,
      runId: 'run-approved',
      programmeId: 'approved',
    });
  });
});
