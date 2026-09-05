-- ============================================================================
-- GLOWBAL — NEWSLETTER SUBSCRIPTIONS
-- Standalone migration for newsletter/mailing list functionality
-- ============================================================================

-- Newsletter subscriptions table
create table if not exists public.newsletter_subscriptions (
  id              bigserial primary key,
  email           text not null unique,
  first_name      text,
  status          text not null default 'active' check (status in ('active', 'unsubscribed')),
  source          text default 'website',
  subscribed_at   timestamptz not null default now(),
  unsubscribed_at timestamptz,
  last_email_sent timestamptz,
  
  -- Preferences
  topics          text[] default '{}',
  frequency       text default 'immediate' check (frequency in ('immediate', 'daily', 'weekly')),
  
  -- Metadata
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Index for faster lookups
create index if not exists idx_newsletter_subscriptions_email on public.newsletter_subscriptions(email);
create index if not exists idx_newsletter_subscriptions_status on public.newsletter_subscriptions(status);

-- Enable RLS
alter table public.newsletter_subscriptions enable row level security;

-- Service role full access
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'newsletter_subscriptions'
      and policyname = 'Allow service role full access to newsletter_subscriptions'
  ) then
    create policy "Allow service role full access to newsletter_subscriptions"
      on public.newsletter_subscriptions
      as permissive
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

-- Newsletter content tracking (to avoid sending duplicates)
create table if not exists public.newsletter_content_sent (
  id              bigserial primary key,
  content_type    text not null check (content_type in ('guide', 'news')),
  content_slug    text not null,
  content_title   text not null,
  sent_at         timestamptz not null default now(),
  recipient_count int not null default 0,
  
  unique(content_type, content_slug)
);

-- Enable RLS
alter table public.newsletter_content_sent enable row level security;

-- Service role full access
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'newsletter_content_sent'
      and policyname = 'Allow service role full access to newsletter_content_sent'
  ) then
    create policy "Allow service role full access to newsletter_content_sent"
      on public.newsletter_content_sent
      as permissive
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

-- Function to update updated_at timestamp
create or replace function update_newsletter_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger for updated_at
drop trigger if exists newsletter_subscriptions_updated_at on public.newsletter_subscriptions;
create trigger newsletter_subscriptions_updated_at
  before update on public.newsletter_subscriptions
  for each row
  execute function update_newsletter_updated_at();
