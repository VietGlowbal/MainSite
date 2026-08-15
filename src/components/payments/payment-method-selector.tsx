'use client';

import { Badge, Radio, RadioGroup } from '@/shared/ui';
import { formatMoney } from '@/lib/currency';
import { useLanguage } from '@/lib/i18n';

export function PaymentMethodSelector({
  amountVnd,
  id = 'payment-method',
  name = 'payment-method',
  value = 'vnpay',
  onChange,
}: {
  amountVnd?: number;
  id?: string;
  name?: string;
  value?: 'vnpay' | 'manual_bank_transfer';
  onChange?: (value: 'vnpay' | 'manual_bank_transfer') => void;
}) {
  const { t } = useLanguage();
  return (
    <RadioGroup
      id={id}
      legend={t('Payment method')}
      hint={t('VNPay is currently available in Sandbox. Manual bank transfer is confirmed by the founder. Stripe will be available soon.')}
      className="rounded-gb-lg border border-line bg-surface p-gb-xl"
    >
      <Radio
        id={`${id}-vnpay`}
        name={name}
        value="vnpay"
        checked={value === 'vnpay'}
        onChange={() => onChange?.('vnpay')}
        label={t('VNPay')}
        description={
          <span className="flex flex-wrap items-center gap-gb-sm">
            <Badge variant="brand-chip">{t('Sandbox')}</Badge>
            {amountVnd ? <span>{t('You will pay {amount}', { amount: formatMoney(amountVnd, 'VND') })}</span> : null}
          </span>
        }
      />
      <Radio
        id={`${id}-manual`}
        name={name}
        value="manual_bank_transfer"
        checked={value === 'manual_bank_transfer'}
        onChange={() => onChange?.('manual_bank_transfer')}
        label={t('Manual bank transfer')}
        description={t('Transfer the exact VND amount; founder confirmation is required.')}
      />
      <Radio
        id={`${id}-stripe`}
        name={name}
        value="stripe"
        disabled
        label={t('Stripe')}
        description={t('Coming soon')}
      />
    </RadioGroup>
  );
}
