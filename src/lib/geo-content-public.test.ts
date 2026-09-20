import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createAdminClientMock } = vi.hoisted(() => ({ createAdminClientMock: vi.fn() }));

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: createAdminClientMock }));

import { getGeoGuide, listGeoGuides } from './geo-content';

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
    createAdminClientMock.mockReturnValue(dbClient({ rows: [] }));
  });

  it('renders a publishable row', async () => {
    createAdminClientMock.mockReturnValue(dbClient({ rows: [dbRow()], single: dbRow() }));

    expect((await listGeoGuides()).map((g) => g.slug)).toEqual(['db-published-slug']);
    expect(await getGeoGuide('db-published-slug')).toEqual(
      expect.objectContaining({ status: 'published', slug: 'db-published-slug' }),
    );
  });

  /*
   * The markdown generator was removed on 2026-09-20, but the rows it wrote
   * outlive it, so the placeholder gate below still has work to do.
   */
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

  /*
   * The list and article templates render <Image src={guide.heroImage}>
   * unconditionally, so a row with no cover must still hand them a servable
   * path — an empty string throws in next/image.
   */
  it('falls back to a servable placeholder cover when the row has no hero image', async () => {
    createAdminClientMock.mockReturnValue(dbClient({ single: dbRow({ hero_image: null }) }));

    const guide = await getGeoGuide('db-published-slug');
    expect(guide?.heroImage).toBe('/news/placeholder-cover.svg');
    expect(guide?.heroImageStyle).toBe('svg-fallback');
  });

  it('keeps the row’s own cover when it has one', async () => {
    createAdminClientMock.mockReturnValue(
      dbClient({ single: dbRow({ hero_image: '/news-images/campus.webp', hero_image_style: 'ai' }) }),
    );

    const guide = await getGeoGuide('db-published-slug');
    expect(guide?.heroImage).toBe('/news-images/campus.webp');
    expect(guide?.heroImageStyle).toBe('ai');
  });

  it('degrades to an empty list when the CMS is unreachable', async () => {
    createAdminClientMock.mockImplementation(() => {
      throw new Error('no supabase env at build time');
    });

    expect(await listGeoGuides()).toEqual([]);
    expect(await getGeoGuide('db-published-slug')).toBeNull();
  });
});
