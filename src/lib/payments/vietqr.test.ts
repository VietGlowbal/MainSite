import { describe, expect, it } from 'vitest';
import { generateVietQrUrl, normalizeBankId } from './vietqr';

describe('VietQR Dynamic QR Generator', () => {
  it('normalizes common Vietnamese bank names to standard VietQR bank codes', () => {
    expect(normalizeBankId('Techcombank')).toBe('TCB');
    expect(normalizeBankId('Vietcombank')).toBe('VCB');
    expect(normalizeBankId('MB Bank')).toBe('MB');
    expect(normalizeBankId('BIDV')).toBe('BIDV');
    expect(normalizeBankId(undefined)).toBe('TCB');
  });

  it('generates a valid dynamic VietQR URL with amount, description, and account details', () => {
    const url = generateVietQrUrl({
      bankId: 'Techcombank',
      accountNumber: '19036753705010',
      accountHolder: 'NGUYEN KHANH LINH',
      amountVnd: 2490000,
      description: 'Duc Hien 0912345678 2490000',
    });

    expect(url).toContain('https://img.vietqr.io/image/TCB-19036753705010-compact2.png');
    expect(url).toContain('amount=2490000');
    expect(url).toContain('accountName=NGUYEN+KHANH+LINH');
    expect(url).toContain('addInfo=');
  });

  it('handles optional parameters gracefully', () => {
    const url = generateVietQrUrl({
      accountNumber: '123456789',
    });

    expect(url).toBe('https://img.vietqr.io/image/TCB-123456789-compact2.png');
  });
});
