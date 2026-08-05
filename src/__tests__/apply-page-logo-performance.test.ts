import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getByIds: vi.fn(),
  byUniversityIds: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@/features/universities/api', () => ({
  getUniversityQueries: () => ({ getByIds: mocks.getByIds }),
}));
vi.mock('@/features/scholarships/api', () => ({
  getScholarshipQueries: () => ({ byUniversityIds: mocks.byUniversityIds }),
}));
vi.mock('@/features/universities/domain', () => ({
  formatTuitionForCard: vi.fn(() => null),
  officialWebsite: vi.fn(() => null),
}));
vi.mock('@/app/apply/application-progress-client', () => ({
  ApplicationProgressClient: vi.fn(() => null),
}));

import ApplyPage from '@/app/apply/page';

function queryPromise(resolved: Promise<unknown>) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  Object.assign(builder, {
    select: chain,
    eq: chain,
    in: chain,
    order: chain,
    maybeSingle: () => resolved,
    then: resolved.then.bind(resolved),
  });
  return builder;
}

const query = (result: unknown) => queryPromise(Promise.resolve(result));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('ApplyPage logo loading', () => {
  beforeEach(() => vi.resetAllMocks());

  it('uses the application university join without a second university lookup', async () => {
    const university = {
      id: 82,
      name: 'Test University',
      country: 'Vietnam',
      type: 'Private',
      qs_rank: 100,
      the_rank: 120,
      application_deadline: null,
      best_for: null,
      strengths: null,
      image_url: null,
      logo_url: 'https://example.com/saved-logo.png',
      tuition_usd: null,
    };
    mocks.getByIds.mockResolvedValue([university]);
    mocks.byUniversityIds.mockResolvedValue(new Map());

    const results: Record<string, unknown> = {
      course_applications: {
        data: [
          {
            id: 'app-1',
            user_id: 'user-1',
            university_id: 82,
            university_name: 'Test University',
            course_name: 'Computer Science',
            course_url: null,
            country: 'Vietnam',
            deadline: null,
            status: 'planning',
            progress_percentage: 0,
            parse_status: 'complete',
            parse_error: null,
            import_status: 'complete',
            strategy_intro_seen_at: null,
            created_at: '2026-08-01T00:00:00Z',
            updated_at: '2026-08-01T00:00:00Z',
            university: { logo_url: 'https://example.com/application-logo.png' },
          },
        ],
        error: null,
      },
      user_universities: {
        data: [{ id: 1, university_id: 82, added_at: '2026-08-01T00:00:00Z' }],
        error: null,
      },
      user_scholarships: { data: [], error: null },
      student_profiles: { data: null, error: null },
      applicant_analyses: { data: [], error: null },
    };
    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1', email: 'student@example.com', user_metadata: {} } },
        }),
      },
      from: vi.fn((table: string) => query(results[table])),
    };
    mocks.createClient.mockResolvedValue(supabase);

    const page = await ApplyPage({ searchParams: Promise.resolve({}) });

    expect(page.props.logoByUniversityId).toEqual({
      82: 'https://example.com/application-logo.png',
    });
    expect(mocks.getByIds).toHaveBeenCalledTimes(1);
  });

  it('starts the strategy profile read before applications finish loading', async () => {
    const applications = deferred<unknown>();
    const started: string[] = [];
    const executed: string[] = [];
    mocks.getByIds.mockResolvedValue([]);
    mocks.byUniversityIds.mockResolvedValue(new Map());

    const results: Record<string, unknown> = {
      user_universities: { data: [], error: null },
      student_profiles: { data: null, error: null },
      applicant_analyses: { data: [], error: null },
    };
    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1', email: 'student@example.com', user_metadata: {} } },
        }),
      },
      from: vi.fn((table: string) => {
        started.push(table);
        if (table === 'student_profiles') {
          const resolved = Promise.resolve(results[table]);
          const builder: Record<string, unknown> = {};
          const chain = () => builder;
          Object.assign(builder, {
            select: chain,
            eq: chain,
            maybeSingle: chain,
            then: (onFulfilled: (value: unknown) => unknown, onRejected?: (error: unknown) => unknown) => {
              executed.push(table);
              return resolved.then(onFulfilled, onRejected);
            },
          });
          return builder;
        }
        return table === 'course_applications'
          ? queryPromise(applications.promise)
          : query(results[table]);
      }),
    });

    const pagePromise = ApplyPage({ searchParams: Promise.resolve({}) });
    await vi.waitFor(() => expect(started).toContain('course_applications'));
    await Promise.resolve();

    let schedulingError: unknown;
    try {
      expect(executed).toContain('student_profiles');
    } catch (error) {
      schedulingError = error;
    }

    applications.resolve({
      data: [
        {
          id: 'app-1',
          user_id: 'user-1',
          university_id: null,
          university_name: 'Test University',
          course_name: 'Computer Science',
          course_url: null,
          country: 'Vietnam',
          deadline: null,
          status: 'planning',
          progress_percentage: 0,
          parse_status: 'complete',
          parse_error: null,
          import_status: 'complete',
          strategy_intro_seen_at: null,
          created_at: '2026-08-01T00:00:00Z',
          updated_at: '2026-08-01T00:00:00Z',
          university: null,
        },
      ],
      error: null,
    });
    await pagePromise;
    if (schedulingError) throw schedulingError;
  });
});
