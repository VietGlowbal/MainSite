import { beforeEach, describe, expect, it, vi } from 'vitest';

const programmeQuery: Record<string, ReturnType<typeof vi.fn>> = {};
programmeQuery.select = vi.fn(() => programmeQuery);
programmeQuery.eq = vi.fn(() => programmeQuery);
programmeQuery.neq = vi.fn(() => programmeQuery);
programmeQuery.maybeSingle = vi.fn();

const assertionQuery: Record<string, ReturnType<typeof vi.fn>> = {};
assertionQuery.select = vi.fn(() => assertionQuery);
assertionQuery.eq = vi.fn(() => assertionQuery);
assertionQuery.neq = vi.fn(() => assertionQuery);
assertionQuery.order = vi.fn();

const applicationEq = vi.fn();
const applicationUpdate = vi.fn(() => ({ eq: applicationEq }));
const mockFrom = vi.fn((table: string) => {
  if (table === 'crawl_programmes') return programmeQuery;
  if (table === 'crawl_field_assertions') return assertionQuery;
  return { update: applicationUpdate };
});

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: mockFrom }),
}));

import { mapIngestionResultToApplication } from './application-mapping';

describe('mapIngestionResultToApplication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    programmeQuery.maybeSingle.mockResolvedValue({
      error: null,
      data: {
        programme_name: 'Official programme name',
        degree_level: 'master',
        delivery_mode: 'full-time',
        programme_status: 'active',
        official_url: 'https://example.edu/program',
        verification_status: 'RULE_VALIDATED',
      },
    });
    assertionQuery.order.mockResolvedValue({
      data: [
        {
          field_name: 'programme_name',
          value_json: 'Unverified AI name',
          null_reason: null,
          source_url: 'https://example.edu/program',
          verification_status: 'AI_EXTRACTED',
          confidence: 0.99,
          academic_cycle: null,
          audience: null,
        },
        {
          field_name: 'programme_name',
          value_json: 'Verified programme name',
          null_reason: null,
          source_url: 'https://example.edu/program',
          verification_status: 'RULE_VALIDATED',
          confidence: 0.8,
          academic_cycle: null,
          audience: null,
        },
        {
          field_name: 'international_deadline',
          value_json: '2027-01-15',
          null_reason: null,
          source_url: 'https://example.edu/deadlines',
          verification_status: 'HUMAN_VERIFIED',
          confidence: 0.9,
          academic_cycle: '2027',
          audience: 'international',
        },
      ],
      error: null,
    });
    applicationEq.mockResolvedValue({ error: null });
  });

  it('maps only verified structured assertions and programme-scoped facts', async () => {
    await mapIngestionResultToApplication({
      applicationId: 'app-1',
      runId: 'run-1',
      programmeId: 'programme-1',
      courseId: 'course-1',
      cacheHit: false,
      jobId: 'job-1',
    });

    expect(assertionQuery.eq).toHaveBeenCalledWith(
      'entity_type',
      'programme'
    );
    expect(applicationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        course_name: 'Verified programme name',
        deadline: '2027-01-15',
        deadline_source: 'https://example.edu/deadlines',
        crawl_run_id: 'run-1',
        crawl_programme_id: 'programme-1',
        course_id: 'course-1',
      })
    );
  });
});
