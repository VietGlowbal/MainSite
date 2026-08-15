import { describe, expect, it } from 'vitest';
import * as manualConfig from './manual-config';
import { getManualPaymentConfig } from './manual-config';
import { createManualReviewToken, verifyManualReviewToken } from './manual-capability';
import { renderManualFounderEmail, renderManualOutcomeEmail, renderManualStudentEmail } from './manual-email-templates';
import * as manualOutbox from './manual-outbox';
import { sendManualPaymentJob } from './manual-outbox';

describe('manual payment configuration', () => {
  it('always presents the sender as GlowBal', () => {
    const brandSender = (
      manualConfig as typeof manualConfig & {
        brandManualPaymentSender?: (value: string) => string;
      }
    ).brandManualPaymentSender;

    expect(brandSender).toBeTypeOf('function');
    expect(brandSender?.('onboarding@resend.dev')).toBe(
      'GlowBal <onboarding@resend.dev>',
    );
    expect(brandSender?.('Other name <payments@example.test>')).toBe(
      'GlowBal <payments@example.test>',
    );
  });

  it('requires server-only configuration and exposes only a masked account number', () => {
    const original = { ...process.env };
    process.env.MANUAL_PAYMENT_REVIEW_SECRET = 'a'.repeat(48);
    process.env.MANUAL_PAYMENT_REVIEWER_USER_IDS = '11111111-1111-4111-8111-111111111111';
    process.env.MANUAL_PAYMENT_FOUNDER_EMAIL = 'founder@example.test';
    process.env.MANUAL_PAYMENT_FROM_EMAIL = 'payments@example.test';
    process.env.MANUAL_PAYMENT_BANK_LABEL = 'ACME Bank';
    process.env.MANUAL_PAYMENT_BANK_ACCOUNT_HOLDER = 'Glowbal Education';
    process.env.MANUAL_PAYMENT_BANK_ACCOUNT_NUMBER = '012345678901';
    process.env.MANUAL_PAYMENT_BANK_QR_URL = 'https://cdn.example.test/qr.png';
    process.env.MANUAL_PAYMENT_BANK_QR_REVISION = 'qr-v1';
    process.env.MANUAL_PAYMENT_RECONCILIATION_SECRET = 'b'.repeat(48);

    expect(getManualPaymentConfig().accountNumberMasked).toBe('••••••••901');
    expect(getManualPaymentConfig().accountNumberMasked).not.toContain('012345678');
    process.env = original;
  });

  it('uses the production origin for email links when the configured site URL is local', () => {
    const original = { ...process.env };
    Object.assign(process.env, {
      MANUAL_PAYMENT_REVIEW_SECRET: 'a'.repeat(48),
      MANUAL_PAYMENT_REVIEWER_USER_IDS: '11111111-1111-4111-8111-111111111111',
      MANUAL_PAYMENT_FOUNDER_EMAIL: 'founder@example.test',
      MANUAL_PAYMENT_FROM_EMAIL: 'payments@example.test',
      MANUAL_PAYMENT_BANK_LABEL: 'ACME Bank',
      MANUAL_PAYMENT_BANK_ACCOUNT_HOLDER: 'Glowbal Education',
      MANUAL_PAYMENT_BANK_ACCOUNT_NUMBER: '012345678901',
      MANUAL_PAYMENT_BANK_QR_URL: 'https://cdn.example.test/qr.png',
      MANUAL_PAYMENT_BANK_QR_REVISION: 'qr-v1',
      MANUAL_PAYMENT_RECONCILIATION_SECRET: 'b'.repeat(48),
      MANUAL_PAYMENT_EMAIL_SITE_URL: 'http://localhost:3000',
      NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
    });
    try {
      expect(getManualPaymentConfig().siteUrl).toBe('https://glowbal-education.com');
    } finally {
      process.env = original;
    }
  });
});

describe('manual review capability', () => {
  it('signs and verifies the review id and token version without storing raw capability', () => {
    const secret = 'c'.repeat(48);
    const token = createManualReviewToken('review-123', 4, secret);
    expect(token).toMatch(/^review-123\.4\.[a-f0-9]{64}$/);
    expect(verifyManualReviewToken(token, secret)).toEqual({ reviewId: 'review-123', version: 4 });
    expect(verifyManualReviewToken(`${token}x`, secret)).toBeNull();
  });
});

