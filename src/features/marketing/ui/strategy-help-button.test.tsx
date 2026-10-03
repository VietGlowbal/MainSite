import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '@/lib/i18n';
import { StrategyHelpButton } from './strategy-help-button';
const navigation = vi.hoisted(() => ({ pathname: '/ai-strategy/reflection/achievements' }));
vi.mock('next/navigation', () => ({ usePathname: () => navigation.pathname }));
vi.mock('./strategy-guide', () => ({
  GuidePanel: ({ flat, activeIndex }: { flat: { step: { number: string } }[]; activeIndex: number }) => <p>Guide step {flat[activeIndex]!.step.number}</p>,
}));
describe('lazy strategy help', () => {
  it('opens the current step on demand, closes, and reopens at the new route', async () => {
    const view = render(<LanguageProvider><StrategyHelpButton /></LanguageProvider>);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'How GlowBal works' }));
    expect(await screen.findByText('Guide step 3.3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Close$/ }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    navigation.pathname = '/universities/123';
    view.rerender(<LanguageProvider><StrategyHelpButton /></LanguageProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'How GlowBal works' }));
    expect(await screen.findByText('Guide step 1.2')).toBeInTheDocument();
  });
  it('keeps the help button suppressed on admin routes', () => {
    navigation.pathname = '/admin/reports';
    render(<LanguageProvider><StrategyHelpButton /></LanguageProvider>);
    expect(screen.queryByRole('button', { name: 'How GlowBal works' })).not.toBeInTheDocument();
  });
});
