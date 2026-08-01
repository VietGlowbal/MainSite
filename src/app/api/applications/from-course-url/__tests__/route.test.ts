import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCreateClient,
  mockEntitlement,
  mockLegacyValidator,
  mockLegacyJob,
  mockCacheLookup,
  mockCreateJob,
  mockMarkCacheHit,
  mockApplyCacheHit,
} = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockEntitlement: vi.fn(),
  mockLegacyValidator: vi.fn(),
  mockLegacyJob: vi.fn(),
  mockCacheLookup: vi.fn(),
  mockCreateJob: vi.fn(),
  mockMarkCacheHit: vi.fn(),
  mockApplyCacheHit: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}));
vi.mock('@/lib/entitlements/entitlement-service', () => ({
  canAddCoursesToApply: mockEntitlement,
}));
vi.mock('@/lib/course-search/url-validator', () => ({
  validateCourseUrl: mockLegacyValidator,
}));
vi.mock('@/lib/course-parser/job-queue', () => ({
  createParseJob: mockLegacyJob,
}));
vi.mock('@/lib/ingestion/cache-lookup', () => ({
  lookupCrawlCache: mockCacheLookup,
}));
vi.mock('@/lib/ingestion/ingestion-job-queue', () => ({
  createIngestionJob: mockCreateJob,
  markJobCacheHit: mockMarkCacheHit,
}));
vi.mock('@/lib/ingestion/application-mapping', () => ({
  applyCacheHitToApplication: mockApplyCacheHit,
}));

import { POST } from '../route';

interface SupabaseFixture {
  user?: { id: string } | null;
  university?: Record<string, unknown> | null;
  duplicate?: { id: string } | null;
}

function buildSupabase(fixture: SupabaseFixture = {}) {
  const inserts: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];
  const from = vi.fn((table: string) => {
    let operation = 'select';
    const builder: Record<string, ReturnType<typeof vi.fn>> = {};
    builder.select = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.neq = vi.fn(() => builder);
    builder.delete = vi.fn(() => builder);
    builder.update = vi.fn((value: Record<string, unknown>) => {
      operation = 'update';
      updates.push(value);
      return builder;
    });
    builder.insert = vi.fn((value: Record<string, unknown>) => {
      operation = 'insert';
      inserts.push(value);
      return builder;
    });
    builder.single = vi.fn(async () => {
      if (table === 'universities') {
        return {
          data: fixture.university ?? null,
          error: fixture.university ? null : { message: 'not found' },
        };
      }
      if (table === 'course_applications' && operation === 'insert') {
        return { data: { id: 'application-1' }, error: null };
      }
      return { data: null, error: null };
    });
    builder.maybeSingle = vi.fn(async () => ({
      data: fixture.duplicate ?? null,
      error: null,
    }));
    return builder;
  });
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: fixture.user === undefined ? { id: 'user-1' } : fixture.user },
        error: null,
      })),
    },
    from,
    inserts,
    updates,
  };
}

