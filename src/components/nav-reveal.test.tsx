import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ pathname: '/apply/application-1/cv' }));

vi.mock('next/navigation', () => ({ usePathname: () => mocks.pathname }));
vi.mock('@/components/glowbal-logo', () => ({ GlowbalLogo: () => <span>GlowBal</span> }));
vi.mock('@/components/saved-nav-link', () => ({ SavedNavLink: () => <span>Saved</span> }));
vi.mock('@/lib/i18n', () => ({ useLanguage: () => ({ t: (value: string) => value }) }));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  }),
}));
vi.mock('@/shared/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/ui')>()),
  TopNav: () => <div data-testid="site-top-nav" />,
  MobileNav: () => <div data-testid="site-mobile-nav" />,
}));

import { NavReveal } from './nav-reveal';

describe('NavReveal', () => {
  it('renders the existing site navigation on document-workspace routes', () => {
    render(<NavReveal />);

    expect(screen.getByTestId('site-top-nav')).toBeVisible();
    expect(screen.getByTestId('site-mobile-nav')).toBeVisible();
  });
});
