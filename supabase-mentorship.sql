-- ============================================================================
-- GLOWBAL — MENTORSHIP HUB MIGRATION
-- Run AFTER supabase-global-station.sql.
--
-- Extends the existing `achiever_profiles`, `bookings`, and adds new
-- tables for the Mentorship Hub:
--   - Mentor identity / verification documents (CV, acceptance letter, etc.)
--   - Multi-currency hourly pricing (USD, GBP, VND)
--   - Calendar-style monthly availability slots
--   - Mentor strengths, image, full bio
--   - Stripe-driven booking & payment flow
--   - Help-request prompt fields on bookings
-- ============================================================================

-- ── 1. Extend achiever_profiles with mentor fields ─────────────────────────

do $$
begin
  -- Legal name (kept private; display_name is what shows publicly)
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='achiever_profiles' and column_name='legal_name') then
    alter table public.achiever_profiles add column legal_name text;
  end if;

  -- Date of birth (private)
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='achiever_profiles' and column_name='date_of_birth') then
    alter table public.achiever_profiles add column date_of_birth date;
  end if;

  -- Study window (e.g. 2021 → 2024) shown publicly on the mentor profile
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='achiever_profiles' and column_name='study_start_year') then
    alter table public.achiever_profiles add column study_start_year int;
  end if;

  -- Mentor strengths / "special skills" tags shown on profile
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='achiever_profiles' and column_name='strengths') then
    alter table public.achiever_profiles add column strengths text[] not null default '{}';
  end if;

  -- Verification document storage keys (private bucket)
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='achiever_profiles' and column_name='cv_storage_key') then
    alter table public.achiever_profiles add column cv_storage_key text;
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='achiever_profiles' and column_name='acceptance_letter_storage_key') then
    alter table public.achiever_profiles add column acceptance_letter_storage_key text;
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='achiever_profiles' and column_name='transcript_storage_key') then
    alter table public.achiever_profiles add column transcript_storage_key text;
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='achiever_profiles' and column_name='student_card_storage_key') then
    alter table public.achiever_profiles add column student_card_storage_key text;
  end if;

  -- Multi-currency hourly rate. We keep the legacy session_price_vnd column
  -- and the new fields side by side so existing data continues to work.
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='achiever_profiles' and column_name='hourly_rate_amount') then
    -- Stored in the smallest unit of the currency:
    --   USD: cents (USD 25.00 -> 2500)
    --   GBP: pence (GBP 25.00 -> 2500)
    --   VND: đồng (VND 500,000 -> 500000)
    alter table public.achiever_profiles add column hourly_rate_amount bigint;
  end if;

  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='achiever_profiles' and column_name='hourly_rate_currency') then
    alter table public.achiever_profiles
      add column hourly_rate_currency text default 'USD'
      check (hourly_rate_currency in ('USD','GBP','VND'));
  end if;

  -- Stripe Connect account id for payouts (set once mentor onboards on Stripe).
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='achiever_profiles' and column_name='stripe_account_id') then
    alter table public.achiever_profiles add column stripe_account_id text;
  end if;
end $$;

-- Backfill hourly_rate_amount from legacy session_price_vnd where missing.
-- session_price_vnd was per-session; if duration was 60min it equals hourly.
-- We treat it as VND hourly (round to 1000-đồng) when no amount is set.
update public.achiever_profiles
set
  hourly_rate_amount = case
    when session_duration_mins = 60 then session_price_vnd
    else round(session_price_vnd::numeric * 60 / nullif(session_duration_mins, 0))::bigint
  end,
  hourly_rate_currency = coalesce(hourly_rate_currency, 'VND')
where hourly_rate_amount is null
  and session_price_vnd is not null;


-- ── 2. Calendar-style availability (specific dates, not weekly) ────────────

create table if not exists public.mentor_availability_slots (
  id            bigserial primary key,
  mentor_id     uuid not null references public.achiever_profiles(id) on delete cascade,
  -- Concrete UTC start time. Each slot is exactly 60 minutes.
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  -- 'open' = bookable; 'held' = soft-locked during checkout;
  -- 'booked' = a paid booking exists; 'closed' = mentor manually disabled.
  status        text not null default 'open'
                check (status in ('open','held','booked','closed')),
  booking_id    bigint references public.bookings(id) on delete set null,
  hold_expires_at timestamptz,
  created_at    timestamptz not null default now(),
  constraint mentor_slot_after_start check (ends_at > starts_at)
);

-- Prevent two slots starting at the same instant for the same mentor.
create unique index if not exists idx_mentor_slot_unique
  on public.mentor_availability_slots(mentor_id, starts_at);

create index if not exists idx_mentor_slot_mentor on public.mentor_availability_slots(mentor_id);
create index if not exists idx_mentor_slot_status on public.mentor_availability_slots(status, starts_at);

alter table public.mentor_availability_slots enable row level security;

