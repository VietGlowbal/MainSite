import { describe, expect, it } from 'vitest';
import { getLocaleFromPath, homeCopy, localizePath } from './locale';

describe('localizePath', () => {
  it.each([
    ['/', 'vi', '/vi'],
    ['/vi', 'en', '/'],
    ['/universities', 'vi', '/vi/universities'],
    ['/vi/universities', 'en', '/universities'],
    ['/universities/42', 'vi', '/vi/universities/42'],
    ['/vi/universities/42', 'en', '/universities/42'],
    ['/news/test-slug?x=1', 'vi', '/vi/news/test-slug?x=1'],
    ['/news/test-slug#details', 'vi', '/vi/news/test-slug#details'],
  ] as const)('maps %s to %s', (path, locale, expected) => {
    expect(localizePath(path, locale)).toBe(expected);
  });

  it('does not double-prefix or invent private locale routes', () => {
    expect(localizePath('/vi/news/test-slug', 'vi')).toBe('/vi/news/test-slug');
    expect(localizePath('/profile', 'vi')).toBe('/profile');
    expect(localizePath('/universities/matches', 'vi')).toBe('/universities/matches');
    expect(localizePath('/advisors/apply', 'vi')).toBe('/advisors/apply');
  });

  it('detects the route locale', () => {
    expect(getLocaleFromPath('/vi/universities/42')).toBe('vi');
    expect(getLocaleFromPath('/universities/42')).toBe('en');
  });

  it('uses the established Vietnamese homepage copy', () => {
    expect(homeCopy.vi.title).toBe('Giải pháp công nghệ toàn diện dành cho “dân săn học bổng”');
  });
});
