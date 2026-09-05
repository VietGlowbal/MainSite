-- GlowBal — manual Plus fulfilment repair
-- Run after supabase-manual-payment-founder.sql.
--
-- This is a follow-up migration: the original migration may already be live.
-- It repairs schema drift in the outbox kind constraint, prevents an email-job
-- failure from rolling back an otherwise valid purchase, and reconciles manual
-- Plus payments whenever a founder has explicitly confirmed receipt.

alter table public.payment_transactions
  add column if not exists fulfillment_error_code text,
  add column if not exists fulfillment_error_detail text;

do $$
declare constraint_row record;
begin
  -- CREATE TABLE IF NOT EXISTS cannot update a CHECK on a table that already
  -- existed. Enumerate the real constraint name instead of guessing it.
  for constraint_row in
    select conname
      from pg_constraint
     where conrelid = 'public.payment_notification_jobs'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%kind%'
  loop
    execute format(
      'alter table public.payment_notification_jobs drop constraint %I',
      constraint_row.conname
    );
  end loop;

  alter table public.payment_notification_jobs
    add constraint payment_notification_jobs_kind_check
    check (kind in (
      'student_instructions', 'founder_review', 'founder_claimed',
      'student_confirmed', 'student_rejected', 'student_needs_support'
    ));
end $$;

