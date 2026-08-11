import { describe, expect, it } from 'vitest';
import { findMissingStaticKeys, placeholders, routeFromPageFile } from '@/lib/i18n-audit';

describe('i18n static audit helpers', () => {
  it('reports missing dictionary keys while ignoring dynamic and private content', () => {
    expect(
      findMissingStaticKeys(
        [
          { key: 'Home', route: '/' },
          { key: 'New copy', route: '/about' },
          { key: 'Private name', route: '/profile' },
          { key: 'Admin copy', route: '/admin' },
        ],
        { Home: 'Trang chủ' },
      ),
    ).toEqual([{ key: 'New copy', route: '/about' }]);
  });

  it('extracts placeholders deterministically for parity checks', () => {
    expect(placeholders('Read {count} articles for {name}')).toEqual(['count', 'name']);
  });

  it('maps page files to unchanged route URLs', () => {
    expect(routeFromPageFile('src/app/news/[slug]/page.tsx')).toBe('/news/[slug]');
    expect(routeFromPageFile('src/app/apply/[applicationId]/(features)/cv/page.tsx')).toBe('/apply/[applicationId]/cv');
  });
});