function request(body: Record<string, unknown>) {
  return new Request('http://localhost/api/applications/from-course-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const APPROVED_UNIVERSITY = {
  id: 123,
  name: 'Example University',
  primary_domain: 'example.edu',
  domain_candidates: ['catalog.example.edu'],
  domain_review_status: 'approved',
  crawl_seed_enabled: true,
};

describe('POST /api/applications/from-course-url', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.COURSE_URL_INGESTION_PROVIDER = 'ingestion';
    mockEntitlement.mockResolvedValue({ allowed: true });
    mockLegacyValidator.mockResolvedValue({ isValid: true });
    // `createParseJob` returns the queued row, and returns null when the write
    // fails. The route now branches on that instead of ignoring it, so the mock
    // has to answer like the real one.
    mockLegacyJob.mockResolvedValue({ id: 'parse-job-1' });
    mockCreateJob.mockResolvedValue({ id: 'job-1' });
    mockCacheLookup.mockResolvedValue({ found: false });
  });

  afterEach(() => {
    delete process.env.COURSE_URL_INGESTION_PROVIDER;
  });

  it('rejects unauthenticated requests', async () => {
    mockCreateClient.mockResolvedValue(buildSupabase({ user: null }));

    const response = await POST(
      request({
        courseUrl: 'https://example.edu/program',
        universityId: 123,
      })
    );

    expect(response.status).toBe(401);
    expect(mockCreateJob).not.toHaveBeenCalled();
  });

  it('rejects a URL outside the approved university domain', async () => {
    mockCreateClient.mockResolvedValue(
      buildSupabase({ university: APPROVED_UNIVERSITY })
    );

    const response = await POST(
      request({
        courseUrl: 'https://attacker.example/program',
        universityId: 123,
      })
    );

    expect(response.status).toBe(400);
    expect((await response.json()).errorCode).toBe('INVALID_URL');
    expect(mockCreateJob).not.toHaveBeenCalled();
  });

  it('returns 202 and enqueues one job on a cache miss', async () => {
    const supabase = buildSupabase({ university: APPROVED_UNIVERSITY });
    mockCreateClient.mockResolvedValue(supabase);

    const response = await POST(
      request({
        courseUrl: 'https://catalog.example.edu/program?utm_source=test',
        universityId: 123,
      })
    );

    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({
      status: 'pending',
      cacheHit: false,
      applicationId: 'application-1',
      jobId: 'job-1',
    });
    expect(mockCreateJob).toHaveBeenCalledTimes(1);
    expect(mockLegacyJob).not.toHaveBeenCalled();
    expect(supabase.inserts[0]).toMatchObject({
      course_url_canonical: 'https://catalog.example.edu/program',
    });
  });

  it('links a cache hit without calling either AI parser', async () => {
    mockCreateClient.mockResolvedValue(
      buildSupabase({ university: APPROVED_UNIVERSITY })
    );
    mockCacheLookup.mockResolvedValue({
      found: true,
      runId: 'run-1',
      programmeId: 'programme-1',
      programmeName: 'MS Computer Science',
      degreeLevel: 'master',
      deliveryMode: 'full-time',
    });

    const response = await POST(
      request({
        courseUrl: 'https://example.edu/program',
        universityId: 123,
      })
    );

    expect(response.status).toBe(200);
    expect((await response.json()).cacheHit).toBe(true);
    expect(mockApplyCacheHit).toHaveBeenCalledBefore(mockMarkCacheHit);
    expect(mockLegacyJob).not.toHaveBeenCalled();
  });

  it('preserves the legacy parser behind the rollback flag', async () => {
    process.env.COURSE_URL_INGESTION_PROVIDER = 'legacy';
    const supabase = buildSupabase({ university: APPROVED_UNIVERSITY });
    mockCreateClient.mockResolvedValue(supabase);

    const response = await POST(
      request({
        courseUrl: 'https://example.edu/program',
        universityId: 123,
      })
    );

    expect(response.status).toBe(200);
    expect(mockLegacyJob).toHaveBeenCalledWith(
      'application-1',
      'https://example.edu/program',
      123
    );
    expect(mockCreateJob).not.toHaveBeenCalled();
    expect(supabase.inserts[0]).not.toHaveProperty('course_url_canonical');
  });

  it('settles the row instead of stranding it when the legacy queue refuses', async () => {
    /*
     * The row is inserted parse_status:'pending'. `createParseJob` reports a
     * write failure by returning null, and this used to be swallowed as
     * "best-effort", leaving an application that told its owner the AI was
     * reading a page while no job existed. Measured 2026-08-01: 13 of 37 live
     * applications are in that state, the oldest since 15 June.
     */
    process.env.COURSE_URL_INGESTION_PROVIDER = 'legacy';
    mockLegacyJob.mockResolvedValue(null);
    const supabase = buildSupabase({ university: APPROVED_UNIVERSITY });
    mockCreateClient.mockResolvedValue(supabase);

    const response = await POST(
      request({ courseUrl: 'https://example.edu/program', universityId: 123 })
    );

    // The application is still the thing the student asked for, so this is not
    // an error — but it must not keep claiming a parse is running.
    expect(response.status).toBe(200);
    expect((await response.json()).parseQueued).toBe(false);
    expect(supabase.updates).toContainEqual(
      expect.objectContaining({ parse_status: 'failed' })
    );
  });
});
