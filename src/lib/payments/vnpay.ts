import { createHmac, timingSafeEqual } from 'node:crypto';

export { convertToVnd, VNPAY_FX_RATES } from './vnpay-shared';

export const VNPAY_VERSION = '2.1.0';
export const VNPAY_PAYMENT_URL = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
export const VNPAY_TTL_MINUTES = 15;

export type VnpayConfig = {
  tmnCode: string;
  hashSecret: string;
  paymentUrl: string;
  returnUrl?: string;
  ipnUrl?: string;
};

export type VnpayParams = Record<string, string | number | undefined | null>;

function cleanParams(params: VnpayParams): Record<string, string> {
  return Object.fromEntries(
    Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => [key, String(value)]),
  );
}

function encodeVnpayComponent(value: string): string {
  return encodeURIComponent(value).replaceAll('%20', '+');
}

export function serializeVnpayParams(params: VnpayParams): string {
  const clean = cleanParams(params);
  return Object.entries(clean)
    .map(([key, value]) => ({ key: encodeVnpayComponent(key), value: encodeVnpayComponent(value) }))
    .sort((left, right) => (left.key < right.key ? -1 : left.key > right.key ? 1 : 0))
    .map(({ key, value }) => `${key}=${value}`)
    .join('&');
}

export function signVnpayParams(params: VnpayParams, secret: string): string {
  return createHmac('sha512', secret).update(serializeVnpayParams(params), 'utf8').digest('hex');
}

function equalHex(left: string, right: string): boolean {
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function formatVnpayDate(date: Date): string {
  const gmt7 = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    gmt7.getUTCFullYear(),
    pad(gmt7.getUTCMonth() + 1),
    pad(gmt7.getUTCDate()),
    pad(gmt7.getUTCHours()),
    pad(gmt7.getUTCMinutes()),
    pad(gmt7.getUTCSeconds()),
  ].join('');
}

export function toVnpayAmount(amountVnd: number): string {
  if (!Number.isSafeInteger(amountVnd) || amountVnd <= 0) {
    throw new Error('VNPay amount must be a positive integer in VND');
  }
  return String(amountVnd * 100);
}

export function buildVnpayPaymentUrl(input: {
  amountVnd: number;
  txnRef: string;
  orderInfo: string;
  returnUrl: string;
  clientIp: string;
  createdAt?: Date;
  expiresAt?: Date;
  locale?: 'vn' | 'en';
  config: VnpayConfig;
}): string {
  const createdAt = input.createdAt ?? new Date();
  const expiresAt = input.expiresAt ?? new Date(createdAt.getTime() + VNPAY_TTL_MINUTES * 60_000);
  const params = cleanParams({
    vnp_Version: VNPAY_VERSION,
    vnp_Command: 'pay',
    vnp_TmnCode: input.config.tmnCode,
    vnp_Amount: toVnpayAmount(input.amountVnd),
    vnp_CreateDate: formatVnpayDate(createdAt),
    vnp_CurrCode: 'VND',
    vnp_IpAddr: input.clientIp,
    vnp_Locale: input.locale ?? 'en',
    vnp_OrderInfo: input.orderInfo,
    vnp_OrderType: 'other',
    vnp_ReturnUrl: input.returnUrl,
    vnp_TxnRef: input.txnRef,
    vnp_ExpireDate: formatVnpayDate(expiresAt),
  });
  if (!/^[A-Za-z0-9]{1,100}$/.test(input.txnRef)) {
    throw new Error('VNPay transaction reference must be alphanumeric');
  }
  const query = serializeVnpayParams(params);
  const hash = signVnpayParams(params, input.config.hashSecret);
  return `${input.config.paymentUrl}?${query}&vnp_SecureHash=${hash}`;
}

export function verifyVnpayResponse(
  params: VnpayParams,
  secret: string,
  expectedTmnCode: string,
): { valid: boolean; paid: boolean; reason?: 'signature' | 'terminal' } {
  const clean = cleanParams(params);
  const received = clean.vnp_SecureHash?.toLowerCase();
  const signedParams = { ...clean };
  delete signedParams.vnp_SecureHash;
  delete signedParams.vnp_SecureHashType;
  if (!received || !equalHex(signVnpayParams(signedParams, secret), received)) {
    return { valid: false, paid: false, reason: 'signature' };
  }
  if (clean.vnp_TmnCode !== expectedTmnCode) {
    return { valid: false, paid: false, reason: 'terminal' };
  }
  return {
    valid: true,
    paid: clean.vnp_ResponseCode === '00' && clean.vnp_TransactionStatus === '00',
  };
}

export function getVnpayConfig(baseUrl?: string): VnpayConfig {
  if (process.env.VNPAY_ENABLED === 'false') throw new Error('VNPay is disabled');
  const tmnCode = process.env.VNPAY_TMN_CODE?.trim();
  const hashSecret = process.env.VNPAY_HASH_SECRET?.trim();
  const paymentUrl = process.env.VNPAY_PAYMENT_URL?.trim() || VNPAY_PAYMENT_URL;
  if (!tmnCode || !hashSecret) throw new Error('VNPay is not configured');
  const parsedUrl = new URL(paymentUrl);
  if (
    parsedUrl.protocol !== 'https:' ||
    parsedUrl.hostname !== 'sandbox.vnpayment.vn' ||
    parsedUrl.pathname !== '/paymentv2/vpcpay.html'
  ) {
    throw new Error('VNPay is hard-locked to the Sandbox payment host');
  }
  return {
    tmnCode,
    hashSecret,
    paymentUrl,
    returnUrl: process.env.VNPAY_RETURN_URL?.trim() || (baseUrl ? `${baseUrl}/payment/vnpay/return` : undefined),
    ipnUrl: process.env.VNPAY_IPN_URL?.trim() || (baseUrl ? `${baseUrl}/api/payments/vnpay/ipn` : undefined),
  };
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const value = forwarded || request.headers.get('x-real-ip')?.trim() || '127.0.0.1';
  return /^[0-9a-f:.]{1,45}$/i.test(value) ? value : '127.0.0.1';
}
