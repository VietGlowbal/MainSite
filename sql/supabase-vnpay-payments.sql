-- GLOWBAL — VNPAY SANDBOX PAYMENT LEDGER
-- Safe to re-run. Run after supabase-mentorship.sql and supabase-plus.sql.
-- Never put VNPAY_HASH_SECRET in this file.

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'vnpay' check (provider = 'vnpay'),
  product_type text not null check (product_type in ('mentorship', 'plus')),
  status text not null default 'pending'
    check (status in ('pending', 'fulfilled', 'failed', 'expired', 'paid_unfulfilled')),
  amount_vnd bigint not null check (amount_vnd > 0),
  vnp_amount bigint not null check (vnp_amount = amount_vnd * 100),
  source_currency text,
  source_amount numeric,
  fx_rate numeric,
  idempotency_key text not null,
  request_fingerprint text not null,
  booking_id bigint references public.bookings(id) on delete set null,
  plus_plan text,
  plus_ai_credits integer,
  plus_duration_months integer,
  plus_application_id uuid,
  vnp_transaction_no text,
  vnp_response_code text,
  vnp_transaction_status text,
  vnp_bank_code text,
  vnp_pay_date text,
  vnp_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  paid_at timestamptz,
  fulfilled_at timestamptz,
  notification_status text not null default 'pending'
    check (notification_status in ('pending', 'sent', 'failed', 'not_required'))
);

create unique index if not exists payment_transactions_user_product_idempotency
  on public.payment_transactions(user_id, product_type, idempotency_key);
create index if not exists payment_transactions_status_expiry
  on public.payment_transactions(status, expires_at);
create index if not exists payment_transactions_user_created
  on public.payment_transactions(user_id, created_at desc);
create unique index if not exists payment_transactions_vnp_transaction_no
  on public.payment_transactions(vnp_transaction_no)
  where vnp_transaction_no is not null;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'plus_subscriptions'
      and column_name = 'payment_transaction_id'
  ) then
    alter table public.plus_subscriptions add column payment_transaction_id uuid;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'plus_subscriptions'
      and column_name = 'vnpay_reference'
  ) then
    alter table public.plus_subscriptions add column vnpay_reference text;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where connamespace = 'public'::regnamespace
      and conrelid = 'public.plus_subscriptions'::regclass
      and conname = 'plus_subscriptions_payment_transaction_id_fkey'
  ) then
    alter table public.plus_subscriptions
      add constraint plus_subscriptions_payment_transaction_id_fkey
      foreign key (payment_transaction_id)
      references public.payment_transactions(id)
      on delete set null;
  end if;
end $$;

create unique index if not exists plus_subscriptions_payment_transaction_id
  on public.plus_subscriptions(payment_transaction_id)
  where payment_transaction_id is not null;

alter table public.payment_transactions enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'payment_transactions'
      and policyname = 'Users read own payment transactions'
  ) then
    create policy "Users read own payment transactions"
      on public.payment_transactions for select
      to authenticated using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'payment_transactions'
      and policyname = 'Service role full access to payment transactions'
  ) then
    create policy "Service role full access to payment transactions"
      on public.payment_transactions for all
      to service_role using (true) with check (true);
  end if;
end $$;

create or replace function public.touch_payment_transaction()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_payment_transaction on public.payment_transactions;
create trigger trg_touch_payment_transaction
  before update on public.payment_transactions
  for each row execute function public.touch_payment_transaction();

-- Keep cancellation from an expired/late VNPay booking from releasing a slot
-- that has already been re-held by another booking.
create or replace function public.sync_slot_status_on_booking_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.slot_id is null then
    return NEW;
  end if;

  if NEW.status = 'confirmed' then
    update public.mentor_availability_slots
       set status = 'booked', booking_id = NEW.id, hold_expires_at = null
     where id = NEW.slot_id
       and status in ('held', 'open')
       and (booking_id is null or booking_id = NEW.id);
  elsif NEW.status = 'cancelled' then
    update public.mentor_availability_slots
       set status = 'open', booking_id = null, hold_expires_at = null
     where id = NEW.slot_id
       and (booking_id is null or booking_id = NEW.id);
  end if;
  return NEW;
end;
$$;

