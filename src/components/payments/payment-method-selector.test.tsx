import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PaymentMethodSelector } from './payment-method-selector';

describe('PaymentMethodSelector', () => {
  it('shows manual bank transfer as the only payment method', () => {
    render(<PaymentMethodSelector amountVnd={125000} value="manual_bank_transfer" onChange={() => undefined} />);
    expect(screen.getByDisplayValue('manual_bank_transfer')).toBeChecked();
    expect(screen.queryByDisplayValue('vnpay')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('stripe')).not.toBeInTheDocument();
    expect(screen.getByText('Bank transfer')).toBeInTheDocument();
  });

  it('supports unique ids and radio names for multiple payment dialogs', () => {
    render(
      <>
        <PaymentMethodSelector amountVnd={125000} value="manual_bank_transfer" onChange={() => undefined} id="plus-payment-starter" name="plus-method-starter" />
        <PaymentMethodSelector amountVnd={250000} value="manual_bank_transfer" onChange={() => undefined} id="plus-payment-pro" name="plus-method-pro" />
      </>,
    );
    const choices = screen.getAllByDisplayValue('manual_bank_transfer');
    expect(choices[0].id).toBe('plus-payment-starter-manual');
    expect(choices[1].id).toBe('plus-payment-pro-manual');
    expect(choices[0]).toHaveAttribute('name', 'plus-method-starter');
    expect(choices[1]).toHaveAttribute('name', 'plus-method-pro');
  });
});
