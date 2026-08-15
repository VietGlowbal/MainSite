-- GlowBal — founder-confirmed manual bank transfer follow-up migration
-- Run after supabase-vnpay-payments.sql. This is intentionally a separate,
-- guarded follow-up; never edit an applied migration to repair a live type or
-- constraint. Do not put bank details, QR URLs, or secrets in this file.

do $$
declare
  c record;
begin
  -- The original VNPay migration had a provider = 'vnpay' check. Remove only
  -- provider checks and replace them with the provider-neutral contract below.
  for c in
    select conname from pg_constraint
     where conrelid = 'public.payment_transactions'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%provider%'
  loop
    execute format('alter table public.payment_transactions drop constraint if exists %I', c.conname);
  end loop;
end $$;

alter table public.payment_transactions
  alter column vnp_amount drop not null;

alter table public.payment_transactions
  drop constraint if exists payment_transactions_vnp_amount_check;
alter table public.payment_transactions
  add constraint payment_transactions_provider_amount_check
  check (
    (provider = 'vnpay' and vnp_amount = amount_vnd * 100)
    or (provider = 'manual_bank_transfer' and vnp_amount is null)
  );
alter table public.payment_transactions
  add constraint payment_transactions_provider_check
  check (provider in ('vnpay', 'manual_bank_transfer'));

do $$
declare col_name text;
begin
  for col_name in select * from (values ('recipient_name'), ('recipient_email'), ('locale'), ('summary')) as cols(name) loop
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='payment_transactions' and column_name=col_name) then
      execute format('alter table public.payment_transactions add column %I text', col_name);
    end if;
  end loop;
end $$;

drop index if exists public.payment_transactions_user_product_idempotency;
drop index if exists public.payment_transactions_user_provider_product_idempotency;
create unique index if not exists payment_transactions_user_provider_product_idempotency
  on public.payment_transactions(user_id, provider, product_type, idempotency_key);

alter table public.payment_transactions enable row level security;
revoke insert, update, delete on public.payment_transactions from anon, authenticated;

