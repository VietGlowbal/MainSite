import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const migration = readFileSync('supabase-manual-payment-founder.sql', 'utf8');

describe('manual payment regression contracts', () => {
  it('leases transaction and review payloads into jsonb variables without record wrappers', () => {
    expect(migration).toMatch(
      /declare\s+job\s+record;\s*tx\s+jsonb;\s*review\s+jsonb;\s*out\s+jsonb;/i,
    );
  });

  it('emails the founder only after the user reports a transfer', () => {
    const checkoutStart = migration.indexOf('create or replace function public.create_manual_payment_checkout');
    const claimStart = migration.indexOf('create or replace function public.claim_manual_payment');
    const fulfilmentStart = migration.indexOf('create or replace function public.fulfill_payment_transaction');
    const checkout = migration.slice(checkoutStart, claimStart);
    const claim = migration.slice(claimStart, fulfilmentStart);

    expect(checkout).toContain("values (tx.id, 'student_instructions')");
    expect(checkout).not.toContain("'founder_review'");
    expect(claim.match(/'founder_claimed'/g)).toHaveLength(1);
  });

  it('retires unsent checkout-time founder jobs during migration', () => {
    expect(migration).toMatch(
      /update\s+public\.payment_notification_jobs[\s\S]*?kind\s*=\s*'founder_review'[\s\S]*?state\s+in\s*\('pending','processing'\)/i,
    );
  });

  it('leases claimed founder emails before failing student instructions', () => {
    expect(migration).toMatch(
      /order\s+by\s+case\s+when\s+j\.kind\s*=\s*'founder_claimed'\s+then\s+0\s+else\s+1\s+end\s*,\s*j\.created_at/i,
    );
  });

  it('derives claimed status from the own-user review row and disables claiming after reload', () => {
    const route = readFileSync('src/app/api/payments/manual/status/route.ts', 'utf8');
    expect(route).toContain("from('manual_payment_reviews')");
    expect(route).toContain("eq('transaction_id'");
    expect(route).not.toContain('createAdminClient');
    expect(route).toContain("reviewState === 'claimed'");
    expect(route).toContain('canClaim');
  });

  it('never treats a user claim as proof of payment', () => {
    const start = migration.indexOf('create or replace function public.claim_manual_payment');
    const end = migration.indexOf('create or replace function public.fulfill_payment_transaction');
    expect(start).toBeGreaterThanOrEqual(0);
    const claim = migration.slice(start, end);
    expect(claim).not.toMatch(/slot_not_owned[\s\S]{0,500}paid_at/);
    expect(claim).toContain("status = 'expired'");
    expect(claim).toContain('hold_expires_at');
  });

  it('rechecks the request fingerprint in the unique-violation race path', () => {
    const start = migration.indexOf('exception when unique_violation');
    const end = migration.indexOf('create or replace function public.claim_manual_payment');
    const race = migration.slice(start, end);
    expect(race).toContain('request_fingerprint');
    expect(race).toContain('idempotency key reused with different details');
  });

  it('carries original mentorship price, fee, payout, currency, and converted ledger amount', () => {
    expect(migration).toContain('p_mentor_amount');
    expect(migration).toContain('p_service_fee');
    expect(migration).toContain('p_source_amount');
    expect(migration).toContain('p_source_currency');
    expect(migration).toContain('amount_mentor');
    expect(migration).toContain('amount_service_fee');
    expect(migration).toContain('achiever_payout_vnd');
  });
});
