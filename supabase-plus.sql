-- ============================================================================
-- GLOWBAL — PLUS SUBSCRIPTIONS MIGRATION
-- Run in the Supabase SQL Editor (Dashboard → SQL Editor → New Query).
-- Safe to re-run: guarded with `if not exists` blocks.
--
-- Adds the GlowBal Plus subscription state to the existing student_profiles
-- table, plus an audit table of individual purchases. Payments are taken via
-- Stripe payment links; activation is recorded here on the success redirect.
-- ============================================================================

-- ── 1. Plus columns on student_profiles ──────────────────────────────────────
do $$
begin
  if not exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='student_profiles' and column_name='plus_status') then
    alter table public.student_profiles add column plus_status boolean not null default false;
  end if;

  if not exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='student_profiles' and column_name='plus_plan') then
    alter table public.student_profiles add column plus_plan text;
  end if;

  if not exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='student_profiles' and column_name='plus_started_at') then
    alter table public.student_profiles add column plus_started_at timestamptz;
  end if;

  if not exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='student_profiles' and column_name='plus_expires_at') then
    alter table public.student_profiles add column plus_expires_at timestamptz;
  end if;

  -- Bundled AI strategy credits. Free users start with 2 (the free allowance);
  -- a Plus purchase tops this up by the plan's credit amount.
  if not exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='student_profiles' and column_name='ai_strategy_credits') then
    alter table public.student_profiles add column ai_strategy_credits int not null default 2;
  end if;

  if not exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='student_profiles' and column_name='ai_strategies_used') then
    alter table public.student_profiles add column ai_strategies_used int not null default 0;
  end if;
end $$;

-- ── 2. plus_subscriptions audit table ─────────────────────────────────────────
create table if not exists public.plus_subscriptions (
  id              uuid primary key default gen_random_uuid(),

  user_id         uuid not null references auth.users(id) on delete cascade,

  plan            text not null,             -- 'plus-6m' | 'plus-12m' | 'plus-24m'
  price_label     text,                      -- display string captured at purchase
  ai_credits      int not null default 0,    -- credits granted by this purchase
  duration_months int not null default 0,

  -- Provenance from the Stripe payment link redirect (sandbox/test mode).
  stripe_reference text,

  status          text not null default 'active',  -- 'active' | 'expired' | 'refunded'
  started_at      timestamptz not null default now(),
  expires_at      timestamptz,

  created_at      timestamptz not null default now()
);

create index if not exists idx_plus_subscriptions_user on public.plus_subscriptions(user_id);

-- ── 3. RLS — users read their own subscriptions; service role manages all ─────
alter table public.plus_subscriptions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='plus_subscriptions'
      and policyname='Users read own plus subscriptions'
  ) then
    create policy "Users read own plus subscriptions"
      on public.plus_subscriptions for select
      to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='plus_subscriptions'
      and policyname='Service role full access to plus subscriptions'
  ) then
    create policy "Service role full access to plus subscriptions"
      on public.plus_subscriptions for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;
