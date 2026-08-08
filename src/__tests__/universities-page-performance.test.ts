import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const mocks = vi.hoisted(() => ({
  loadDirectory: vi.fn(),
  getFacets: vi.fn(),
  client: vi.fn(() => null),
}));

vi.mock('@/features/universities/api/directory-loader', () => ({
  loadUniversityDirectory: mocks.loadDirectory,
  getUniversityFacets: mocks.getFacets,
}));
vi.mock('@/app/universities/university-list-client', () => ({
  UniversityListClient: mocks.client,
}));

import UniversitiesPage from '@/app/universities/page';

describe('UniversitiesPage performance', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.loadDirectory.mockResolvedValue({
      query: { search: 'Oxford', country: '', page: 1 },
      page: { items: [], total: 0, page: 1, pageSize: 9, hasMore: false },
      wikiPairs: [],
      canonicalSearch: 'q=Oxford',
    });
    mocks.getFacets.mockResolvedValue({ countries: [], total: 0 });
  });

  it('uses the shared public loader without fetching scholarship rows', async () => {
    const page = await UniversitiesPage({ searchParams: Promise.resolve({ q: 'Oxford' }) });

    expect(mocks.loadDirectory).toHaveBeenCalledWith({
      search: 'Oxford',
      country: '',
      page: 1,
    });
    const client = page.props.children[0];
    expect(client.type).toBe(mocks.client);
    expect(client.props.universities).toEqual([]);
  });

  it('does not remount cards after identity hydration or load the globe video in its skeleton', () => {
    const client = readFileSync('src/app/universities/university-list-client.tsx', 'utf8');
    const loading = readFileSync('src/app/universities/loading.tsx', 'utf8');

    expect(client).not.toContain("key={authState?.id ?? 'guest'}");
    expect(loading).not.toContain('PageLoaderOverlay');
  });

  it('preloads only the first directory image because it is the mobile LCP', () => {
    const client = readFileSync('src/app/universities/university-list-client.tsx', 'utf8');
    const image = readFileSync('src/app/universities/fade-in-image.tsx', 'utf8');

    expect(client).toContain('preloadImage={index === 0}');
    expect(image).toContain('preload={preload}');
  });

  it('keeps Supabase out of the initial directory bundle', () => {
    const client = readFileSync('src/app/universities/university-list-client.tsx', 'utf8');
    const provider = readFileSync('src/features/universities/ui/explorer-context.tsx', 'utf8');

    expect(client).not.toContain("import { createClient } from '@/lib/supabase/client'");
    expect(provider).not.toContain("import { createClient } from '@/lib/supabase/client'");
    expect(client).toContain("await import('@/lib/supabase/client')");
    expect(provider).toContain("await import('@/lib/supabase/client')");
  });

  it('keeps the dynamic save label out of the DOM translator snapshot', () => {
    const client = readFileSync('src/app/universities/university-list-client.tsx', 'utf8');

    expect(client).toMatch(/data-no-auto-translate[\s\S]*aria-pressed=\{saved\}[\s\S]*aria-label=\{saved/);
  });
});
