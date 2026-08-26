import { describe, expect, it, vi } from 'vitest';
import sitemap from './sitemap';
import { SITE_URL } from '@/lib/site-url';

vi.mock('@/lib/geo-content', () => ({
  listGeoGuides: vi.fn().mockResolvedValue([
    {
      slug: 'guide-one',
      title: 'Guide One',
      description: 'First guide',
      status: 'published',
      publishedAt: '2026-08-01',
      updatedAt: '2026-08-15',
    },
    {
      slug: 'guide-two',
      title: 'Guide Two',
      description: 'Second guide',
      status: 'published',
      publishedAt: '2026-08-10',
    },
  ]),
}));

vi.mock('@/features/universities/api', () => ({
  getUniversityQueries: vi.fn().mockReturnValue({
    list: vi.fn().mockResolvedValue({
      items: [{ id: 1, name: 'Oxford' }, { id: 2, name: 'Cambridge' }],
      hasMore: false,
    }),
  }),
}));

describe('sitemap', () => {
  it('includes public marketing routes and excludes private/auth routes', async () => {
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    // Should include public routes
    expect(urls).toContain(`${SITE_URL}`);
    expect(urls).toContain(`${SITE_URL}/about`);
    expect(urls).toContain(`${SITE_URL}/how-it-works`);
    expect(urls).toContain(`${SITE_URL}/news`);
    expect(urls).toContain(`${SITE_URL}/universities`);
    expect(urls).toContain(`${SITE_URL}/advisors`);
    expect(urls).toContain(`${SITE_URL}/scholarships`);

    // Should NOT include private routes
    expect(urls).not.toContain(`${SITE_URL}/apply`);
    expect(urls).not.toContain(`${SITE_URL}/auth`);
    expect(urls).not.toContain(`${SITE_URL}/profile`);
    expect(urls).not.toContain(`${SITE_URL}/dashboard`);
    expect(urls).not.toContain(`${SITE_URL}/admin`);
  });

  it('includes published news guides with truthful timestamps', async () => {
    const entries = await sitemap();
    const guideOne = entries.find((entry) => entry.url === `${SITE_URL}/news/guide-one`);
    const guideTwo = entries.find((entry) => entry.url === `${SITE_URL}/news/guide-two`);

    expect(guideOne).toBeDefined();
    expect(guideOne?.lastModified).toEqual(new Date('2026-08-15'));

    expect(guideTwo).toBeDefined();
    expect(guideTwo?.lastModified).toEqual(new Date('2026-08-10'));
  });

  it('includes university detail pages', async () => {
    const entries = await sitemap();
    const uniOne = entries.find((entry) => entry.url === `${SITE_URL}/universities/1`);
    const uniTwo = entries.find((entry) => entry.url === `${SITE_URL}/universities/2`);

    expect(uniOne).toBeDefined();
    expect(uniTwo).toBeDefined();
  });

  it('includes localized /vi routes with reciprocal alternates', async () => {
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toContain(`${SITE_URL}/vi`);
    expect(urls).toContain(`${SITE_URL}/vi/about`);
    expect(urls).toContain(`${SITE_URL}/vi/how-it-works`);
    expect(urls).toContain(`${SITE_URL}/vi/news`);
    expect(urls).toContain(`${SITE_URL}/vi/scholarships`);
    expect(urls).toContain(`${SITE_URL}/vi/universities`);
    expect(urls).toContain(`${SITE_URL}/vi/advisors`);
    expect(urls).toContain(`${SITE_URL}/vi/news/guide-one`);
    expect(urls).toContain(`${SITE_URL}/vi/universities/1`);

    const aboutEntry = entries.find((entry) => entry.url === `${SITE_URL}/about`);
    expect(aboutEntry?.alternates?.languages).toEqual({
      en: `${SITE_URL}/about`,
      vi: `${SITE_URL}/vi/about`,
    });
  });

  it('is deterministic across repeated calls with identical data', async () => {
    const run1 = await sitemap();
    const run2 = await sitemap();

    expect(run1).toEqual(run2);
  });
});
