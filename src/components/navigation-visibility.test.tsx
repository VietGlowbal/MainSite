import { describe, expect, it } from 'vitest';
import {
  normalizeNavigationPathname,
  suppressesGlobalNavigation,
} from './navigation-visibility';

describe('navigation visibility', () => {
  it('normalizes trailing slashes before choosing the navigation owner', () => {
    expect(normalizeNavigationPathname('/')).toBe('/');
    expect(normalizeNavigationPathname('/universities/')).toBe('/universities');
    expect(normalizeNavigationPathname('/universities///')).toBe('/universities');
  });

  it.each([
    '/',
    '/universities',
    '/universities/',
    '/universities/42',
    '/universities/42/',
    '/apply',
    '/apply/application-1',
    '/apply/application-1/lor-feedback',
    '/ai-strategy',
    '/ai-strategy/application-1',
    '/about',
    '/news',
    '/onboarding',
    '/plus',
    '/advisors',
    '/advisors/123e4567-e89b-12d3-a456-426614174000',
  ])('suppresses the root header when %s owns page chrome', (pathname) => {
    expect(suppressesGlobalNavigation(pathname)).toBe(true);
  });

  it.each([
    '/profile',
    '/scholarships',
    '/news/article-slug',
    '/universities/vinuni',
    '/advisors/apply',
    '/apply/application-1/cv',
    '/apply/application-1/statement',
  ])('keeps the root header on %s', (pathname) => {
    expect(suppressesGlobalNavigation(pathname)).toBe(false);
  });
});
