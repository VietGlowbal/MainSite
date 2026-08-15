import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlusPricing } from './plus-pricing';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/shared/ui/loading-overlay', () => ({ useLoadingIndicator: vi.fn() }));

describe('PlusPricing payment dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens one plan-specific payment selector with an accessible unique id', () => {
    render(<PlusPricing signedIn applicationId={null} />);
    const ctas = screen.getAllByRole('button', { name: 'Continue with VNPay' });
    fireEvent.click(ctas[0]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByDisplayValue('vnpay')).toHaveAttribute('id', 'plus-payment-plus-starter-vnpay');
    expect(screen.getByDisplayValue('stripe')).toBeDisabled();
  });
});
