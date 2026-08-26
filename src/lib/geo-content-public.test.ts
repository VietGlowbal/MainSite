import { beforeEach, describe, expect, it, vi } from 'vitest';

const { existsSyncMock, readdirSyncMock, readFileSyncMock, createAdminClientMock } = vi.hoisted(() => ({
  existsSyncMock: vi.fn(),
  readdirSyncMock: vi.fn(),
  readFileSyncMock: vi.fn(),
  createAdminClientMock: vi.fn(),
}));

vi.mock('node:fs', () => ({
  default: { existsSync: existsSyncMock, readdirSync: readdirSyncMock, readFileSync: readFileSyncMock },
}));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: createAdminClientMock }));

import { getGeoGuide, listGeoGuides, listLegacyFileGuides } from './geo-content';

/** A published DB row; fields mirror the geo_articles columns the reader selects. */
function dbRow(overrides: Record<string, unknown> = {}) {
  return {
    slug: 'db-published-slug',
    title: 'A useful guide',
    description: 'A useful summary',
    excerpt: 'A useful summary',
    key_takeaway: null,
    body: 'Body prose without markers.',
    topic: 'Universities',
    tags: [],
    hero_image: null,
    hero_image_style: null,
    reading_time_minutes: 4,
    meta: {},
    published_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-20T00:00:00Z',
    ...overrides,
  };
}

/**
 * Supabase client stub. `rows` answers awaited/list chains, `single` answers
 * maybeSingle()/single() chains — the readers use both shapes.
 */
function dbClient({ rows = [], single = null }: { rows?: unknown[]; single?: unknown }) {
  const terminalSingle = () => Promise.resolve({ data: single, error: null });
  const chain: Record<string, unknown> = {};
  const link = (): unknown =>
    new Proxy(chain, {
      get(_target, prop: string) {
        if (prop === 'then') {
          // Await protocol: must invoke the caller's callbacks.
          return (resolve: (value: unknown) => void, reject: (reason?: unknown) => void) =>
            Promise.resolve({ data: rows, error: null }).then(resolve, reject);
        }
        if (prop === 'maybeSingle' || prop === 'single') return terminalSingle;
        return () => link();
      },
    });
  return { from: () => ({ select: () => link(), update: () => link(), insert: () => link() }) };
}

describe('public GEO content visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    existsSyncMock.mockImplementation((value: string) => {
      if (value.includes('metadata')) return false;
      if (value.includes('db-published-slug')) return false;
      if (value.includes('published') && value.includes('draft-slug')) return false;
      return true;
    });
    readdirSyncMock.mockImplementation((value: string) => value.includes('published') ? ['published-slug.md'] : ['draft-slug.md']);
    readFileSyncMock.mockImplementation((value: string) => {
      const slug = value.includes('published-slug') ? 'published-slug' : 'draft-slug';
      return `---\ntitle: ${slug}\nslug: ${slug}\ndescription: Summary\nlastUpdated: 2026-08-14\n---\nBody`;
    });
    createAdminClientMock.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(async () => ({ data: [], error: null })),
        })),
      })),
    });
  });

  it('keeps legacy drafts available for import but never exposes them publicly', async () => {
    const publicGuides = await listGeoGuides();
    const legacyGuides = listLegacyFileGuides();

    expect(publicGuides.map((guide) => guide.slug)).toEqual(['published-slug']);
    expect(legacyGuides.map((guide) => guide.slug).sort()).toEqual(['draft-slug', 'published-slug']);
    expect(await getGeoGuide('draft-slug')).toBeNull();
    expect(await getGeoGuide('published-slug')).toEqual(expect.objectContaining({ status: 'published' }));
  });

  it('never exposes a DB row marked published while a same-slug legacy draft exists unless the row is publishable', async () => {
    // The slug collides with the legacy draft file, but only the row's own
    // quality decides whether the DB copy may render.
    createAdminClientMock.mockReturnValue(dbClient({ single: dbRow({ slug: 'draft-slug' }) }));

    expect(await getGeoGuide('draft-slug')).toEqual(expect.objectContaining({ status: 'published', slug: 'draft-slug' }));
  });

  it('hides a published row whose description still carries generator draft copy', async () => {
    createAdminClientMock.mockReturnValue(
      dbClient({ rows: [dbRow({ description: 'A Glowbal draft guide for vietnamese applicants' })] }),
    );

    expect((await listGeoGuides()).map((g) => g.slug)).not.toContain('db-published-slug');

    createAdminClientMock.mockReturnValue(
      dbClient({ single: dbRow({ description: 'A Glowbal draft guide for vietnamese applicants' }) }),
    );
    expect(await getGeoGuide('db-published-slug')).toBeNull();
  });

  it('hides a published row whose body still carries TODO_SOURCE_REQUIRED markers', async () => {
    const gatedRow = dbRow({ body: 'Tuition is £24,000. TODO_SOURCE_REQUIRED: official fee page' });
    createAdminClientMock.mockReturnValue(dbClient({ rows: [gatedRow] }));

    expect((await listGeoGuides()).map((g) => g.slug)).not.toContain('db-published-slug');

    createAdminClientMock.mockReturnValue(dbClient({ single: gatedRow }));
    expect(await getGeoGuide('db-published-slug')).toBeNull();
  });

  it('hides a legacy file guide whose frontmatter description is generator draft copy', async () => {
    readFileSyncMock.mockImplementation((value: string) => {
      const slug = value.includes('published-slug') ? 'published-slug' : 'draft-slug';
      const description = slug === 'published-slug' ? 'placeholder summary pending review' : 'Summary';
      return `---\ntitle: ${slug}\nslug: ${slug}\ndescription: ${description}\nlastUpdated: 2026-08-14\n---\nBody`;
    });

    expect((await listGeoGuides()).map((g) => g.slug)).toEqual([]);
    expect(await getGeoGuide('published-slug')).toBeNull();
  });
});

