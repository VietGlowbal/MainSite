import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlusPricing } from './plus-pricing';

const mocks = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));
vi.mock('@/shared/ui/loading-overlay', () => ({ useLoadingIndicator: vi.fn() }));

describe('PlusPricing payment dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('opens one plan-specific manual-payment selector and requires terms agreement', () => {
    render(<PlusPricing signedIn applicationId={null} />);
    const cta = screen.getByRole('button', { name: 'Try it' });
    fireEvent.click(cta);
    expect(screen.getByRole('dialog', { name: 'Choose payment method' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('manual_bank_transfer')).toHaveAttribute(
      'id',
      'plus-payment-plus-starter-manual',
    );
    expect(screen.queryByDisplayValue('vnpay')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('stripe')).not.toBeInTheDocument();

    const continueBtn = screen.getByRole('button', { name: 'Continue to payment' });
    expect(continueBtn).toBeDisabled();

    const termsCheckbox = screen.getByRole('checkbox', { name: /Terms and Conditions of Use/i });
    expect(termsCheckbox).not.toBeChecked();

    fireEvent.click(termsCheckbox);
    expect(termsCheckbox).toBeChecked();
    expect(continueBtn).not.toBeDisabled();
  });

  it('offers a promo-code redemption path inside the payment dialog', () => {
    render(<PlusPricing signedIn applicationId={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start your journey' }));

    expect(screen.getByRole('textbox', { name: 'Promo code' })).toHaveAttribute(
      'autocomplete',
      'off',
    );
    expect(screen.getByRole('button', { name: 'Apply code' })).toBeDisabled();

    fireEvent.change(screen.getByRole('textbox', { name: 'Promo code' }), {
      target: { value: 'glowbalglowbal' },
    });
    expect(screen.getByRole('button', { name: 'Apply code' })).not.toBeDisabled();
  });

  it('redeems the selected plan and refreshes Plus entitlement', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true, plan: 'plus-pro' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(<PlusPricing signedIn applicationId={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start your journey' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Promo code' }), {
      target: { value: 'glowbalglowbal' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply code' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/plus/redeem',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ code: 'glowbalglowbal', plan: 'plus-pro' }),
      }),
    ));
    expect(mocks.refresh).toHaveBeenCalled();
  });
});
