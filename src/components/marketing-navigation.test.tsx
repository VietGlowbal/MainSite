import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/site-navigation', () => ({
  SiteNavigation: ({ tone, showSaved }: { tone: string; showSaved: boolean }) => (
    <div data-testid="site-navigation" data-tone={tone} data-saved={String(showSaved)} />
  ),
}));

import { MarketingNavigation } from './marketing-navigation';

describe('MarketingNavigation', () => {
  it('delegates to the canonical completion-aware site navigation', () => {
    render(<MarketingNavigation tone="dark" showSaved />);

    expect(screen.getByTestId('site-navigation')).toHaveAttribute('data-tone', 'dark');
    expect(screen.getByTestId('site-navigation')).toHaveAttribute('data-saved', 'true');
  });
});
