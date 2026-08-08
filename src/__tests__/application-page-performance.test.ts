import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getServerIdentity: vi.fn(),
  fetchApplicationWorkspace: vi.fn(),
  notFound: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock('next/navigation', () => ({ notFound: mocks.notFound, redirect: mocks.redirect }));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@/server/auth/server-identity', () => ({
  getServerIdentity: mocks.getServerIdentity,
}));
vi.mock('@/lib/api/application-workspace', () => ({
  fetchApplicationWorkspace: mocks.fetchApplicationWorkspace,
}));
vi.mock('@/components/application-nav', () => ({ ApplicationNav: vi.fn(() => null) }));
vi.mock('@/app/apply/[applicationId]/application-workspace-v2', () => ({
  ApplicationWorkspaceV2: vi.fn(() => null),
}));

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

  it('renders the owned application shell before the full workspace resolves', async () => {
    const workspace = deferred<Record<string, unknown> | null>();
    const profile = deferred<{ data: Record<string, unknown> | null }>();
    const documents = deferred<{ data: Array<{ type: string }> }>();
    const started: string[] = [];
    const shellFilters: Array<[string, string]> = [];

    mocks.fetchApplicationWorkspace.mockReturnValue(workspace.promise);
    const supabase = {
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
        const query: Record<string, unknown> = {};
        const chain = () => query;
        Object.assign(query, {
          select: chain,
          eq: (column: string, value: string) => {
            if (table === 'course_applications') shellFilters.push([column, value]);
            return query;
          },
          maybeSingle: () =>
            table === 'course_applications'
              ? Promise.resolve({
                  data: {
                    id: 'app-1',
                    university_name: 'Test University',
                    course_name: 'Computer Science',
                    course_url: 'https://example.edu/course',
                    parse_status: 'complete',
                    university: { logo_url: 'https://example.com/logo.png' },
                  },
                  error: null,
                })
              : profile.promise,
          then: documents.promise.then.bind(documents.promise),
        });
        return query;
      }),
    };
    mocks.createClient.mockResolvedValue(supabase);
    mocks.getServerIdentity.mockResolvedValue({
      supabase,
      identity: {
        id: 'user-1',
        email: 'student@example.com',
        name: 'Student',
        avatarUrl: null,
        userMetadata: { full_name: 'Student' },
      },
    });

    const page = await ApplicationPage({ params: Promise.resolve({ applicationId: 'app-1' }) });

    expect(started).toEqual(['course_applications', 'student_profiles', 'uploaded_documents']);
    expect(shellFilters).toEqual([
      ['id', 'app-1'],
      ['user_id', 'user-1'],
    ]);
    expect(mocks.fetchApplicationWorkspace).toHaveBeenCalledWith('app-1', 'user-1');
    expect(page.props.banner.props).toMatchObject({
      universityName: 'Test University',
      courseName: 'Computer Science',
      logoUrl: 'https://example.com/logo.png',
      researching: false,
    });
    expect(page.props.nav.props.children.props.userId).toBe('user-1');

    workspace.resolve(null);
    profile.resolve({ data: null });
    documents.resolve({ data: [] });
  });
});
