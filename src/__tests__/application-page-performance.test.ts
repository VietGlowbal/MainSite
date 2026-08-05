import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  fetchApplicationWorkspace: vi.fn(),
  getByIds: vi.fn(),
  notFound: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock('next/navigation', () => ({ notFound: mocks.notFound, redirect: mocks.redirect }));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@/lib/api/application-workspace', () => ({
  fetchApplicationWorkspace: mocks.fetchApplicationWorkspace,
}));
vi.mock('@/features/universities/api', () => ({
  getUniversityQueries: () => ({ getByIds: mocks.getByIds }),
}));
vi.mock('@/components/application-nav', () => ({ ApplicationNav: vi.fn(() => null) }));
vi.mock('./application-workspace-v2', () => ({ ApplicationWorkspaceV2: vi.fn(() => null) }));

import ApplicationPage from '@/app/apply/[applicationId]/page';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('ApplicationPage performance', () => {
  beforeEach(() => vi.resetAllMocks());

  it('starts profile and document reads with the workspace and reuses its university logo', async () => {
    const workspaceResult = deferred<Record<string, unknown>>();
    const profileResult = deferred<{ data: Record<string, unknown> | null }>();
    const documentsResult = deferred<{ data: Array<{ type: string }> }>();
    const started: string[] = [];

    mocks.fetchApplicationWorkspace.mockReturnValue(workspaceResult.promise);
    mocks.getByIds.mockResolvedValue([{ logo_url: 'https://example.com/duplicate-logo.png' }]);
    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: 'user-1',
              email: 'student@example.com',
              user_metadata: { full_name: 'Student' },
            },
          },
        }),
      },
      from: vi.fn((table: string) => {
        started.push(table);
        const result = table === 'student_profiles' ? profileResult : documentsResult;
        const query: Record<string, unknown> = {};
        const chain = () => query;
        Object.assign(query, {
          select: chain,
          eq: chain,
          maybeSingle: () => result.promise,
          then: result.promise.then.bind(result.promise),
        });
        return query;
      }),
    });

    const pagePromise = ApplicationPage({
      params: Promise.resolve({ applicationId: 'app-1' }),
    });
    await vi.waitFor(() => expect(mocks.fetchApplicationWorkspace).toHaveBeenCalledOnce());
    await Promise.resolve();

    let schedulingError: unknown;
    try {
      expect(started).toEqual(['student_profiles', 'uploaded_documents']);
    } catch (error) {
      schedulingError = error;
    }

    workspaceResult.resolve({
      application: {
        id: 'app-1',
        universityId: 82,
        universityName: 'Test University',
        courseName: 'Computer Science',
        logoUrl: 'https://example.com/logo.png',
      },
      course: { id: 'course-1' },
      stages: [],
      requirements: [],
      sources: [],
      recommendations: [],
      metrics: { progress: 0, requirementsMet: 0, requirementsTotal: 0 },
    });
    profileResult.resolve({ data: { plus_status: true, academic_background: 'A levels' } });
    documentsResult.resolve({ data: [{ type: 'cv' }] });

    const page = await pagePromise;
    expect(page.props).toMatchObject({
      logoUrl: 'https://example.com/logo.png',
      isPlus: true,
      matchInputs: { cv: true, essay: false, academic: true },
    });
    expect(mocks.getByIds).not.toHaveBeenCalled();
    if (schedulingError) throw schedulingError;
  });
});
