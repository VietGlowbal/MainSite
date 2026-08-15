-- GlowBal — manual Plus subscription ON CONFLICT repair
-- Run after supabase-manual-payment-fulfillment-repair.sql.
--
-- Production diagnostic 42P10 showed that ON CONFLICT
-- (payment_transaction_id) could not infer the existing partial unique index.
-- A full unique index still permits multiple NULL values in PostgreSQL, while
-- making the function's explicit conflict target valid.

drop index if exists public.plus_subscriptions_payment_transaction_id;
create unique index plus_subscriptions_payment_transaction_id
  on public.plus_subscriptions (payment_transaction_id);

-- Retry every manual Plus payment whose receipt a founder confirmed. The
-- reconciliation function locks each ledger row and skips any transaction that
-- already has a subscription, so rerunning this migration cannot double-grant.
do $$
declare candidate record;
begin
  for candidate in
    select tx.id, review.reviewed_by
      from public.payment_transactions tx
      join public.manual_payment_reviews review
        on review.transaction_id = tx.id
     where tx.provider = 'manual_bank_transfer'
       and tx.product_type = 'plus'
       and tx.status = 'paid_unfulfilled'
       and review.state = 'confirmed'
       and review.reviewed_at is not null
  loop
    perform public.reconcile_confirmed_manual_plus_payment(
      candidate.id,
      candidate.reviewed_by
    );
  end loop;
end $$;
