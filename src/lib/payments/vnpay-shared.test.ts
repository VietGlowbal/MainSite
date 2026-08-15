import { describe, expect, it } from 'vitest';
import { convertToVnd, VNPAY_FX_RATES } from './vnpay-shared';

describe('VNPay client-safe pricing primitives', () => {
  it('exports fixed Sandbox FX conversion without importing server crypto', () => {
    expect(VNPAY_FX_RATES.USD).toBe(25400);
    expect(convertToVnd(2500, 'USD')).toBe(635000);
  });
});
