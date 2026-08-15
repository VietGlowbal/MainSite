import { describe, expect, it } from 'vitest';
import {
  buildVnpayPaymentUrl,
  convertToVnd,
  formatVnpayDate,
  serializeVnpayParams,
  signVnpayParams,
  verifyVnpayResponse,
} from './vnpay';

describe('VNPay payment primitives', () => {
  it('sorts the official Node-demo query string before HMAC-SHA512 signing', () => {
    const params = { vnp_TxnRef: 'GLOW1', vnp_OrderInfo: 'Thanh toan test' };
    expect(signVnpayParams(params, 'secret')).toBe(
      'e8a8f95d049c3f36a59d72721a97df622aa4df537e5604af6d6749173c699bd05e6e7be44ad5637bbd6302f28ad6ab7951e33740f6075e298df8a6db9a7479bc',
    );
  });

  it('matches the official encoded sortObject golden vector for spaces and ReturnUrl', () => {
    const params = {
      vnp_OrderInfo: 'Thanh toan test',
      vnp_ReturnUrl: 'https://example.com/payment/vnpay/return?reason=hello world',
    };
    expect(serializeVnpayParams(params)).toBe(
      'vnp_OrderInfo=Thanh+toan+test&vnp_ReturnUrl=https%3A%2F%2Fexample.com%2Fpayment%2Fvnpay%2Freturn%3Freason%3Dhello+world',
    );
    expect(signVnpayParams(params, 'secret')).toBe(
      'db3997fa2f723bc717b600a767100d8bf801952d1bec20ce9f35ac24e81e86d184dae52b4643b54c64407c106d90bc576be95ae382a6087c4345643376303066',
    );
  });

  it('builds VND amount in VNPay minor-unit format and omits the secret', () => {
    const url = buildVnpayPaymentUrl({
      amountVnd: 125000,
      txnRef: 'GLOW1',
      orderInfo: 'Thanh toan GlowBal',
      returnUrl: 'https://example.com/payment/vnpay/return',
      clientIp: '127.0.0.1',
      createdAt: new Date('2026-08-15T00:00:00.000Z'),
      expiresAt: new Date('2026-08-15T00:15:00.000Z'),
      config: {
        tmnCode: 'LJ655PKA',
        hashSecret: 'secret',
        paymentUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
      },
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get('vnp_Amount')).toBe('12500000');
    expect(parsed.searchParams.get('vnp_SecureHash')).toMatch(/^[a-f0-9]{128}$/);
    expect(url).not.toContain('secret');
  });

  it('round-trips the encoded signed query through URLSearchParams verification', () => {
    const url = buildVnpayPaymentUrl({
      amountVnd: 125000,
      txnRef: 'GLOW1',
      orderInfo: 'Thanh toan test',
      returnUrl: 'https://example.com/payment/vnpay/return?reason=hello world',
      clientIp: '127.0.0.1',
      config: {
        tmnCode: 'LJ655PKA',
        hashSecret: 'secret',
        paymentUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
      },
    });
    const parsed = new URL(url);
    expect(url).toContain('hello+world');
    expect(
      verifyVnpayResponse(Object.fromEntries(parsed.searchParams.entries()), 'secret', 'LJ655PKA'),
    ).toEqual({ valid: true, paid: false });
  });

  it('rejects VNPay references containing separators', () => {
    expect(() =>
      buildVnpayPaymentUrl({
        amountVnd: 125000,
        txnRef: 'GLOW-1',
        orderInfo: 'Thanh toan GlowBal',
        returnUrl: 'https://example.com/payment/vnpay/return',
        clientIp: '127.0.0.1',
        config: {
          tmnCode: 'LJ655PKA',
          hashSecret: 'secret',
          paymentUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
        },
      }),
    ).toThrow(/alphanumeric/i);
  });

  it('formats timestamps in GMT+7', () => {
    expect(formatVnpayDate(new Date('2026-08-15T00:00:00.000Z'))).toBe('20260815070000');
  });

  it('freezes the Sandbox FX conversion from smallest source units', () => {
    expect(convertToVnd(2500, 'USD')).toBe(635000);
    expect(convertToVnd(500000, 'VND')).toBe(500000);
  });

  it('requires both response and transaction status to be successful', () => {
    const params = {
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
      vnp_TmnCode: 'LJ655PKA',
    };
    const withHash = {
      ...params,
      vnp_SecureHash: signVnpayParams(params, 'secret'),
    };
    expect(verifyVnpayResponse(withHash, 'secret', 'LJ655PKA')).toEqual({
      valid: true,
      paid: true,
    });
    expect(
      verifyVnpayResponse(
        { ...withHash, vnp_TransactionStatus: '01' },
        'secret',
        'LJ655PKA',
      ),
    ).toEqual({ valid: false, paid: false, reason: 'signature' });
  });
});