create or replace function public.cancel_vnpay_booking(
  p_booking_id bigint,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  booking_slot_id bigint;
begin
  select slot_id into booking_slot_id
    from public.bookings
   where id = p_booking_id
   for update;

  update public.bookings
     set status = 'cancelled',
         cancelled_by = 'admin',
         cancellation_reason = p_reason
   where id = p_booking_id and status = 'pending_payment';

  if found and booking_slot_id is not null then
    update public.mentor_availability_slots
       set status = 'open', booking_id = null, hold_expires_at = null
     where id = booking_slot_id
       and status = 'held'
       and booking_id = p_booking_id;
  end if;
end;
$$;

-- Expire one pending ledger row and release only its still-owned mentorship
-- hold. This is also used by idempotent checkout retries.
create or replace function public.expire_vnpay_transaction(p_transaction_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  tx public.payment_transactions%rowtype;
begin
  select * into tx
    from public.payment_transactions
   where id = p_transaction_id
   for update;
  if not found or tx.status <> 'pending' then
    return false;
  end if;

  update public.payment_transactions
     set status = 'expired'
   where id = tx.id and status = 'pending';

  if tx.product_type = 'mentorship' and tx.booking_id is not null then
    perform public.cancel_vnpay_booking(tx.booking_id, 'VNPay checkout expired');
  end if;
  return true;
end;
$$;

-- Reclaims abandoned VNPay holds. The route calls this lazily and a protected
-- scheduler can call it periodically in production.
create or replace function public.reclaim_vnpay_expired_holds()
returns integer language plpgsql security definer set search_path = public as $$
declare
  changed integer := 0;
  hold record;
begin
  for hold in
    select s.id as slot_id, s.booking_id, tx.id as transaction_id
      from public.mentor_availability_slots s
      join public.payment_transactions tx
        on tx.booking_id = s.booking_id
       and tx.provider = 'vnpay'
       and tx.status = 'pending'
     where s.status = 'held'
       and s.booking_id is not null
       and s.hold_expires_at is not null
       and s.hold_expires_at <= now()
     for update of s, tx
  loop
    perform public.expire_vnpay_transaction(hold.transaction_id);
    changed := changed + 1;
  end loop;
  return changed;
end;
$$;

-- Processes one authenticated VNPAY callback while holding the ledger row.
-- The browser Return URL never calls this function.
create or replace function public.process_vnpay_ipn(
  p_reference text,
  p_amount bigint,
  p_response_code text,
  p_transaction_status text,
  p_transaction_no text default null,
  p_bank_code text default null,
  p_pay_date text default null,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  tx public.payment_transactions%rowtype;
  booking public.bookings%rowtype;
  slot public.mentor_availability_slots%rowtype;
  profile public.student_profiles%rowtype;
  base_expiry timestamptz;
  new_expiry timestamptz;
  subscription_expiry timestamptz;
begin
  select * into tx from public.payment_transactions
    where reference = p_reference for update;
  if not found then
    return jsonb_build_object('rsp_code', '01', 'message', 'Order not found');
  end if;
  if tx.provider <> 'vnpay' or tx.vnp_amount <> p_amount then
    return jsonb_build_object('rsp_code', '04', 'message', 'Invalid amount');
  end if;
  if tx.status in ('fulfilled', 'paid_unfulfilled') then
    return jsonb_build_object('rsp_code', '02', 'message', 'Order already confirmed');
  end if;

  if tx.status in ('failed', 'expired') then
    if p_response_code = '00' and p_transaction_status = '00' then
      update public.payment_transactions
         set vnp_transaction_no = coalesce(p_transaction_no, vnp_transaction_no),
             vnp_response_code = p_response_code,
             vnp_transaction_status = p_transaction_status,
             vnp_bank_code = p_bank_code,
             vnp_pay_date = p_pay_date,
             vnp_payload = coalesce(p_payload, '{}'::jsonb),
             paid_at = coalesce(paid_at, now()),
             status = 'paid_unfulfilled',
             notification_status = 'failed'
       where id = tx.id;
      return jsonb_build_object('rsp_code', '00', 'message', 'Payment received for manual review');
    end if;
    return jsonb_build_object('rsp_code', '02', 'message', 'Order already confirmed');
  end if;

  update public.payment_transactions
     set vnp_transaction_no = coalesce(p_transaction_no, vnp_transaction_no),
         vnp_response_code = p_response_code,
         vnp_transaction_status = p_transaction_status,
         vnp_bank_code = p_bank_code,
         vnp_pay_date = p_pay_date,
         vnp_payload = coalesce(p_payload, '{}'::jsonb),
         paid_at = case when p_response_code = '00' and p_transaction_status = '00' then now() else paid_at end
   where id = tx.id;

  if p_response_code <> '00' or p_transaction_status <> '00' then
    update public.payment_transactions set status = 'failed' where id = tx.id;
    if tx.product_type = 'mentorship' and tx.booking_id is not null then
      perform public.cancel_vnpay_booking(tx.booking_id, 'VNPay payment failed');
    end if;
    return jsonb_build_object('rsp_code', '00', 'message', 'Payment failed recorded');
  end if;
  if tx.expires_at <= now() then
    update public.payment_transactions set status = 'paid_unfulfilled' where id = tx.id;
    if tx.product_type = 'mentorship' and tx.booking_id is not null then
      perform public.cancel_vnpay_booking(tx.booking_id, 'VNPay payment arrived after checkout expiry');
    end if;
    return jsonb_build_object('rsp_code', '00', 'message', 'Payment received for manual review');
  end if;

  if tx.product_type = 'mentorship' then
    if tx.booking_id is null then
      update public.payment_transactions set status = 'paid_unfulfilled' where id = tx.id;
      return jsonb_build_object('rsp_code', '00', 'message', 'Payment received for manual review');
    end if;
    select * into booking from public.bookings where id = tx.booking_id for update;
    if not found or booking.slot_id is null then
      update public.payment_transactions set status = 'paid_unfulfilled' where id = tx.id;
      if tx.booking_id is not null then
        perform public.cancel_vnpay_booking(tx.booking_id, 'VNPay booking invariant failed');
      end if;
      return jsonb_build_object('rsp_code', '00', 'message', 'Payment received for manual review');
    end if;
    select * into slot from public.mentor_availability_slots where id = booking.slot_id for update;
    if not found then
      update public.payment_transactions set status = 'paid_unfulfilled' where id = tx.id;
      perform public.cancel_vnpay_booking(tx.booking_id, 'VNPay slot no longer exists');
      return jsonb_build_object('rsp_code', '00', 'message', 'Payment received for manual review');
    end if;
    if booking.status <> 'pending_payment'
       or slot.status <> 'held'
       or slot.booking_id is distinct from booking.id
       or slot.hold_expires_at is null
       or slot.hold_expires_at < now() then
      update public.payment_transactions set status = 'paid_unfulfilled' where id = tx.id;
      perform public.cancel_vnpay_booking(tx.booking_id, 'VNPay slot ownership invariant failed');
      return jsonb_build_object('rsp_code', '00', 'message', 'Payment received for manual review');
    end if;
    update public.bookings
       set status = 'confirmed',
           payment_confirmed_at = now(),
           meeting_link = coalesce(
             booking.meeting_link,
             'https://meet.jit.si/glowbal-' || booking.id::text || '-' || replace(gen_random_uuid()::text, '-', '')
           )
     where id = booking.id and status = 'pending_payment';
    update public.mentor_availability_slots
       set status = 'booked', booking_id = booking.id, hold_expires_at = null
     where id = booking.slot_id and status = 'held' and booking_id = booking.id;
    update public.payment_transactions
       set status = 'fulfilled', fulfilled_at = now(), notification_status = 'pending'
     where id = tx.id;
  else
    select * into profile from public.student_profiles where user_id = tx.user_id for update;
    if not found then
      insert into public.student_profiles (user_id, plus_status, plus_plan, plus_started_at,
        plus_expires_at, ai_strategy_credits)
      values (tx.user_id, true, tx.plus_plan, now(),
        now() + make_interval(months => tx.plus_duration_months), 0)
      on conflict (user_id) do nothing;
      select * into profile from public.student_profiles where user_id = tx.user_id for update;
    end if;
    base_expiry := greatest(coalesce(profile.plus_expires_at, now()), now());
    new_expiry := base_expiry + make_interval(months => tx.plus_duration_months);
    subscription_expiry := new_expiry;
    update public.student_profiles
       set plus_status = true,
           plus_plan = tx.plus_plan,
           plus_started_at = coalesce(profile.plus_started_at, now()),
           plus_expires_at = new_expiry,
           ai_strategy_credits = coalesce(profile.ai_strategy_credits, 0) + tx.plus_ai_credits
     where user_id = tx.user_id;
    insert into public.plus_subscriptions (
      user_id, plan, price_label, ai_credits, duration_months,
      payment_transaction_id, vnpay_reference, status, started_at, expires_at
    ) values (
      tx.user_id, tx.plus_plan, tx.amount_vnd::text || ' VND', tx.plus_ai_credits,
      tx.plus_duration_months, tx.id, tx.reference, 'active', now(),
      subscription_expiry
    );
    update public.payment_transactions
       set status = 'fulfilled', fulfilled_at = now(), notification_status = 'pending'
     where id = tx.id;
  end if;
  return jsonb_build_object('rsp_code', '00', 'message', 'Confirm Success');
exception when others then
  update public.payment_transactions
     set status = 'paid_unfulfilled', notification_status = 'failed'
   where id = tx.id;
  return jsonb_build_object('rsp_code', '99', 'message', 'Unknown error');
end;
$$;

-- These security-definer functions must never be callable from browser roles.
revoke all on function public.process_vnpay_ipn(text, bigint, text, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.expire_vnpay_transaction(uuid) from public, anon, authenticated;
revoke all on function public.reclaim_vnpay_expired_holds() from public, anon, authenticated;
revoke all on function public.cancel_vnpay_booking(bigint, text) from public, anon, authenticated;
revoke all on function public.sync_slot_status_on_booking_change() from public, anon, authenticated;
revoke all on function public.touch_payment_transaction() from public, anon, authenticated;

grant execute on function public.process_vnpay_ipn(text, bigint, text, text, text, text, text, jsonb) to service_role;
grant execute on function public.expire_vnpay_transaction(uuid) to service_role;
grant execute on function public.reclaim_vnpay_expired_holds() to service_role;
