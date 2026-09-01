import { act, render, screen, within } from '@testing-library/react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  session: {
    ready: false,
    signedIn: false,
    completed: false,
    user: null as { id: string; name: string; avatarUrl?: string } | null,
  },
  language: {
    lang: 'en' as 'en' | 'vi',
    t: (label: string) => label,
  },
  roles: null as {
    userId: string;
    isAdvisor: boolean;
    isAdmin: boolean;
    isCoordinator: boolean;
  } | null,
}));

vi.mock('next/link', () => ({ default: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
vi.mock('@/components/glowbal-logo', () => ({ GlowbalLogo: () => <span>GlowBal</span> }));
vi.mock('@/components/saved-nav-link', () => ({ SavedNavLink: () => <span>Saved</span> }));
vi.mock('@/components/navigation-session', () => ({
  useNavigationSession: () => mocks.session,
}));
vi.mock('@/components/navigation-roles', () => ({
  useNavigationRoles: () => mocks.roles,
  withNavigationRoleItems: (
    items: Array<{ href?: string; label: string }>,
    roles: typeof mocks.roles,
    t: (label: string) => string,
  ) => [
    ...items,
    ...(roles?.isAdvisor
      ? [{ href: '/dashboard/advisor', label: t('Advisor hub') }]
      : []),
    ...(roles?.isCoordinator
      ? [{ href: '/coordinator', label: t('Coordinator') }]
      : []),
    ...(roles?.isAdmin ? [{ href: '/admin', label: t('Admin') }] : []),
  ],
}));
vi.mock('@/lib/i18n', () => ({
  useLanguage: () => mocks.language,
}));
vi.mock('@/shared/ui', () => ({
  BRAND_ICONS: { facebook: {} },
  ICONS: {
    chartBreakoutSquare: {},
    messageChatCircle: {},
    messageSmileCircle: {},
    zap: {},
    zapFast: {},
  },
  BrandIcon: () => <span />,
  InstagramMark: () => <span />,
  TopNav: (props: {
    items: Array<{ label: string }>;
    primaryAction?: { label: string };
    secondaryAction?: { label: string };
    user?: { name: string };
  }) => (
    <div
      data-testid="desktop-nav"
      data-items={props.items.map((item) => item.label).join('|')}
      data-primary={props.primaryAction?.label ?? ''}
      data-account={props.user?.name ?? props.secondaryAction?.label ?? ''}
    />
  ),
  MobileNav: (props: {
    items: Array<{ label: string }>;
    primaryAction?: { label: string };
    secondaryAction?: { label: string };
  }) => (
    <div
      data-testid="mobile-nav"
      data-items={props.items.map((item) => item.label).join('|')}
      data-primary={props.primaryAction?.label ?? ''}
      data-account={props.secondaryAction?.label ?? ''}
    />
  ),
}));

import { SiteNavigation } from './site-navigation';

describe('SiteNavigation', () => {
  beforeEach(() => {
    mocks.roles = null;
  });

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

  it('promotes Strategy Master and shows the user name after onboarding', () => {
    mocks.session = {
      ready: true,
      signedIn: true,
      completed: true,
      user: { id: 'student-1', name: 'Student' },
    };

    render(<SiteNavigation />);

    const desktop = screen.getByTestId('desktop-nav');
    expect(desktop).toHaveAttribute('data-primary', 'Strategy Master');
    expect(desktop).toHaveAttribute('data-account', 'Student');
    expect(desktop).not.toHaveAttribute('data-items', expect.stringContaining('Strategy Master'));
  });

  it('shows signed-in role destinations on pages that own their header', () => {
    mocks.session = {
      ready: true,
      signedIn: true,
      completed: true,
      user: { id: 'staff-1', name: 'Staff User' },
    };
    mocks.roles = {
      userId: 'staff-1',
      isAdvisor: true,
      isCoordinator: true,
      isAdmin: true,
    };

    render(<SiteNavigation />);

    expect(screen.getByTestId('desktop-nav')).toHaveAttribute(
      'data-items',
      expect.stringContaining('Advisor hub|Coordinator|Admin'),
    );
    expect(screen.getByTestId('mobile-nav')).toHaveAttribute(
      'data-items',
      expect.stringContaining('Advisor hub|Coordinator|Admin'),
    );
  });

  it('recomputes the Strategy Master pill in both directions', () => {
    mocks.session = {
      ready: true,
      signedIn: true,
      completed: true,
      user: { id: 'student-1', name: 'Student' },
    };
    const view = render(<SiteNavigation />);
    expect(screen.getByTestId('desktop-nav')).toHaveAttribute(
      'data-primary',
      'Strategy Master',
    );

    mocks.language = {
      lang: 'vi',
      t: (label) => (label === 'Strategy Master' ? 'Công Cụ Lên Chiến Lược' : label),
    };
    view.rerender(<SiteNavigation />);
    expect(screen.getByTestId('desktop-nav')).toHaveAttribute(
      'data-primary',
      'Công Cụ Lên Chiến Lược',
    );

    mocks.language = {
      lang: 'en',
      t: (label) => label,
    };
    view.rerender(<SiteNavigation />);
    expect(screen.getByTestId('desktop-nav')).toHaveAttribute(
      'data-primary',
      'Strategy Master',
    );
  });

  it('keeps the server snapshot stable when the session resolves before hydration', async () => {
    mocks.session = {
      ready: false,
      signedIn: false,
      completed: false,
      user: null,
    };

    const container = document.createElement('div');
    container.innerHTML = renderToString(<SiteNavigation />);
    document.body.appendChild(container);

    // A streamed navigation boundary can hydrate after its parent provider has
    // already resolved. Its first client render must still match the server.
    mocks.session = {
      ready: true,
      signedIn: false,
      completed: false,
      user: null,
    };

    const recoverableErrors: unknown[] = [];
    let root: Root | undefined;
    await act(async () => {
      root = hydrateRoot(container, <SiteNavigation />, {
        onRecoverableError: (error) => recoverableErrors.push(error),
      });
    });

    expect(recoverableErrors).toEqual([]);
    expect(within(container).getAllByTestId('desktop-nav')).toHaveLength(1);
    expect(within(container).getByTestId('desktop-nav')).toHaveAttribute(
      'data-primary',
      'Plan your Global Education',
    );

    act(() => root?.unmount());
    container.remove();
  });
});
