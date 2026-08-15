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

describe('public GEO content visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    existsSyncMock.mockImplementation((value: string) => {
      if (value.includes('metadata')) return false;
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
});
