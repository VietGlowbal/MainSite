import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const runtime = vi.hoisted(() => ({ catalog: {} as Record<string, string> }));
vi.mock('@/lib/i18n-catalog-runtime', () => ({
  getCatalog: () => runtime.catalog,
  isCatalogLoaded: () => true,
  loadCatalog: async () => runtime.catalog,
  primeCatalog: (catalog: Record<string, string>) => { runtime.catalog = catalog; },
}));
import { LanguageProvider, T } from '@/lib/i18n';
import { primeCatalog } from '@/lib/i18n-catalog-runtime';
function PrimedChild() {
  primeCatalog({ 'Privacy settings': 'Cài đặt quyền riêng tư' });
  return <T k="Privacy settings" />;
}
describe('streamed translation catalog', () => {
  beforeEach(() => { runtime.catalog = {}; });
  it('uses the catalog primed by a child after the root provider rendered', () => {
    const html = renderToString(<LanguageProvider defaultLang="vi"><PrimedChild /></LanguageProvider>);
    expect(html).toBe('Cài đặt quyền riêng tư');
  });
  it('keeps English independent of a catalog primed during rendering', () => {
    const html = renderToString(<LanguageProvider defaultLang="en"><PrimedChild /></LanguageProvider>);
    expect(html).toBe('Privacy settings');
  });
});
