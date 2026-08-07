import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  session: {
    ready: false,
    signedIn: false,
    completed: false,
    user: null as { id: string; name: string; avatarUrl?: string } | null,
  },
}));

vi.mock('next/link', () => ({ default: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@/components/glowbal-logo', () => ({ GlowbalLogo: () => <span>GlowBal</span> }));
vi.mock('@/components/saved-nav-link', () => ({ SavedNavLink: () => <span>Saved</span> }));
vi.mock('@/components/navigation-session', () => ({
  useNavigationSession: () => mocks.session,
}));
vi.mock('@/lib/i18n', () => ({
  useLanguage: () => ({ t: (label: string) => label }),
}));
vi.mock('@/shared/ui', () => ({
  BRAND_ICONS: { facebook: {} },
  BrandIcon: () => <span />,
  InstagramMark: () => <span />,
  TopNav: (props: {
    items: Array<{ label: string }>;
    primaryAction?: { label: string };
    secondaryAction?: { label: string };
    user?: { label?: string };
  }) => (
    <div
      data-testid="desktop-nav"
      data-items={props.items.map((item) => item.label).join('|')}
      data-primary={props.primaryAction?.label ?? ''}
      data-account={props.user?.label ?? props.secondaryAction?.label ?? ''}
    />
  ),
  MobileNav: (props: {
    primaryAction?: { label: string };
    secondaryAction?: { label: string };
  }) => (
    <div
      data-testid="mobile-nav"
      data-primary={props.primaryAction?.label ?? ''}
      data-account={props.secondaryAction?.label ?? ''}
    />
  ),
}));

import { SiteNavigation } from './site-navigation';

describe('SiteNavigation', () => {
  it('withholds first-time actions while the session is unresolved', () => {
    mocks.session = {
      ready: false,
      signedIn: false,
      completed: false,
      user: null,
    };

    render(<SiteNavigation />);

    expect(screen.getByTestId('desktop-nav')).toHaveAttribute('data-primary', '');
    expect(screen.getByTestId('desktop-nav')).toHaveAttribute('data-account', '');
  });

  it('shows Register and the onboarding CTA to a new visitor', () => {
    mocks.session = {
      ready: true,
      signedIn: false,
      completed: false,
      user: null,
    };

    render(<SiteNavigation />);

    expect(screen.getByTestId('desktop-nav')).toHaveAttribute(
      'data-primary',
      'Plan your Global Education',
    );
    expect(screen.getByTestId('mobile-nav')).toHaveAttribute('data-account', 'Register');
  });

  it('promotes Strategy Master and User Profile after onboarding', () => {
    mocks.session = {
      ready: true,
      signedIn: true,
      completed: true,
      user: { id: 'student-1', name: 'Student' },
    };

    render(<SiteNavigation />);

    const desktop = screen.getByTestId('desktop-nav');
    expect(desktop).toHaveAttribute('data-primary', 'Strategy Master');
    expect(desktop).toHaveAttribute('data-account', 'User Profile');
    expect(desktop).not.toHaveAttribute('data-items', expect.stringContaining('Strategy Master'));
  });
});
