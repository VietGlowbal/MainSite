import { describe, expect, it } from 'vitest';
import { getMarketingNavPresentation } from './nav-items';

describe('getMarketingNavPresentation', () => {
  it('returns the new-user matrix and registration action for a guest', () => {
    expect(getMarketingNavPresentation({ signedIn: false, completed: false })).toEqual({
      items: [
        { href: '/', label: 'Home' },
        { href: '/news', label: 'GlowBal News' },
        {
          label: 'Search',
          items: [
            { href: '/scholarships', label: 'Scholarships' },
            { href: '/universities', label: 'Universities' },
            { href: '/advisors', label: 'Advisors' },
          ],
        },
        { href: '/ai-strategy', label: 'Strategy Master' },
        { href: '/apply', label: 'My Portal' },
      ],
      primaryAction: { href: '/onboarding', label: 'Plan your Global Education' },
      accountAction: { href: '/auth?mode=signup', label: 'Register' },
    });
  });

  it('keeps onboarding and Strategy Master visible for a signed-in incomplete student', () => {
    const presentation = getMarketingNavPresentation({ signedIn: true, completed: false });

    expect(presentation.items.map((item) => item.label)).toEqual([
      'Home',
      'GlowBal News',
      'Search',
      'Strategy Master',
      'My Portal',
    ]);
    expect(presentation.primaryAction).toEqual({
      href: '/onboarding',
      label: 'Plan your Global Education',
    });
    expect(presentation.accountAction).toEqual({ href: '/profile', label: 'User Profile' });
  });

  it('promotes Strategy Master after completion and translates the whole presentation', () => {
    const presentation = getMarketingNavPresentation(
      { signedIn: true, completed: true },
      (label) => `translated:${label}`,
    );

    expect(presentation.items.map((item) => item.label)).toEqual([
      'translated:Home',
      'translated:GlowBal News',
      'translated:Search',
      'translated:My Portal',
    ]);
    expect(presentation.items[2]).toEqual({
      label: 'translated:Search',
      items: [
        { href: '/scholarships', label: 'translated:Scholarships' },
        { href: '/universities', label: 'translated:Universities' },
        { href: '/advisors', label: 'translated:Advisors' },
      ],
    });
    expect(presentation.primaryAction).toEqual({
      href: '/ai-strategy',
      label: 'translated:Strategy Master',
    });
    expect(presentation.accountAction).toEqual({
      href: '/profile',
      label: 'translated:User Profile',
    });
  });
});
