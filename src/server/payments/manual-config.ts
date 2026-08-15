import { PRODUCTION_SITE_URL } from '@/lib/site-url';

export type ManualPaymentConfig = {
  reviewerUserIds: string[];
  founderEmail: string;
  fromEmail: string;
  reviewSecret: string;
  reconciliationSecret: string;
  bankLabel: string;
  accountHolder: string;
  accountNumber?: string;
  accountNumberMasked: string;
  bankQrUrl: string;
  bankQrRevision: string;
  siteUrl: string;
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name} server configuration`);
  return value;
}

function secret(name: string): string {
  const value = required(name);
  if (value.length < 32) throw new Error(`${name} must be at least 32 characters`);
  return value;
}

function httpsUrl(name: string): string {
  const value = required(name);
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute HTTPS URL`);
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    throw new Error(`${name} must be an absolute HTTPS URL`);
  }
  return parsed.toString();
}

function reviewerIds(): string[] {
  const ids = required('MANUAL_PAYMENT_REVIEWER_USER_IDS')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (!ids.every((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))) {
    throw new Error('MANUAL_PAYMENT_REVIEWER_USER_IDS must contain UUIDs');
  }
  return [...new Set(ids)];
}

function publicEmailSiteUrl(): string {
  const value = process.env.MANUAL_PAYMENT_EMAIL_SITE_URL?.trim();
  if (!value) return PRODUCTION_SITE_URL;
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase();
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password
      || hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return PRODUCTION_SITE_URL;
    }
    return parsed.origin;
  } catch {
    return PRODUCTION_SITE_URL;
  }
}

export function brandManualPaymentSender(value: string): string {
  const address = value.match(/<([^<>]+)>\s*$/)?.[1]?.trim() || value.trim();
  return `GlowBal <${address}>`;
}

export function getManualPaymentConfig(): ManualPaymentConfig {
  const accountNumber = required('MANUAL_PAYMENT_BANK_ACCOUNT_NUMBER');
  if (!/^\d{6,34}$/.test(accountNumber)) {
    throw new Error('MANUAL_PAYMENT_BANK_ACCOUNT_NUMBER must contain digits only');
  }
  return {
    reviewerUserIds: reviewerIds(),
    founderEmail: required('MANUAL_PAYMENT_FOUNDER_EMAIL'),
    fromEmail: brandManualPaymentSender(required('MANUAL_PAYMENT_FROM_EMAIL')),
    reviewSecret: secret('MANUAL_PAYMENT_REVIEW_SECRET'),
    reconciliationSecret: secret('MANUAL_PAYMENT_RECONCILIATION_SECRET'),
    bankLabel: required('MANUAL_PAYMENT_BANK_LABEL'),
    accountHolder: required('MANUAL_PAYMENT_BANK_ACCOUNT_HOLDER'),
    accountNumber,
    accountNumberMasked: `••••••••${accountNumber.slice(-3)}`,
    bankQrUrl: httpsUrl('MANUAL_PAYMENT_BANK_QR_URL'),
    bankQrRevision: required('MANUAL_PAYMENT_BANK_QR_REVISION'),
    siteUrl: publicEmailSiteUrl(),
  };
}

export function isManualReviewer(userId: string, config = getManualPaymentConfig()): boolean {
  return config.reviewerUserIds.includes(userId);
}
