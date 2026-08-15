import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(new URL('../../../supabase-vnpay-payments.sql', import.meta.url), 'utf8');
const checkoutRoute = readFileSync(
  new URL('../../app/api/payments/vnpay/checkout/route.ts', import.meta.url),
  'utf8',
);

describe('VNPay migration invariants', () => {
  it('binds the held slot before creating the ledger and requires exact ownership on IPN', () => {
    expect(checkoutRoute).toContain(".update({ booking_id: booking.id })");
    expect(checkoutRoute.indexOf(".update({ booking_id: booking.id })")).toBeLessThan(
      checkoutRoute.indexOf(".from('payment_transactions')\n    .insert({"),
    );
    expect(migration).toContain('slot.booking_id is distinct from booking.id');
  });

  it('expires transactions, cancels pending bookings, and releases only owned slots', () => {
    expect(migration).toContain('expire_vnpay_transaction');
    expect(migration).toContain("status = 'cancelled'");
    expect(migration).toMatch(/booking_id\s*=\s*p_booking_id/);
    expect(migration).toMatch(/booking_id\s*=\s*booking\.id/);
  });

  it('seeds new Plus profiles at zero and adds credits exactly once', () => {
    expect(migration).toMatch(/insert into public\.student_profiles[\s\S]*?values\s*\(tx\.user_id,[\s\S]*?,\s*0\)\s*on conflict/);
    expect(migration).toContain('ai_strategy_credits = coalesce(profile.ai_strategy_credits, 0) + tx.plus_ai_credits');
  });

  it('persists a meeting link in the same mentorship fulfilment update', () => {
    expect(migration).toMatch(/meeting_link\s*=\s*coalesce\(\s*booking\.meeting_link/s);
  });

  it('does not expose security-definer payment functions to browser roles', () => {
    for (const signature of [
      'process_vnpay_ipn(text, bigint, text, text, text, text, text, jsonb)',
      'expire_vnpay_transaction(uuid)',
      'reclaim_vnpay_expired_holds()',
      'cancel_vnpay_booking(bigint, text)',
    ]) {
      expect(migration).toContain(
        `revoke all on function public.${signature} from public, anon, authenticated;`,
      );
    }
    expect(migration).toContain(
      'grant execute on function public.process_vnpay_ipn(text, bigint, text, text, text, text, text, jsonb) to service_role;',
    );
  });

  it('records a successful late callback as paid but unfulfilled', () => {
    expect(migration).toContain("if tx.status in ('fulfilled', 'paid_unfulfilled') then");
    expect(migration).toMatch(
      /if tx\.status in \('failed', 'expired'\)[\s\S]*?status = 'paid_unfulfilled'/,
    );
  });
});
