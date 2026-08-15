'use client';

import { Radio, RadioGroup } from '@/shared/ui';
import { useLanguage } from '@/lib/i18n';

export function PaymentMethodSelector({
  id = 'payment-method',
  name = 'payment-method',
  value = 'manual_bank_transfer',
  onChange,
}: {
  amountVnd?: number;
  id?: string;
  name?: string;
  value?: 'manual_bank_transfer';
  onChange?: (value: 'manual_bank_transfer') => void;
}) {
  const { t } = useLanguage();
  return (
    <RadioGroup
      id={id}
      legend={t('Payment method')}
      className="rounded-gb-lg border border-line bg-surface p-gb-xl"
    >
      <Radio
        id={`${id}-manual`}
        name={name}
        value="manual_bank_transfer"
        checked={value === 'manual_bank_transfer'}
        onChange={() => onChange?.('manual_bank_transfer')}
        label={t('Bank transfer')}
      />
    </RadioGroup>
  );
}