describe('manual payment email templates', () => {
  it('renders bilingual instructions with an inline QR cid and escaped values', () => {
    const email = renderManualStudentEmail({
      locale: 'vi',
      recipientName: '<Student>',
      bankLabel: 'ACME & Bank',
      accountHolder: 'Glowbal <Education>',
      accountNumberMasked: '••••••••901',
      amountVnd: 125000,
      reference: 'GLOWMANUALABC123',
      productLabel: 'Mentorship',
      expiresAt: new Date('2026-08-16T12:00:00.000Z'),
      statusUrl: 'https://glowbal.example/payment/manual/status?reference=GLOWMANUALABC123',
      qrCid: 'manual-payment-qr',
    });

    expect(email.html).toContain('cid:manual-payment-qr');
    expect(email.html).toContain('&lt;Student&gt;');
    expect(email.html).toContain('Hướng dẫn chuyển khoản');
    expect(email.html).toContain('Bank transfer instructions');
    expect(email.html).not.toContain('GLOWMANUALABC123\"');
    expect(email.attachments).toEqual([{ filename: 'glowbal-bank-qr.png', contentId: 'manual-payment-qr' }]);
  });

  it('renders one claimed-payment founder email with useful student details', () => {
    const email = renderManualFounderEmail({
      reference: 'GLOWMANUALABC123',
      amountVnd: 455000,
      studentId: '11111111-1111-4111-8111-111111111111',
      studentName: '<Student>',
      studentEmail: 'student@example.test',
      studentPhone: '+84 912 345 678',
      productLabel: 'GlowBal Plus starter',
      summary: 'Plus plan purchase',
      checkoutCreatedAt: new Date('2026-08-15T14:00:00.000Z'),
      claimedAt: new Date('2026-08-15T14:30:00.000Z'),
      reviewDeadlineAt: new Date('2026-08-16T14:30:00.000Z'),
      reviewUrl: 'https://glowbal.example/payment/manual/review?token=secret',
    });

    expect(email.subject).toContain('đã báo chuyển khoản');
    expect(email.html).toContain('&lt;Student&gt;');
    expect(email.html).not.toContain('<Student>');
    expect(email.html).toContain('student@example.test');
    expect(email.html).toContain('+84 912 345 678');
    expect(email.html).toContain('11111111-1111-4111-8111-111111111111');
    expect(email.html).toContain('15 Aug 2026, 14:30');
    expect(email.html).toContain('Xác nhận hoặc từ chối thanh toán');
    expect(email.text).toContain('Thời điểm người dùng báo đã chuyển');
  });

  it('renders the payment confirmation email with Zalo community link and QR code', () => {
    const email = renderManualOutcomeEmail({
      confirmed: true,
      recipientName: '<Student Name>',
      reference: 'GLOWMANUAL123',
      productLabel: 'GlowBal Plus · Starter',
      statusUrl: 'https://glowbal-education.com/payment/manual/status?reference=GLOWMANUAL123',
    });

    expect(email.subject).toBe('GlowBal — Xác nhận thanh toán thành công (GLOWMANUAL123)');
    expect(email.html).toContain('Xin chào <strong>&lt;Student Name&gt;</strong>');
    expect(email.html).toContain('GlowBal xác nhận bạn đã thanh toán thành công gói <strong>GlowBal Plus · Starter</strong>.');
    expect(email.html).toContain('GlowBal Community');
    expect(email.html).toContain('https://zalo.me/g/ggrpc483k4joxoev6dat');
    expect(email.html).toContain('QR tham gia cộng đồng:');
    expect(email.html).toContain('api.qrserver.com');
    expect(email.html).toContain('GO GLOW – GO GLOBAL');
    expect(email.html).toContain('GLOWBAL EDUCATION');
    expect(email.html).toContain('glowbal.edu@gmail.com');
    expect(email.html).toContain('https://glowbal-education.com');
    expect(email.text).toContain('Tham gia GlowBal Community: https://zalo.me/g/ggrpc483k4joxoev6dat');
    expect(email.text).toContain('GO GLOW – GO GLOBAL');
  });

  it('renders the payment support email when unconfirmed', () => {
    const email = renderManualOutcomeEmail({
      confirmed: false,
      recipientName: 'Student Name',
      reference: 'GLOWMANUAL456',
      productLabel: 'GlowBal Plus',
      statusUrl: 'https://glowbal-education.com/payment/manual/status?reference=GLOWMANUAL456',
    });

    expect(email.subject).toBe('GlowBal — Thanh toán cần hỗ trợ (GLOWMANUAL456)');
    expect(email.html).toContain('Thanh toán cần hỗ trợ');
    expect(email.text).toContain('Thanh toán cần hỗ trợ');
  });
});

describe('manual payment notification jobs', () => {
  it('unwraps legacy PostgreSQL record wrappers from leased outbox payloads', () => {
    const unwrap = (
      manualOutbox as typeof manualOutbox & {
        unwrapManualOutboxRecord?: (
          value: Record<string, unknown> | null,
        ) => Record<string, unknown> | null;
      }
    ).unwrapManualOutboxRecord;

    expect(unwrap).toBeTypeOf('function');
    expect(unwrap?.({ '?column?': { reference: 'GLOWMANUAL123' } })).toEqual({
      reference: 'GLOWMANUAL123',
    });
  });

  it('never delivers the deprecated checkout-time founder email', async () => {
    const original = { ...process.env };
    Object.assign(process.env, {
      MANUAL_PAYMENT_REVIEW_SECRET: 'a'.repeat(48),
      MANUAL_PAYMENT_REVIEWER_USER_IDS: '11111111-1111-4111-8111-111111111111',
      MANUAL_PAYMENT_FOUNDER_EMAIL: 'founder@example.test',
      MANUAL_PAYMENT_FROM_EMAIL: 'payments@example.test',
      MANUAL_PAYMENT_BANK_LABEL: 'ACME Bank',
      MANUAL_PAYMENT_BANK_ACCOUNT_HOLDER: 'Glowbal Education',
      MANUAL_PAYMENT_BANK_ACCOUNT_NUMBER: '012345678901',
      MANUAL_PAYMENT_BANK_QR_URL: 'https://cdn.example.test/qr.png',
      MANUAL_PAYMENT_BANK_QR_REVISION: 'qr-v1',
      MANUAL_PAYMENT_RECONCILIATION_SECRET: 'b'.repeat(48),
    });
    try {
      await expect(sendManualPaymentJob({
        id: 'job-1', transaction_id: 'tx-1', kind: 'founder_review', review: null,
        transaction: { reference: 'GLOWMANUALABC123', amount_vnd: 125000, product_type: 'plus', plus_plan: 'plus-starter', expires_at: new Date().toISOString() },
      })).rejects.toThrow('no longer delivered');
    } finally {
      process.env = original;
    }
  });
});
