import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
const mocks = vi.hoisted(() => ({ prefetch: vi.fn(), pathname: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: mocks.pathname, useRouter: () => ({ prefetch: mocks.prefetch }),
}));
vi.mock('@/lib/i18n', () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
vi.mock('@/shared/ui', async () => ({ SubNav: (await import('@/shared/ui/sub-nav')).SubNav }));
vi.mock('@/shared/ui/glowbal-icon', () => ({ GlowbalIcon: () => null }));
import { ApplicationSubNav } from './application-sub-nav';
const items = [
  { key: 'personalReport', label: 'Personal Report', href: '/ai-strategy/personal-report?return=app' },
  { key: 'matchingReport', label: 'Matching Report', href: '/ai-strategy/app/matching-report' },
  { key: 'planner', label: 'Planner', href: '/ai-strategy/app/planner' },
  { key: 'strategyReport', label: 'Strategy Report', href: '/ai-strategy/app/strategy-report', locked: true },
];
describe('application report prefetch intent', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.pathname.mockReturnValue('/ai-strategy/personal-report'); });
  it('warms an accessible report on hover, focus or touch without eagerly warming all workspaces', () => {
    render(<ApplicationSubNav items={items} />);
    expect(mocks.prefetch).not.toHaveBeenCalled();
    const matching = screen.getByRole('link', { name: 'Matching Report' });
    fireEvent.mouseEnter(matching); fireEvent.focus(matching); fireEvent.touchStart(matching);
    expect(mocks.prefetch).toHaveBeenCalledTimes(3);
    expect(mocks.prefetch).toHaveBeenCalledWith('/ai-strategy/app/matching-report');
    fireEvent.mouseEnter(screen.getByRole('link', { name: 'Personal Report' }));
    fireEvent.mouseEnter(screen.getByRole('link', { name: 'Planner' }));
    expect(mocks.prefetch).toHaveBeenCalledTimes(3);
    expect(screen.queryByRole('link', { name: 'Strategy Report' })).not.toBeInTheDocument();
  });
});
