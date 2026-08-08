import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ load: vi.fn() }));

vi.mock('@/features/universities/api/directory-loader', () => ({
  loadUniversityDirectory: mocks.load,
}));

import { GET } from './route';

describe('GET /api/directory/universities', () => {
  beforeEach(() => vi.resetAllMocks());

  it('normalizes public query params and sets CDN cache headers', async () => {
    mocks.load.mockResolvedValue({
      query: { search: 'Oxford', country: '', page: 2 },
      page: { items: [], total: 0, page: 2, pageSize: 9, hasMore: false },
      wikiPairs: [],
      canonicalSearch: 'q=Oxford&page=2',
    });

    const response = await GET(
      new Request('https://example.test/api/directory/universities?q=%20Oxford%20&page=2'),
    );

    expect(mocks.load).toHaveBeenCalledWith({ search: 'Oxford', country: '', page: 2 });
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toContain('stale-while-revalidate=300');
    expect(response.headers.get('Vercel-CDN-Cache-Control')).toContain('max-age=43200');
  });
});
