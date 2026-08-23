import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getServerIdentity: vi.fn(),
  getByIds: vi.fn(),
  byUniversityIds: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@/server/auth/server-identity', () => ({
  getServerIdentity: mocks.getServerIdentity,
}));
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

function mockIdentity(supabase: unknown) {
  mocks.getServerIdentity.mockResolvedValue({
    supabase,
    identity: {
      id: 'user-1',
      email: 'student@example.com',
      name: 'student',
      avatarUrl: null,
      userMetadata: {},
    },
  });
}

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
        data: [{
          id: 1,
          university_id: 82,
          added_at: '2026-08-01T00:00:00Z',
          universities: university,
        }],
        error: null,
      },
      user_scholarships: { data: [], error: null },
      student_profiles: { data: null, error: null },
      student_personal_report_versions: { data: null, error: null },
      applicant_analyses: { data: [], error: null },
      application_match_analyses: { data: [], error: null },
    };
    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1', email: 'student@example.com', user_metadata: {} } },
        }),
      },
      from: vi.fn((table: string) => query(results[table] ?? { data: [], error: null })),
    };
    mocks.createClient.mockResolvedValue(supabase);
    mockIdentity(supabase);

    const page = await ApplyPage({ searchParams: Promise.resolve({}) });

    expect(page.props.children.props.logoByUniversityId).toEqual({
      82: 'https://example.com/application-logo.png',
    });
    expect(page.props.children.props.savedRowsPromise).toBeInstanceOf(Promise);
    expect(mocks.getByIds).not.toHaveBeenCalled();
  });

  it('returns the application section without waiting for saved rows', async () => {
    const savedRows = deferred<unknown>();
    const started: string[] = [];
    mocks.getByIds.mockResolvedValue([]);
    mocks.byUniversityIds.mockResolvedValue(new Map());

    const results: Record<string, unknown> = {
      course_applications: { data: [], error: null },
      user_scholarships: { data: [], error: null },
      student_profiles: { data: null, error: null },
      student_personal_report_versions: { data: null, error: null },
      applicant_analyses: { data: [], error: null },
      application_match_analyses: { data: [], error: null },
    };
    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1', email: 'student@example.com', user_metadata: {} } },
        }),
      },
      from: vi.fn((table: string) => {
        started.push(table);
        return table === 'user_universities'
          ? queryPromise(savedRows.promise)
          : query(results[table] ?? { data: [], error: null });
      }),
    };
    mocks.createClient.mockResolvedValue(supabase);
    mockIdentity(supabase);

    const page = await ApplyPage({ searchParams: Promise.resolve({}) });
    const savedRowsPromise = page.props.children.props.savedRowsPromise as Promise<unknown>;
    expect(savedRowsPromise).toBeInstanceOf(Promise);
    expect(started).toContain('user_scholarships');

    savedRows.resolve({ data: [], error: null });
    await expect(savedRowsPromise).resolves.toEqual([]);
  });

  it('starts the readiness reads before applications finish loading', async () => {
    // `fetchStrategyReadiness` (src/app/apply/page.tsx) reads
    // `student_personal_report_versions`, `applicant_analyses`, and `application_match_analyses`
    // filtered by `user_id` — unlike the per-application review-column read,
    // which needs the ids `course_applications` resolves to, these have no such
    // dependency, so they must not be serialized behind `course_applications` finishing.
    const applications = deferred<unknown>();
    const started: string[] = [];
    const executed: string[] = [];
    mocks.getByIds.mockResolvedValue([]);
    mocks.byUniversityIds.mockResolvedValue(new Map());

    const results: Record<string, unknown> = {
      user_universities: { data: [], error: null },
      user_scholarships: { data: [], error: null },
      student_profiles: { data: null, error: null },
      student_personal_report_versions: { data: null, error: null },
      applicant_analyses: { data: [], error: null },
      application_match_analyses: { data: [], error: null },
    };
    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1', email: 'student@example.com', user_metadata: {} } },
        }),
      },
      from: vi.fn((table: string) => {
        started.push(table);
        if (
          table === 'student_personal_report_versions' ||
          table === 'applicant_analyses' ||
          table === 'application_match_analyses'
        ) {
          const resolved = Promise.resolve(results[table] ?? { data: [], error: null });
          const builder: Record<string, unknown> = {};
          const chain = () => builder;
          Object.assign(builder, {
            select: chain,
            eq: chain,
            limit: chain,
            maybeSingle: () => resolved,
            then: (onFulfilled: (value: unknown) => unknown, onRejected?: (error: unknown) => unknown) => {
              executed.push(table);
              return resolved.then(onFulfilled, onRejected);
            },
          });
          return builder;
        }
        return table === 'course_applications'
          ? queryPromise(applications.promise)
          : query(results[table] ?? { data: [], error: null });
      }),
    };
    mocks.createClient.mockResolvedValue(supabase);
    mockIdentity(supabase);

    const pagePromise = ApplyPage({ searchParams: Promise.resolve({}) });
    await vi.waitFor(() => expect(started).toContain('course_applications'));
    await Promise.resolve();

    let schedulingError: unknown;
    try {
      expect(executed).toContain('student_personal_report_versions');
      expect(executed).toContain('applicant_analyses');
      expect(executed).toContain('application_match_analyses');
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

  it('keeps the browser Supabase SDK out of the saved-list chunk until a mutation', () => {
    const client = readFileSync('src/app/apply/saved-list-section.tsx', 'utf8');

    expect(client).not.toContain("import { createClient } from '@/lib/supabase/client'");
    expect(client.match(/await import\('\@\/lib\/supabase\/client'\)/g)).toHaveLength(2);
  });

  it('keeps distinct portal and saved-list anchors available during streaming', () => {
    const shell = readFileSync('src/app/apply/apply-shell.tsx', 'utf8');
    const progress = readFileSync('src/app/apply/application-progress-client.tsx', 'utf8');
    const savedList = readFileSync('src/app/apply/saved-list-section.tsx', 'utf8');

    expect(shell).toContain('id="portal"');
    expect(progress).toMatch(/<div ref=\{savedSectionRef\} id="saved"[\s\S]*?<Suspense fallback=/);
    expect(savedList).not.toContain('id="saved"');
  });
});
