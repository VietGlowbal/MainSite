import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ load: vi.fn() }));

vi.mock('@/features/scholarships/api/directory-loader', () => ({
  loadScholarshipDirectory: mocks.load,
}));

import { GET } from './route';

describe('GET /api/directory/scholarships', () => {
  beforeEach(() => vi.resetAllMocks());

  it('rejects the personalized AI view', async () => {
    const response = await GET(
      new Request('https://example.test/api/directory/scholarships?view=ai'),
    );

    expect(response.status).toBe(400);
    expect(mocks.load).not.toHaveBeenCalled();
  });

  it('returns only the public directory payload with CDN cache headers', async () => {
    mocks.load.mockResolvedValue({
      query: { page: 1, view: 'directory' },
      directoryPage: { items: [], total: 0, page: 1, pageSize: 9, hasMore: false },
      focusPage: null,
      countryPage: null,
      focusUniversity: null,
      canonicalSearch: '',
    });

    const response = await GET(
      new Request('https://example.test/api/directory/scholarships?funding=need,need'),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toContain('max-age=60');
    expect(response.headers.get('Vercel-CDN-Cache-Control')).toContain('stale-while-revalidate=86400');
    expect(payload).not.toHaveProperty('userId');
    expect(payload).not.toHaveProperty('savedScholarshipIds');
  });
});
