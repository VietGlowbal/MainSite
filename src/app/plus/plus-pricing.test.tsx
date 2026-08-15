import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlusPricing } from './plus-pricing';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/shared/ui/loading-overlay', () => ({ useLoadingIndicator: vi.fn() }));

describe('PlusPricing payment dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens one plan-specific payment selector with an accessible unique id and requires terms agreement', () => {
    render(<PlusPricing signedIn applicationId={null} />);
    const cta = screen.getByRole('button', { name: 'Try it' });
    fireEvent.click(cta);
    expect(screen.getByRole('dialog', { name: 'Choose payment method' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('vnpay')).toHaveAttribute('id', 'plus-payment-plus-starter-vnpay');
    expect(screen.getByDisplayValue('stripe')).toBeDisabled();

    const continueBtn = screen.getByRole('button', { name: 'Continue to payment' });
    expect(continueBtn).toBeDisabled();

    const termsCheckbox = screen.getByRole('checkbox', { name: /Terms and Conditions of Use/i });
    expect(termsCheckbox).not.toBeChecked();

    fireEvent.click(termsCheckbox);
    expect(termsCheckbox).toBeChecked();
    expect(continueBtn).not.toBeDisabled();
  });
});
