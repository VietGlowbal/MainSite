-- ============================================================================
-- GLOWBAL EMAIL + LIFECYCLE NOTIFICATION SYSTEM
-- Safe to re-run in the Supabase SQL editor.
-- ============================================================================

create table if not exists public.email_deliveries (
  id                  bigserial primary key,
  user_id             uuid references auth.users(id) on delete set null,
  recipient           text not null,
  template            text not null,
  category            text not null check (category in ('security','product_transactional','product_reminder','marketing')),
  event_key           text unique,
  subject             text not null,
  provider            text not null default 'resend',
  provider_message_id text,
  status              text not null default 'sending' check (status in ('queued','sending','sent','failed','delivered','bounced','complained')),
  attempt_count       integer not null default 1,
  error               text,
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  sent_at             timestamptz,
  failed_at           timestamptz
);

create index if not exists email_deliveries_user_created_idx
  on public.email_deliveries (user_id, created_at desc);
create index if not exists email_deliveries_recipient_created_idx
  on public.email_deliveries (recipient, created_at desc);
create index if not exists email_deliveries_template_created_idx
  on public.email_deliveries (template, created_at desc);

alter table public.email_deliveries enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='email_deliveries'
      and policyname='Service role manages email deliveries'
  ) then
    create policy "Service role manages email deliveries"
      on public.email_deliveries for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

create table if not exists public.email_preferences (
  user_id                  uuid primary key references auth.users(id) on delete cascade,
  deadline_reminders       boolean not null default true,
  weekly_strategy_digest   boolean not null default true,
  scholarship_alerts       boolean not null default true,
  mentorship_reminders     boolean not null default true,
  product_updates          boolean not null default true,
  marketing                boolean not null default false,
  preferred_language       text not null default 'en' check (preferred_language in ('en','vi')),
  timezone                 text not null default 'Asia/Ho_Chi_Minh',
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

alter table public.email_preferences enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='email_preferences'
      and policyname='Users manage own email preferences'
  ) then
    create policy "Users manage own email preferences"
      on public.email_preferences for all
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='email_preferences'
      and policyname='Service role manages email preferences'
  ) then
    create policy "Service role manages email preferences"
      on public.email_preferences for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

-- Marketing consent remains owned by student_profiles/newsletter_subscriptions.
-- This table is the student's granular product-email preference surface.
