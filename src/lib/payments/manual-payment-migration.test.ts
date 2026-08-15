import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(process.cwd(), 'supabase-manual-payment-founder.sql');
const fulfillmentRepairPath = resolve(
  process.cwd(),
  'supabase-manual-payment-fulfillment-repair.sql',
);
const subscriptionConflictRepairPath = resolve(
  process.cwd(),
  'supabase-manual-payment-subscription-conflict-repair.sql',
);

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

describe('manual Plus fulfilment repair migration contract', () => {
  it('repairs the outbox kind constraint and keeps notification failure outside entitlement rollback', () => {
    expect(existsSync(fulfillmentRepairPath)).toBe(true);
    const sql = existsSync(fulfillmentRepairPath)
      ? readFileSync(fulfillmentRepairPath, 'utf8')
      : '';

    expect(sql).toContain('payment_notification_jobs_kind_check');
    expect(sql).toContain("'student_confirmed'");
    expect(sql).toMatch(
      /update public\.payment_transactions[\s\S]+?status\s*=\s*'fulfilled'[\s\S]+?begin[\s\S]+?insert into public\.payment_notification_jobs[\s\S]+?exception when others[\s\S]+?notification_status\s*=\s*'failed'/i,
    );
  });

  it('reconciles founder-confirmed manual Plus failures without a review deadline', () => {
    expect(existsSync(fulfillmentRepairPath)).toBe(true);
    const sql = existsSync(fulfillmentRepairPath)
      ? readFileSync(fulfillmentRepairPath, 'utf8')
      : '';

    expect(sql).toContain('reconcile_confirmed_manual_plus_payment');
    expect(sql).toMatch(/provider\s*<>\s*'manual_bank_transfer'/i);
    expect(sql).toMatch(/product_type\s*<>\s*'plus'/i);
    expect(sql).toMatch(/review\.state\s*<>\s*'confirmed'/i);
    const reconcile = sql.slice(
      sql.indexOf('create or replace function public.reconcile_confirmed_manual_plus_payment'),
    );
    expect(reconcile).not.toMatch(/reviewed_at\s*[<>]=?\s*review(?:\.|_)review_deadline_at/i);
    expect(sql).toContain('payment_transaction_id');
    expect(sql).toMatch(/revoke all on function public\.reconcile_confirmed_manual_plus_payment[\s\S]+?from public, anon, authenticated/i);
  });

  it('lets founder-confirmed Plus bypass the review deadline while retaining mentorship slot safety', () => {
    const sql = readFileSync(fulfillmentRepairPath, 'utf8');
    expect(sql).toContain('create or replace function public.review_manual_payment');
    expect(sql).toMatch(
      /review\.review_deadline_at\s*<=\s*now\(\)\s+and\s+tx\.product_type\s*=\s*'mentorship'/i,
    );
  });
});

describe('manual Plus subscription conflict repair migration contract', () => {
  it('replaces the partial transaction index and retries confirmed Plus reconciliation', () => {
    expect(existsSync(subscriptionConflictRepairPath)).toBe(true);
    const sql = existsSync(subscriptionConflictRepairPath)
      ? readFileSync(subscriptionConflictRepairPath, 'utf8')
      : '';

    expect(sql).toContain('drop index if exists public.plus_subscriptions_payment_transaction_id');
    expect(sql).toMatch(
      /create unique index plus_subscriptions_payment_transaction_id\s+on public\.plus_subscriptions\s*\(payment_transaction_id\)/i,
    );
    expect(sql).not.toMatch(/where\s+payment_transaction_id\s+is\s+not\s+null/i);
    expect(sql).toContain('reconcile_confirmed_manual_plus_payment');
    expect(sql).toMatch(/review\.state\s*=\s*'confirmed'/i);
  });
});