-- Anyone authenticated can see open/held slots for approved mentors so they
-- can pick a time. Mentors can also see their own slots regardless of status.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='mentor_availability_slots'
      and policyname='Read mentor availability for booking'
  ) then
    create policy "Read mentor availability for booking"
      on public.mentor_availability_slots for select
      to authenticated
      using (
        mentor_id = auth.uid()
        or exists (
          select 1 from public.achiever_profiles ap
          where ap.id = mentor_availability_slots.mentor_id
            and ap.status = 'approved'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='mentor_availability_slots'
      and policyname='Mentor manages own slots — insert'
  ) then
    create policy "Mentor manages own slots — insert"
      on public.mentor_availability_slots for insert
      to authenticated
      with check (mentor_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='mentor_availability_slots'
      and policyname='Mentor manages own slots — update'
  ) then
    create policy "Mentor manages own slots — update"
      on public.mentor_availability_slots for update
      to authenticated
      using (mentor_id = auth.uid())
      with check (mentor_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='mentor_availability_slots'
      and policyname='Mentor manages own slots — delete'
  ) then
    create policy "Mentor manages own slots — delete"
      on public.mentor_availability_slots for delete
      to authenticated
      using (mentor_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='mentor_availability_slots'
      and policyname='Service role full access to mentor_availability_slots'
  ) then
    create policy "Service role full access to mentor_availability_slots"
      on public.mentor_availability_slots for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;


-- ── 3. Extend bookings for the new mentorship/payment flow ─────────────────

do $$
begin
  -- Multi-currency pricing on the booking itself, snapshotted at booking time.
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='bookings' and column_name='currency') then
    alter table public.bookings add column currency text default 'VND'
      check (currency in ('USD','GBP','VND'));
  end if;

  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='bookings' and column_name='amount_total') then
    alter table public.bookings add column amount_total bigint;
  end if;

  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='bookings' and column_name='amount_mentor') then
    alter table public.bookings add column amount_mentor bigint;
  end if;

  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='bookings' and column_name='amount_service_fee') then
    -- 10% Glowbal service fee on top of the mentor's hourly rate.
    alter table public.bookings add column amount_service_fee bigint;
  end if;

  -- Link to the held slot — lets us release it on cancellation.
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='bookings' and column_name='slot_id') then
    alter table public.bookings add column slot_id bigint references public.mentor_availability_slots(id);
  end if;

  -- Stripe references for reconciliation.
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='bookings' and column_name='stripe_session_id') then
    alter table public.bookings add column stripe_session_id text;
  end if;

  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='bookings' and column_name='stripe_payment_intent_id') then
    alter table public.bookings add column stripe_payment_intent_id text;
  end if;

  -- Help request fields — what the mentee wants to discuss, in detail.
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='bookings' and column_name='help_topic') then
    alter table public.bookings add column help_topic text;
  end if;

  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='bookings' and column_name='help_questions') then
    alter table public.bookings add column help_questions text;
  end if;

  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='bookings' and column_name='help_outcome') then
    alter table public.bookings add column help_outcome text;
  end if;
end $$;

-- Backfill amount_total from session_price_vnd for legacy rows.
update public.bookings
set
  amount_total = coalesce(amount_total, session_price_vnd),
  amount_service_fee = coalesce(amount_service_fee, glowbal_fee_vnd),
  amount_mentor = coalesce(amount_mentor, achiever_payout_vnd),
  currency = coalesce(currency, 'VND')
where amount_total is null;


-- ── 4. Slot status sync triggers ───────────────────────────────────────────

-- When a booking gets confirmed, mark the slot booked. When it's cancelled,
-- release the slot back to 'open'. We can't easily do this in app code
-- across the Stripe webhook + admin actions, so we do it here.

create or replace function public.sync_slot_status_on_booking_change()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Only act if slot_id is set on the booking.
  if NEW.slot_id is null then
    return NEW;
  end if;

  if NEW.status = 'confirmed' then
    update public.mentor_availability_slots
       set status = 'booked', booking_id = NEW.id, hold_expires_at = null
     where id = NEW.slot_id and status in ('held','open');

  elsif NEW.status = 'cancelled' then
    update public.mentor_availability_slots
       set status = 'open', booking_id = null, hold_expires_at = null
     where id = NEW.slot_id;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_sync_slot_status on public.bookings;
create trigger trg_sync_slot_status
  after insert or update of status on public.bookings
  for each row
  execute function public.sync_slot_status_on_booking_change();


-- ── 5. Storage policies for mentor-documents bucket ────────────────────────
-- Bucket name: mentor-documents (private). Create it manually in the
-- Supabase Dashboard → Storage before running.

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Mentor uploads own documents'
  ) then
    create policy "Mentor uploads own documents"
      on storage.objects for insert
      to authenticated
      with check (
        bucket_id = 'mentor-documents'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Mentor reads own documents'
  ) then
    create policy "Mentor reads own documents"
      on storage.objects for select
      to authenticated
      using (
        bucket_id = 'mentor-documents'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Mentor deletes own documents'
  ) then
    create policy "Mentor deletes own documents"
      on storage.objects for delete
      to authenticated
      using (
        bucket_id = 'mentor-documents'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;


-- ── 6. Relax legacy session_price_vnd constraints ──────────────────────────
-- The original schema defined session_price_vnd as NOT NULL with a
-- `>= 100000` check. The mentorship hub uses multi-currency
-- hourly_rate_amount/hourly_rate_currency, so for non-VND mentors we
-- have nothing meaningful to put in the legacy column. Drop the check
-- and allow NULL so new sign-ups don't hit
-- "achiever_profiles_session_price_vnd_check" violations.
do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'achiever_profiles'
      and constraint_name = 'achiever_profiles_session_price_vnd_check'
  ) then
    alter table public.achiever_profiles
      drop constraint achiever_profiles_session_price_vnd_check;
  end if;

  -- Make the column nullable so the API can omit it for non-VND mentors.
  alter table public.achiever_profiles
    alter column session_price_vnd drop not null;
exception
  when undefined_column then
    -- Column was already removed — nothing to do.
    null;
end $$;
