import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({ default: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@/components/glowbal-logo', () => ({ GlowbalLogo: () => <span>GlowBal</span> }));
vi.mock('@/components/saved-nav-link', () => ({ SavedNavLink: () => <span>Saved</span> }));
vi.mock('@/features/marketing/ui', () => ({ MARKETING_NAV_ITEMS: [] }));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: () => Promise.resolve({
        data: {
          user: {
            email: 'student@example.com',
            user_metadata: { full_name: 'Test Student' },
          },
        },
      }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  }),
}));
vi.mock('@/shared/ui', () => ({
  TopNav: ({ user, secondaryAction }: { user?: { name: string }; secondaryAction?: { label: string } }) => (
    <div>{user?.name ?? secondaryAction?.label}</div>
  ),
  MobileNav: () => <div />,
}));

import { MarketingNavigation } from './marketing-navigation';

describe('MarketingNavigation', () => {
  it('renders guest-first and hydrates the saved session identity', async () => {
    render(<MarketingNavigation />);

    expect(screen.getByText('Sign in')).toBeVisible();
    expect(await screen.findByText('Test Student')).toBeVisible();
  });
});
