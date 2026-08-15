import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(process.cwd(), 'supabase-manual-payment-founder.sql');

describe('manual founder-payment migration contract', () => {
  it('defines provider-neutral constraints, atomic checkout, fulfilment, review, and outbox leasing', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toContain("'manual_bank_transfer'");
    expect(sql).toMatch(/vnp_amount\s+is null|vnp_amount\)\s+is null/i);
    expect(sql).toContain('payment_transactions_user_provider_product_idempotency');
    expect(sql).toContain('create_manual_payment_checkout');
    expect(sql).toContain('manual_payment_reviews');
    expect(sql).toContain('payment_notification_jobs');
    expect(sql).toContain('fulfill_payment_transaction');
    expect(sql).toContain('review_manual_payment');
    expect(sql).toContain('lease_manual_payment_notification_jobs');
    expect(sql).toContain('FOR UPDATE SKIP LOCKED');
    expect(sql).toContain('booking_id = p_booking_id');
    expect(sql).toContain('paid_unfulfilled');
    expect(sql).toContain('credit_amount');
  });

  it('keeps mutation functions service-role only and makes student review reads owner-scoped', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toMatch(/revoke all on function public\.create_manual_payment_checkout[\s\S]+?from public, anon, authenticated/i);
    expect(sql).toContain('auth.uid() = pt.user_id');
    expect(sql).toContain('grant execute on function public.review_manual_payment');
  });

  it('exposes only non-sensitive review status columns to the owning student', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toMatch(
      /grant select\s*\(transaction_id, state, claimed_at, review_deadline_at\)\s*on public\.manual_payment_reviews to authenticated;/i,
    );
    expect(sql).not.toContain(
      'grant select on public.manual_payment_reviews to authenticated;',
    );
  });

  it('uses PostgreSQL make_interval parameter names for notification retries', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('make_interval(mins=>');
    expect(sql).not.toContain('make_interval(minutes=>');
  });
});