create or replace function public.fulfill_payment_transaction(
  p_transaction_id uuid,
  p_actor uuid default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  tx public.payment_transactions%rowtype;
  booking public.bookings%rowtype;
  slot public.mentor_availability_slots%rowtype;
  profile public.student_profiles%rowtype;
  expires timestamptz;
  error_code text;
  error_detail text;
begin
  select * into tx
    from public.payment_transactions
   where id = p_transaction_id
   for update;
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  if tx.status = 'fulfilled' then return jsonb_build_object('status', 'already_fulfilled'); end if;
  if tx.status in ('failed', 'expired', 'paid_unfulfilled') then
    return jsonb_build_object('status', tx.status);
  end if;

  if tx.product_type = 'mentorship' then
    if tx.booking_id is null then
      update public.payment_transactions
         set status = 'paid_unfulfilled', paid_at = coalesce(paid_at, now())
       where id = tx.id;
      return jsonb_build_object('status', 'paid_unfulfilled');
    end if;
    select * into booking from public.bookings where id = tx.booking_id for update;
    select * into slot from public.mentor_availability_slots where id = booking.slot_id for update;
    if not found
       or booking.status <> 'pending_payment'
       or slot.status <> 'held'
       or slot.booking_id is distinct from booking.id
       or slot.hold_expires_at is null
       or slot.hold_expires_at < now() then
      update public.payment_transactions
         set status = 'paid_unfulfilled', paid_at = coalesce(paid_at, now())
       where id = tx.id;
      return jsonb_build_object('status', 'paid_unfulfilled');
    end if;
    update public.bookings
       set status = 'confirmed',
           payment_confirmed_at = now(),
           meeting_link = coalesce(
             meeting_link,
             'https://meet.jit.si/glowbal-' || booking.id::text || '-' ||
               replace(gen_random_uuid()::text, '-', '')
           )
     where id = booking.id and status = 'pending_payment';
    update public.mentor_availability_slots
       set status = 'booked', hold_expires_at = null
     where id = booking.slot_id
       and status = 'held'
       and booking_id = booking.id;
  else
    select * into profile
      from public.student_profiles
     where user_id = tx.user_id
     for update;
    if not found then
      insert into public.student_profiles (
        user_id, plus_status, plus_plan, plus_started_at,
        plus_expires_at, ai_strategy_credits
      ) values (
        tx.user_id, true, tx.plus_plan, now(),
        now() + make_interval(months => tx.plus_duration_months), 0
      ) on conflict (user_id) do nothing;
      select * into profile
        from public.student_profiles
       where user_id = tx.user_id
       for update;
    end if;
    expires := greatest(coalesce(profile.plus_expires_at, now()), now())
      + make_interval(months => tx.plus_duration_months);
    update public.student_profiles
       set plus_status = true,
           plus_plan = tx.plus_plan,
           plus_started_at = coalesce(profile.plus_started_at, now()),
           plus_expires_at = expires,
           ai_strategy_credits = coalesce(profile.ai_strategy_credits, 0)
             + coalesce(tx.plus_ai_credits, 0)
     where user_id = tx.user_id;
    insert into public.plus_subscriptions (
      user_id, plan, price_label, ai_credits, duration_months,
      payment_transaction_id, vnpay_reference, status, started_at, expires_at
    ) values (
      tx.user_id, tx.plus_plan, tx.amount_vnd::text || ' VND',
      tx.plus_ai_credits, tx.plus_duration_months, tx.id, tx.reference,
      'active', now(), expires
    ) on conflict (payment_transaction_id) do nothing;
  end if;

  update public.payment_transactions
     set status = 'fulfilled',
         paid_at = coalesce(paid_at, now()),
         fulfilled_at = now(),
         notification_status = 'pending',
         fulfillment_error_code = null,
         fulfillment_error_detail = null
   where id = tx.id;

  -- Notification is durable but not part of product fulfilment. If an outbox
  -- constraint or insert fails, retain the entitlement and expose the email
  -- failure for the reconciliation worker instead of rolling the purchase back.
  begin
    insert into public.payment_notification_jobs (transaction_id, kind)
    values (tx.id, 'student_confirmed')
    on conflict do nothing;
  exception when others then
    error_code := SQLSTATE;
    error_detail := SQLERRM;
    update public.payment_transactions
       set notification_status = 'failed',
           fulfillment_error_code = error_code,
           fulfillment_error_detail = left(error_detail, 500)
     where id = tx.id;
  end;

  return jsonb_build_object('status', 'fulfilled');
exception when others then
  error_code := SQLSTATE;
  error_detail := SQLERRM;
  update public.payment_transactions
     set status = 'paid_unfulfilled',
         paid_at = coalesce(paid_at, now()),
         notification_status = 'failed',
         fulfillment_error_code = error_code,
         fulfillment_error_detail = left(error_detail, 500)
   where id = p_transaction_id;
  return jsonb_build_object(
    'status', 'paid_unfulfilled',
    'error_code', error_code
  );
end;
$$;

create or replace function public.review_manual_payment(
  p_review_id uuid,
  p_token_version integer,
  p_action text,
  p_reviewer_id uuid,
  p_note text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  review public.manual_payment_reviews%rowtype;
  tx public.payment_transactions%rowtype;
  result jsonb;
begin
  select * into review
    from public.manual_payment_reviews
   where id = p_review_id
   for update;
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  select * into tx
    from public.payment_transactions
   where id = review.transaction_id
   for update;
  if review.token_version <> p_token_version then
    return jsonb_build_object('status', 'invalid_token');
  end if;
  if review.state in ('confirmed', 'rejected', 'expired')
     or tx.status in ('fulfilled', 'paid_unfulfilled', 'failed', 'expired') then
    return jsonb_build_object(
      'status', coalesce(tx.status, review.state),
      'already_terminal', true
    );
  end if;
  if p_action = 'reject' then
    update public.manual_payment_reviews
       set state = 'rejected', reviewed_at = now(),
           reviewed_by = p_reviewer_id,
           reviewer_note = nullif(left(p_note, 1000), '')
     where id = review.id;
    update public.payment_transactions
       set status = 'failed', updated_at = now()
     where id = tx.id and status = 'pending';
    if tx.booking_id is not null then
      perform public.cancel_vnpay_booking(
        tx.booking_id,
        'Manual transfer rejected'
      );
    end if;
    insert into public.payment_notification_jobs (transaction_id, kind)
    values (tx.id, 'student_rejected')
    on conflict do nothing;
    return jsonb_build_object('status', 'failed');
  end if;
  if p_action <> 'confirm' then
    return jsonb_build_object('status', 'invalid_action');
  end if;

  -- A mentorship slot cannot be reclaimed after its review grace because the
  -- slot may have returned to inventory. Plus has no scarce slot: an explicit
  -- founder receipt confirmation grants it regardless of review time.
  if review.review_deadline_at <= now() and tx.product_type = 'mentorship' then
    update public.manual_payment_reviews
       set state = 'confirmed', reviewed_at = now(),
           reviewed_by = p_reviewer_id,
           reviewer_note = nullif(left(p_note, 1000), '')
     where id = review.id;
    update public.payment_transactions
       set status = 'paid_unfulfilled', paid_at = coalesce(paid_at, now())
     where id = tx.id and status = 'pending';
    if tx.booking_id is not null then
      perform public.cancel_vnpay_booking(
        tx.booking_id,
        'Manual payment received after review grace'
      );
    end if;
    insert into public.payment_notification_jobs (transaction_id, kind)
    values (tx.id, 'student_needs_support')
    on conflict do nothing;
    return jsonb_build_object('status', 'paid_unfulfilled');
  end if;

  result := public.fulfill_payment_transaction(tx.id, p_reviewer_id);
  if result->>'status' in ('fulfilled', 'paid_unfulfilled') then
    update public.manual_payment_reviews
       set state = 'confirmed', reviewed_at = now(),
           reviewed_by = p_reviewer_id,
           reviewer_note = nullif(left(p_note, 1000), '')
     where id = review.id;
  end if;
  if result->>'status' = 'paid_unfulfilled' then
    insert into public.payment_notification_jobs (transaction_id, kind)
    values (tx.id, 'student_needs_support')
    on conflict do nothing;
  end if;
  return result;
end;
$$;

create or replace function public.reconcile_confirmed_manual_plus_payment(
  p_transaction_id uuid,
  p_actor uuid default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  tx public.payment_transactions%rowtype;
  review public.manual_payment_reviews%rowtype;
  result jsonb;
begin
  select * into tx
    from public.payment_transactions
   where id = p_transaction_id
   for update;
  if not found then return jsonb_build_object('status', 'not_found'); end if;

  select * into review
    from public.manual_payment_reviews
   where transaction_id = tx.id
   for update;
  if not found
     or tx.provider <> 'manual_bank_transfer'
     or tx.product_type <> 'plus'
     or tx.status <> 'paid_unfulfilled'
     or review.state <> 'confirmed'
     or review.reviewed_at is null then
    return jsonb_build_object('status', 'not_eligible');
  end if;

  if exists (
    select 1 from public.plus_subscriptions
     where payment_transaction_id = tx.id
  ) then
    update public.payment_transactions
       set status = 'fulfilled',
           fulfilled_at = coalesce(fulfilled_at, now()),
           fulfillment_error_code = null,
           fulfillment_error_detail = null
     where id = tx.id;
    return jsonb_build_object('status', 'already_fulfilled');
  end if;

  update public.payment_transactions
     set status = 'pending',
         fulfillment_error_code = null,
         fulfillment_error_detail = null
   where id = tx.id;
  result := public.fulfill_payment_transaction(tx.id, p_actor);
  return result;
end;
$$;

revoke all on function public.reconcile_confirmed_manual_plus_payment(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.reconcile_confirmed_manual_plus_payment(uuid, uuid)
  to service_role;

-- Repair every Plus payment for which the founder explicitly confirmed
-- receipt. The function and subscription unique index make this safe to re-run
-- without double-granting credits or duration.
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
