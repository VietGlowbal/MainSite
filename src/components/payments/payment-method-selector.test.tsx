import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PaymentMethodSelector } from './payment-method-selector';

describe('PaymentMethodSelector', () => {
  it('shows controlled VNPay and manual transfer choices while Stripe stays disabled', () => {
    render(<PaymentMethodSelector amountVnd={125000} value="manual_bank_transfer" onChange={() => undefined} />);
    expect(screen.getByDisplayValue('vnpay')).not.toBeChecked();
    expect(screen.getByDisplayValue('manual_bank_transfer')).toBeChecked();
    expect(screen.getByDisplayValue('stripe')).toBeDisabled();
    expect(screen.getByText('Sandbox')).toBeInTheDocument();
    expect(screen.getByText(/125[.,]000/)).toBeInTheDocument();
  });

  it('supports unique ids and radio names for multiple payment dialogs', () => {
    render(
      <>
        <PaymentMethodSelector amountVnd={125000} value="vnpay" onChange={() => undefined} id="plus-payment-starter" name="plus-method-starter" />
        <PaymentMethodSelector amountVnd={250000} value="manual_bank_transfer" onChange={() => undefined} id="plus-payment-pro" name="plus-method-pro" />
      </>,
    );
    expect(screen.getAllByDisplayValue('vnpay')[0].id).toBe('plus-payment-starter-vnpay');
    expect(screen.getAllByDisplayValue('vnpay')[1].id).toBe('plus-payment-pro-vnpay');
    expect(screen.getAllByDisplayValue('vnpay')[0]).toHaveAttribute('name', 'plus-method-starter');
    expect(screen.getAllByDisplayValue('vnpay')[1]).toHaveAttribute('name', 'plus-method-pro');
  });
});