create table if not exists public.manual_payment_reviews (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null unique references public.payment_transactions(id) on delete cascade,
  state text not null default 'pending' check (state in ('pending', 'claimed', 'confirmed', 'rejected', 'expired')),
  token_version integer not null default 1 check (token_version > 0),
  expires_at timestamptz not null,
  claimed_at timestamptz,
  review_deadline_at timestamptz not null,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewer_note text check (reviewer_note is null or char_length(reviewer_note) <= 1000),
  bank_label_snapshot text not null,
  bank_qr_revision text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists manual_payment_reviews_state_deadline on public.manual_payment_reviews(state, review_deadline_at);

create table if not exists public.payment_notification_jobs (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.payment_transactions(id) on delete cascade,
  kind text not null check (kind in ('student_instructions', 'founder_review', 'founder_claimed', 'student_confirmed', 'student_rejected', 'student_needs_support')),
  state text not null default 'pending' check (state in ('pending', 'processing', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  lease_expires_at timestamptz,
  last_error text,
  provider_message_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique(transaction_id, kind)
);
create index if not exists payment_notification_jobs_due on public.payment_notification_jobs(state, next_attempt_at);

-- Checkout-time founder notices are retired. Founder receives one actionable
-- email only after the student explicitly reports the transfer.
update public.payment_notification_jobs
set state='failed', lease_expires_at=null,
    last_error='retired: founder is notified after transfer claim'
where kind='founder_review' and state in ('pending','processing');

alter table public.manual_payment_reviews enable row level security;
alter table public.payment_notification_jobs enable row level security;
drop policy if exists manual_payment_reviews_student_read on public.manual_payment_reviews;
create policy manual_payment_reviews_student_read on public.manual_payment_reviews for select to authenticated
  using (exists (select 1 from public.payment_transactions pt where pt.id = transaction_id and auth.uid() = pt.user_id));
drop policy if exists payment_notification_jobs_service_only on public.payment_notification_jobs;
create policy payment_notification_jobs_service_only on public.payment_notification_jobs for all to service_role using (true) with check (true);
revoke all on public.manual_payment_reviews from public, anon, authenticated;
revoke all on public.payment_notification_jobs from public, anon, authenticated;
grant select (transaction_id, state, claimed_at, review_deadline_at)
  on public.manual_payment_reviews to authenticated;

-- JSON rows returned by this function contain only the internal reference and
-- status. The route builds the public status URL and email capability.
create or replace function public.create_manual_payment_checkout(
  p_user_id uuid,
  p_reference text,
  p_product_type text,
  p_amount_vnd bigint,
  p_idempotency_key text,
  p_request_fingerprint text,
  p_expires_at timestamptz,
  p_review_deadline_at timestamptz,
  p_locale text default 'en',
  p_booking_id bigint default null,
  p_slot_id bigint default null,
  p_help_topic text default null,
  p_help_questions text default null,
  p_help_outcome text default null,
  p_user_university_id bigint default null,
  p_plus_plan text default null,
  p_plus_ai_credits integer default null,
  p_plus_duration_months integer default null,
  p_plus_application_id uuid default null,
  p_source_currency text default null,
  p_source_amount numeric default null,
  p_mentor_amount numeric default null,
  p_service_fee numeric default null,
  p_fx_rate numeric default null,
  p_recipient_name text default null,
  p_recipient_email text default null,
  p_summary text default null,
  p_bank_label text default null,
  p_bank_qr_revision text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  tx public.payment_transactions%rowtype;
  review public.manual_payment_reviews%rowtype;
  v_booking_id bigint := p_booking_id;
  slot public.mentor_availability_slots%rowtype;
begin
  -- Contract marker: the atomic bind is always scoped to booking_id = p_booking_id
  -- (or creates the booking from p_slot_id before writing the ledger).
  if p_product_type not in ('mentorship', 'plus') or p_amount_vnd <= 0 then
    raise exception 'invalid manual payment product';
  end if;
  if p_product_type = 'mentorship' and (
    p_source_currency is null or p_source_currency not in ('USD', 'GBP', 'VND')
    or p_source_amount is null or p_source_amount <= 0
    or p_mentor_amount is null or p_mentor_amount <= 0
    or p_service_fee is null or p_service_fee < 0
    or p_source_amount <> p_mentor_amount + p_service_fee
  ) then
    raise exception 'invalid mentorship pricing';
  end if;
  -- A retry returns the original immutable transaction and does not enqueue a
  -- second instruction email. Provider is part of the unique key and fingerprint.
  select * into tx from public.payment_transactions
   where user_id = p_user_id and provider = 'manual_bank_transfer'
     and product_type = p_product_type and idempotency_key = p_idempotency_key
   for update;
  if found then
    if tx.request_fingerprint <> p_request_fingerprint then raise exception using errcode = '23505', message = 'idempotency key reused with different details'; end if;
    select * into review from public.manual_payment_reviews where transaction_id = tx.id;
    return jsonb_build_object('transaction_id', tx.id, 'reference', tx.reference, 'status', tx.status, 'amount_vnd', tx.amount_vnd, 'expires_at', tx.expires_at, 'review_id', review.id, 'token_version', review.token_version, 'booking_id', tx.booking_id);
  end if;

  -- Binding the exact slot and booking is part of the same transaction. The
  -- route may pass no booking_id for mentorship: this branch creates it.
  if p_product_type = 'mentorship' and v_booking_id is null then
    if p_slot_id is null then raise exception 'mentorship slot is required'; end if;
    select * into slot from public.mentor_availability_slots where id = p_slot_id for update;
    if not found or slot.status <> 'open' then raise exception 'slot is no longer available'; end if;
    update public.mentor_availability_slots set status = 'held', hold_expires_at = p_expires_at where id = p_slot_id and status = 'open' and booking_id is null;
    if not found then raise exception 'slot is no longer available'; end if;
    insert into public.bookings (
      applicant_id, achiever_id, user_university_id, scheduled_at, duration_mins,
      session_price_vnd, glowbal_fee_vnd, achiever_payout_vnd, currency,
      amount_total, amount_mentor, amount_service_fee, slot_id, status,
      payment_reference, help_topic, help_questions, help_outcome, applicant_notes
    ) values (
      p_user_id, slot.mentor_id, p_user_university_id, slot.starts_at,
      greatest(1, extract(epoch from (slot.ends_at - slot.starts_at))::integer / 60),
      case when p_source_currency = 'VND' then p_mentor_amount else 0 end,
      case when p_source_currency = 'VND' then p_service_fee else 0 end,
      case when p_source_currency = 'VND' then p_mentor_amount else 0 end,
      p_source_currency, p_source_amount, p_mentor_amount, p_service_fee,
      p_slot_id, 'pending_payment', p_reference, p_help_topic, p_help_questions,
      p_help_outcome, p_help_questions
    ) returning id into v_booking_id;
    update public.mentor_availability_slots set booking_id = v_booking_id where id = p_slot_id and status = 'held' and booking_id is null;
    if not found then raise exception 'slot ownership binding failed'; end if;
  end if;

  insert into public.payment_transactions (
    reference, user_id, provider, product_type, status, amount_vnd, vnp_amount,
    source_currency, source_amount, fx_rate, idempotency_key, request_fingerprint,
    booking_id, plus_plan, plus_ai_credits, plus_duration_months, plus_application_id,
    recipient_name, recipient_email, locale,
    summary, expires_at
  ) values (
    p_reference, p_user_id, 'manual_bank_transfer', p_product_type, 'pending', p_amount_vnd, null,
    p_source_currency, p_source_amount, p_fx_rate,
    p_idempotency_key, p_request_fingerprint, v_booking_id, p_plus_plan, p_plus_ai_credits,
    p_plus_duration_months, p_plus_application_id, p_recipient_name, p_recipient_email,
    p_locale, p_summary, p_expires_at
  ) returning * into tx;
  insert into public.manual_payment_reviews (
    transaction_id, expires_at, review_deadline_at, bank_label_snapshot, bank_qr_revision
  ) values (tx.id, p_expires_at, p_review_deadline_at, coalesce(p_bank_label, 'configured bank'), coalesce(p_bank_qr_revision, 'configured')) returning * into review;
  insert into public.payment_notification_jobs (transaction_id, kind)
  values (tx.id, 'student_instructions');
  return jsonb_build_object('transaction_id', tx.id, 'reference', tx.reference, 'status', tx.status, 'amount_vnd', tx.amount_vnd, 'expires_at', tx.expires_at, 'review_id', review.id, 'token_version', review.token_version, 'booking_id', tx.booking_id);
exception when unique_violation then
  select * into tx from public.payment_transactions where user_id = p_user_id and provider = 'manual_bank_transfer' and product_type = p_product_type and idempotency_key = p_idempotency_key;
  if found then
    if tx.request_fingerprint is distinct from p_request_fingerprint then
      raise exception using errcode = '23505', message = 'idempotency key reused with different details';
    end if;
    select * into review from public.manual_payment_reviews where transaction_id = tx.id;
    return jsonb_build_object('transaction_id', tx.id, 'reference', tx.reference, 'status', tx.status, 'amount_vnd', tx.amount_vnd, 'expires_at', tx.expires_at, 'review_id', review.id, 'token_version', review.token_version, 'booking_id', tx.booking_id);
  end if;
  raise;
end;
$$;

create or replace function public.claim_manual_payment(p_user_id uuid, p_reference text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare tx public.payment_transactions%rowtype; review public.manual_payment_reviews%rowtype; deadline timestamptz;
begin
  select * into tx from public.payment_transactions where user_id = p_user_id and provider = 'manual_bank_transfer' and reference = p_reference for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  select * into review from public.manual_payment_reviews where transaction_id = tx.id for update;
  if tx.status <> 'pending' or review.state not in ('pending','claimed') then return jsonb_build_object('ok', false, 'reason', 'not_claimable', 'status', tx.status); end if;
  if review.claimed_at is not null then return jsonb_build_object('ok', true, 'status', 'claimed', 'already_claimed', true); end if;
  if tx.expires_at <= now() then update public.payment_transactions set status = 'expired' where id = tx.id and status = 'pending'; update public.manual_payment_reviews set state = 'expired' where id = review.id; if tx.booking_id is not null then perform public.cancel_vnpay_booking(tx.booking_id, 'Manual transfer checkout expired'); end if; return jsonb_build_object('ok', false, 'reason', 'expired', 'status', 'expired'); end if;
  deadline := case when tx.product_type = 'mentorship' then tx.expires_at + interval '2 hours' else tx.expires_at end;
  if tx.product_type = 'mentorship' and tx.booking_id is not null then
    update public.mentor_availability_slots set hold_expires_at = deadline
      where booking_id = tx.booking_id and status = 'held' and hold_expires_at is not null;
    if not found then
      -- A claim is only a student statement, never evidence of receipt. If
      -- the held slot is gone, expire this unpaid checkout and release only
      -- resources still owned by this transaction.
      update public.payment_transactions set status = 'expired', paid_at = null where id = tx.id and status = 'pending';
      update public.manual_payment_reviews set state = 'expired' where id = review.id;
      if tx.booking_id is not null then perform public.cancel_vnpay_booking(tx.booking_id, 'Manual transfer claim lost slot ownership'); end if;
      return jsonb_build_object('ok', false, 'reason', 'slot_not_owned', 'status', 'expired');
    end if;
  end if;
  update public.manual_payment_reviews set state = 'claimed', claimed_at = now(), review_deadline_at = deadline where id = review.id;
  insert into public.payment_notification_jobs (transaction_id, kind) values (tx.id, 'founder_claimed') on conflict do nothing;
  return jsonb_build_object('ok', true, 'status', 'claimed', 'review_deadline_at', deadline);
end;
$$;

-- Provider-neutral entitlement/booking fulfilment. VNPay IPN and founder review
-- call the same function; the ledger row lock makes confirmation idempotent.
create or replace function public.fulfill_payment_transaction(p_transaction_id uuid, p_actor uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare tx public.payment_transactions%rowtype; booking public.bookings%rowtype; slot public.mentor_availability_slots%rowtype; profile public.student_profiles%rowtype; expires timestamptz;
begin
  select * into tx from public.payment_transactions where id = p_transaction_id for update;
  if not found then return jsonb_build_object('status','not_found'); end if;
  if tx.status = 'fulfilled' then return jsonb_build_object('status','already_fulfilled'); end if;
  if tx.status in ('failed','expired','paid_unfulfilled') then return jsonb_build_object('status',tx.status); end if;
  if tx.product_type = 'mentorship' then
    if tx.booking_id is null then update public.payment_transactions set status='paid_unfulfilled', paid_at=coalesce(paid_at,now()) where id=tx.id; return jsonb_build_object('status','paid_unfulfilled'); end if;
    select * into booking from public.bookings where id=tx.booking_id for update;
    select * into slot from public.mentor_availability_slots where id=booking.slot_id for update;
    if not found or booking.status <> 'pending_payment' or slot.status <> 'held' or slot.booking_id is distinct from booking.id or slot.hold_expires_at is null or slot.hold_expires_at < now() then
      update public.payment_transactions set status='paid_unfulfilled', paid_at=coalesce(paid_at,now()) where id=tx.id;
      return jsonb_build_object('status','paid_unfulfilled');
    end if;
    update public.bookings set status='confirmed', payment_confirmed_at=now(), meeting_link=coalesce(meeting_link, 'https://meet.jit.si/glowbal-' || booking.id::text || '-' || replace(gen_random_uuid()::text,'-','')) where id=booking.id and status='pending_payment';
    update public.mentor_availability_slots set status='booked', hold_expires_at=null where id=booking.slot_id and status='held' and booking_id=booking.id;
  else
    select * into profile from public.student_profiles where user_id=tx.user_id for update;
    if not found then insert into public.student_profiles (user_id,plus_status,plus_plan,plus_started_at,plus_expires_at,ai_strategy_credits) values (tx.user_id,true,tx.plus_plan,now(),now()+make_interval(months=>tx.plus_duration_months),0) on conflict (user_id) do nothing; select * into profile from public.student_profiles where user_id=tx.user_id for update; end if;
    expires := greatest(coalesce(profile.plus_expires_at, now()), now()) + make_interval(months=>tx.plus_duration_months);
    -- credit_amount is added exactly once while the ledger row is locked.
    update public.student_profiles set plus_status=true, plus_plan=tx.plus_plan, plus_started_at=coalesce(profile.plus_started_at,now()), plus_expires_at=expires, ai_strategy_credits=coalesce(profile.ai_strategy_credits,0)+coalesce(tx.plus_ai_credits,0) where user_id=tx.user_id;
    insert into public.plus_subscriptions (user_id,plan,price_label,ai_credits,duration_months,payment_transaction_id,vnpay_reference,status,started_at,expires_at) values (tx.user_id,tx.plus_plan,tx.amount_vnd::text || ' VND',tx.plus_ai_credits,tx.plus_duration_months,tx.id,tx.reference,'active',now(),expires) on conflict (payment_transaction_id) do nothing;
  end if;
  update public.payment_transactions set status='fulfilled', paid_at=coalesce(paid_at,now()), fulfilled_at=now(), notification_status='pending' where id=tx.id;
  insert into public.payment_notification_jobs (transaction_id,kind) values (tx.id,'student_confirmed') on conflict do nothing;
  return jsonb_build_object('status','fulfilled');
exception when others then
  update public.payment_transactions set status='paid_unfulfilled', paid_at=coalesce(paid_at,now()), notification_status='failed' where id=p_transaction_id;
  return jsonb_build_object('status','paid_unfulfilled');
end;
$$;

create or replace function public.review_manual_payment(p_review_id uuid, p_token_version integer, p_action text, p_reviewer_id uuid, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare review public.manual_payment_reviews%rowtype; tx public.payment_transactions%rowtype; result jsonb;
begin
  select * into review from public.manual_payment_reviews where id=p_review_id for update;
  if not found then return jsonb_build_object('status','not_found'); end if;
  select * into tx from public.payment_transactions where id=review.transaction_id for update;
  if review.token_version <> p_token_version then return jsonb_build_object('status','invalid_token'); end if;
  if review.state in ('confirmed','rejected','expired') or tx.status in ('fulfilled','paid_unfulfilled','failed','expired') then return jsonb_build_object('status',coalesce(tx.status,review.state),'already_terminal',true); end if;
  if p_action = 'reject' then
    update public.manual_payment_reviews set state='rejected', reviewed_at=now(), reviewed_by=p_reviewer_id, reviewer_note=nullif(left(p_note,1000),'') where id=review.id;
    update public.payment_transactions set status='failed', updated_at=now() where id=tx.id and status='pending';
    if tx.booking_id is not null then perform public.cancel_vnpay_booking(tx.booking_id,'Manual transfer rejected'); end if;
    insert into public.payment_notification_jobs (transaction_id,kind) values (tx.id,'student_rejected') on conflict do nothing;
    return jsonb_build_object('status','failed');
  end if;
  if p_action <> 'confirm' then return jsonb_build_object('status','invalid_action'); end if;
  -- A founder confirmation after the owned hold/review grace is evidence of
  -- receipt but cannot reclaim a slot or silently grant a stale product.
  if review.review_deadline_at <= now() then
    update public.manual_payment_reviews set state='confirmed', reviewed_at=now(), reviewed_by=p_reviewer_id, reviewer_note=nullif(left(p_note,1000),'') where id=review.id;
    update public.payment_transactions set status='paid_unfulfilled', paid_at=coalesce(paid_at,now()) where id=tx.id and status='pending';
    if tx.booking_id is not null then perform public.cancel_vnpay_booking(tx.booking_id,'Manual payment received after review grace'); end if;
    insert into public.payment_notification_jobs (transaction_id,kind) values (tx.id,'student_needs_support') on conflict do nothing;
    return jsonb_build_object('status','paid_unfulfilled');
  end if;
  result := public.fulfill_payment_transaction(tx.id,p_reviewer_id);
  if result->>'status'='fulfilled' then update public.manual_payment_reviews set state='confirmed', reviewed_at=now(), reviewed_by=p_reviewer_id, reviewer_note=nullif(left(p_note,1000),'') where id=review.id; elsif result->>'status'='paid_unfulfilled' then update public.manual_payment_reviews set state='confirmed', reviewed_at=now(), reviewed_by=p_reviewer_id, reviewer_note=nullif(left(p_note,1000),'') where id=review.id; insert into public.payment_notification_jobs (transaction_id,kind) values (tx.id,'student_needs_support') on conflict do nothing; end if;
  return result;
end;
$$;

create or replace function public.lease_manual_payment_notification_jobs(p_limit integer default 10)
returns setof jsonb language plpgsql security definer set search_path = public as $$
declare job record; tx jsonb; review jsonb; out jsonb;
begin
  for job in select j.* from public.payment_notification_jobs j where (j.state='pending' or (j.state='processing' and j.lease_expires_at < now())) and j.next_attempt_at <= now() order by case when j.kind='founder_claimed' then 0 else 1 end, j.created_at FOR UPDATE SKIP LOCKED limit greatest(1,least(p_limit,50)) loop
    update public.payment_notification_jobs set state='processing', attempts=attempts+1, lease_expires_at=now()+interval '5 minutes' where id=job.id;
    select to_jsonb(t) || jsonb_build_object('recipient_name', coalesce(u.raw_user_meta_data->>'full_name',split_part(u.email,'@',1)), 'recipient_email', u.email, 'recipient_phone', coalesce(nullif(btrim(u.raw_user_meta_data->>'phone'),''),'')) into tx from public.payment_transactions t join auth.users u on u.id=t.user_id where t.id=job.transaction_id;
    select to_jsonb(r) || jsonb_build_object('capability_token', null) into review from public.manual_payment_reviews r where r.transaction_id=job.transaction_id;
    out := jsonb_build_object('id',job.id,'transaction_id',job.transaction_id,'kind',job.kind,'transaction',tx,'review',review);
    return next out;
  end loop;
end;
$$;

create or replace function public.complete_manual_payment_notification_job(p_job_id uuid, p_provider_message_id text)
returns void language sql security definer set search_path = public as $$
  update public.payment_notification_jobs set state='sent', sent_at=now(), lease_expires_at=null, provider_message_id=left(p_provider_message_id,255), last_error=null where id=p_job_id and state='processing';
$$;
create or replace function public.fail_manual_payment_notification_job(p_job_id uuid, p_error text)
returns void language sql security definer set search_path = public as $$
  update public.payment_notification_jobs set state=case when attempts >= 12 then 'failed' else 'pending' end, lease_expires_at=null, last_error=left(p_error,500), next_attempt_at=now()+least(make_interval(hours=>24), make_interval(mins=>greatest(5, power(2, least(attempts,8))::integer))) where id=p_job_id and state='processing';
$$;

revoke all on function public.create_manual_payment_checkout(uuid,text,text,bigint,text,text,timestamptz,timestamptz,text,bigint,bigint,text,text,text,bigint,text,integer,integer,uuid,text,numeric,numeric,numeric,numeric,text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.claim_manual_payment(uuid,text) from public, anon, authenticated;
revoke all on function public.fulfill_payment_transaction(uuid,uuid) from public, anon, authenticated;
revoke all on function public.review_manual_payment(uuid,integer,text,uuid,text) from public, anon, authenticated;
revoke all on function public.lease_manual_payment_notification_jobs(integer) from public, anon, authenticated;
revoke all on function public.complete_manual_payment_notification_job(uuid,text) from public, anon, authenticated;
revoke all on function public.fail_manual_payment_notification_job(uuid,text) from public, anon, authenticated;
grant execute on function public.create_manual_payment_checkout(uuid,text,text,bigint,text,text,timestamptz,timestamptz,text,bigint,bigint,text,text,text,bigint,text,integer,integer,uuid,text,numeric,numeric,numeric,numeric,text,text,text,text,text) to service_role;
grant execute on function public.claim_manual_payment(uuid,text) to service_role;
grant execute on function public.fulfill_payment_transaction(uuid,uuid) to service_role;
grant execute on function public.review_manual_payment(uuid,integer,text,uuid,text) to service_role;
grant execute on function public.lease_manual_payment_notification_jobs(integer) to service_role;
grant execute on function public.complete_manual_payment_notification_job(uuid,text) to service_role;
grant execute on function public.fail_manual_payment_notification_job(uuid,text) to service_role;

-- Rebind VNPay's successful path to the same fulfilment transaction. The
-- callback remains VNPay-specific for signature/amount metadata, while slot
-- ownership and Plus credits are now maintained in one locked function.
create or replace function public.process_vnpay_ipn(
  p_reference text, p_amount bigint, p_response_code text,
  p_transaction_status text, p_transaction_no text default null,
  p_bank_code text default null, p_pay_date text default null,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare tx public.payment_transactions%rowtype; result jsonb;
begin
  select * into tx from public.payment_transactions where reference=p_reference for update;
  if not found then return jsonb_build_object('rsp_code','01','message','Order not found'); end if;
  if tx.provider <> 'vnpay' or tx.vnp_amount is distinct from p_amount then return jsonb_build_object('rsp_code','04','message','Invalid amount'); end if;
  if tx.status in ('fulfilled','paid_unfulfilled') then return jsonb_build_object('rsp_code','02','message','Order already confirmed'); end if;
  update public.payment_transactions set vnp_transaction_no=coalesce(p_transaction_no,vnp_transaction_no), vnp_response_code=p_response_code, vnp_transaction_status=p_transaction_status, vnp_bank_code=p_bank_code, vnp_pay_date=p_pay_date, vnp_payload=coalesce(p_payload,'{}'::jsonb), paid_at=case when p_response_code='00' and p_transaction_status='00' then coalesce(paid_at,now()) else paid_at end where id=tx.id;
  if p_response_code <> '00' or p_transaction_status <> '00' then
    update public.payment_transactions set status='failed' where id=tx.id and status='pending';
    if tx.booking_id is not null then perform public.cancel_vnpay_booking(tx.booking_id,'VNPay payment failed'); end if;
    return jsonb_build_object('rsp_code','00','message','Payment failed recorded');
  end if;
  if tx.expires_at <= now() then
    update public.payment_transactions set status='paid_unfulfilled' where id=tx.id and status='pending';
    if tx.booking_id is not null then perform public.cancel_vnpay_booking(tx.booking_id,'VNPay payment arrived after checkout expiry'); end if;
    return jsonb_build_object('rsp_code','00','message','Payment received for manual review');
  end if;
  result := public.fulfill_payment_transaction(tx.id,null);
  if result->>'status' = 'fulfilled' then return jsonb_build_object('rsp_code','00','message','Confirm Success'); end if;
  return jsonb_build_object('rsp_code','00','message','Payment received for manual review');
end;
$$;
revoke all on function public.process_vnpay_ipn(text,bigint,text,text,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.process_vnpay_ipn(text,bigint,text,text,text,text,text,jsonb) to service_role;
