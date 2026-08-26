import { describe, expect, it } from 'vitest';
import { isPublicIndexablePath, getRobotsDirectivesForPath } from './indexability';

describe('indexability contract', () => {
  const cases: Array<[path: string, expectedPublic: boolean]> = [
    // Public marketing / content routes
    ['/', true],
    ['/about', true],
    ['/how-it-works', true],
    ['/news', true],
    ['/news/uk-scholarships-guide-2026', true],
    ['/universities', true],
    ['/universities/1', true],
    ['/universities/vinuni', true],
    ['/advisors', true],
    ['/advisors/sarah-oxford', true],
    ['/scholarships', true],

    // Localized public routes
    ['/vi', true],
    ['/vi/about', true],
    ['/vi/how-it-works', true],
    ['/vi/news', true],
    ['/vi/news/sample-post', true],
    ['/vi/universities', true],
    ['/vi/universities/1', true],
    ['/vi/advisors', true],
    ['/vi/advisors/sarah-oxford', true],
    ['/vi/scholarships', true],

    // Private / authenticated / application routes
    ['/auth', false],
    ['/auth/callback', false],
    ['/auth/complete-profile', false],
    ['/apply', false],
    ['/apply/app_123', false],
    ['/profile', false],
    ['/profile/academic', false],
    ['/profile/documents', false],
    ['/dashboard', false],
    ['/dashboard/advisor', false],
    ['/dashboard/bookings', false],
    ['/admin', false],
    ['/admin/news', false],
    ['/admin/users', false],
    ['/onboarding', false],
    ['/onboarding/complete', false],
    ['/ai-strategy', false],
    ['/ai-strategy/app_123', false],
    ['/ai-strategy/app_123/strategy', false],
    ['/ai-strategy/personal-report', false],
    ['/my-universities/program', false],
    ['/writer', false],
    ['/coordinator', false],
    ['/plus/success', false],
    ['/payment/status', false],
    ['/dev/kitchen-sink', false],
    ['/demo-throwaway', false],
  ];

  it.each(cases)('classifies %s as public=%s', (pathname, expected) => {
    expect(isPublicIndexablePath(pathname)).toBe(expected);
  });

  it('provides correct robots metadata for private vs public paths', () => {
    expect(getRobotsDirectivesForPath('/auth')).toEqual({ index: false, follow: false });
    expect(getRobotsDirectivesForPath('/apply/123')).toEqual({ index: false, follow: false });
    expect(getRobotsDirectivesForPath('/news/uk-scholarships')).toEqual({ index: true, follow: true });
    expect(getRobotsDirectivesForPath('/')).toEqual({ index: true, follow: true });
  });

  it('normalizes query params and trailing slashes correctly', () => {
    expect(isPublicIndexablePath('/auth?redirect=%2Fapply')).toBe(false);
    expect(isPublicIndexablePath('/news/my-slug/')).toBe(true);
    expect(isPublicIndexablePath('/about?source=email')).toBe(true);
  });
});
