import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  facets: vi.fn(),
  listPublished: vi.fn(),
  loadDirectory: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@/features/scholarships/api', () => ({
  getScholarshipQueries: () => ({
    facets: mocks.facets,
    listPublished: mocks.listPublished,
  }),
}));
vi.mock('@/features/scholarships/api/directory-loader', () => ({
  loadScholarshipDirectory: mocks.loadDirectory,
}));
vi.mock('@/app/scholarships/scholarship-directory-client', () => ({
  ScholarshipDirectoryClient: vi.fn(() => null),
}));

import ScholarshipsPage from '@/app/scholarships/page';

function query(result: unknown) {
  const resolved = Promise.resolve(result);
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  Object.assign(builder, {
    select: chain,
    eq: chain,
    in: chain,
    not: chain,
    order: chain,
    maybeSingle: () => resolved,
    then: resolved.then.bind(resolved),
  });
  return builder;
}

function clientFrom(page: any) {
  return page.props.children.props.children;
}

describe('ScholarshipsPage performance', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.facets.mockResolvedValue({ countries: [], total: 10 });
    mocks.listPublished.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 9,
      hasMore: false,
    });
    mocks.loadDirectory.mockResolvedValue({
      query: {
        search: '',
        universitySearch: '',
        major: 'all',
        degree: 'all',
        country: 'all',
        funding: [],
        sort: 'relevance',
        page: 1,
        universityId: null,
        countryPage: 1,
        view: 'directory',
      },
      directoryPage: { items: [], total: 0, page: 1, pageSize: 9, hasMore: false },
      focusPage: null,
      countryPage: null,
      focusUniversity: null,
      canonicalSearch: '',
    });
  });

  it('does not read application or AI resource tables for the directory view', async () => {
    const tables: string[] = [];
    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      from: vi.fn((table: string) => {
        tables.push(table);
        return query({ data: [], error: null });
      }),
    });

    const page = await ScholarshipsPage({ searchParams: Promise.resolve({}) });
    const client = clientFrom(page);

    expect(tables).not.toContain('course_applications');
    expect(tables).not.toContain('application_sources');
    expect(mocks.loadDirectory).toHaveBeenCalledOnce();
    expect(client.props.queryState.view).toBe('directory');
    expect(client.props.applications).toEqual([]);
    expect(client.props.existingScholarships).toEqual([]);
  });

  it('loads the existing AI data path only after view=ai is selected', async () => {
    const tables: string[] = [];
    const application = {
      id: 'app-1',
      university_name: 'Test University',
      course_name: 'Course',
      degree_level: null,
      subject: null,
      country: null,
      country_flag: null,
      intake: null,
      deadline: null,
      status: 'planning',
    };
    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      from: vi.fn((table: string) => {
        tables.push(table);
        if (table === 'course_applications') return query({ data: [application], error: null });
        if (table === 'application_sources') {
          return query({
            data: [
              {
                id: 'source-1',
                application_id: 'app-1',
                title: 'Award',
                description: null,
                url: null,
                confidence: 0.8,
              },
            ],
            error: null,
          });
        }
        return query({ data: [], error: null });
      }),
    });

    const page = await ScholarshipsPage({ searchParams: Promise.resolve({ view: 'ai' }) });
    const client = clientFrom(page);

    expect(tables).toContain('course_applications');
    expect(tables).toContain('application_sources');
    expect(mocks.loadDirectory).not.toHaveBeenCalled();
    expect(client.props.queryState.view).toBe('ai');
    expect(client.props.applications).toEqual([application]);
    expect(client.props.existingScholarships[0].confidence).toBe('0.8');
  });

  it('starts the public directory before the authentication request resolves', async () => {
    let resolveAuth!: (value: unknown) => void;
    const auth = new Promise((resolve) => {
      resolveAuth = resolve;
    });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn(() => auth) },
      from: vi.fn(() => query({ data: [], error: null })),
    });

    const render = ScholarshipsPage({ searchParams: Promise.resolve({}) });
    await vi.waitFor(() => expect(mocks.loadDirectory).toHaveBeenCalledOnce());
    resolveAuth({ data: { user: { id: 'user-1' } } });
    await render;
  });

  it('loads the browser Supabase client only when save state is mutated', () => {
    const client = readFileSync('src/app/scholarships/scholarship-directory-client.tsx', 'utf8');

    expect(client).not.toContain("import { createClient } from '@/lib/supabase/client'");
    expect(client).toContain("await import('@/lib/supabase/client')");
  });

  it('counts a scholarship as saved only when its destination is also in My Portal', async () => {
    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      from: vi.fn((table: string) => {
        if (table === 'user_universities') {
          return query({
            data: [{ university_id: 42, universities: { country: 'Canada' } }],
            error: null,
          });
        }
        if (table === 'user_scholarships') {
          return query({
            data: [
              { scholarship_id: 1, university_id: 42 },
              { scholarship_id: 2, university_id: null },
              { scholarship_id: 3, university_id: 99 },
            ],
            error: null,
          });
        }
        return query({ data: [], error: null });
      }),
    });

    const page = await ScholarshipsPage({ searchParams: Promise.resolve({}) });
    const client = clientFrom(page);

    expect(client.props.savedScholarships).toEqual([
      { scholarshipId: 1, universityId: 42 },
    ]);
  });
});
