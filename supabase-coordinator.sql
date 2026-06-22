-- ============================================================================
-- GLOWBAL — COORDINATOR ROLE + AFFILIATE-STYLE VISIT TRACKING
-- Standalone migration. Adds a "coordinator" role, a per-coordinator share
-- link (/c/<code>), and an append-only visit log used to count how much
-- traffic each coordinator drives (total visits + unique visitors).
-- ============================================================================

-- ── Role flag (same pattern as student_profiles.is_admin) ───────────────────
alter table public.student_profiles
  add column if not exists is_coordinator boolean default false;

-- ── Share links (1 active link per coordinator today; table allows more) ─────
create table if not exists public.coordinator_links (
  id              uuid primary key default gen_random_uuid(),
  coordinator_id  uuid not null references auth.users(id) on delete cascade,
  code            text not null unique,
  label           text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_coordinator_links_coordinator
  on public.coordinator_links(coordinator_id);

-- ── Visit log (append-only) ──────────────────────────────────────────────────
create table if not exists public.coordinator_visits (
  id              uuid primary key default gen_random_uuid(),
  link_id         uuid not null references public.coordinator_links(id) on delete cascade,
  coordinator_id  uuid not null references auth.users(id) on delete cascade, -- denormalised for fast filtering
  visitor_id      text not null,                  -- UUID from the gb_visitor cookie
  is_unique       boolean not null default false, -- first time this visitor_id hit this link
  visited_at      timestamptz not null default now(),
  landing_path    text,
  referrer        text,
  user_agent      text,
  ip_hash         text,                           -- sha256(ip + salt); raw IP is never stored
  utm             jsonb not null default '{}'::jsonb
);

create index if not exists idx_coordinator_visits_link
  on public.coordinator_visits(link_id);
create index if not exists idx_coordinator_visits_coordinator
  on public.coordinator_visits(coordinator_id, visited_at);
create index if not exists idx_coordinator_visits_visitor
  on public.coordinator_visits(link_id, visitor_id);

-- ── Aggregate view for headline numbers (avoids COUNT(DISTINCT) from JS) ──────
create or replace view public.coordinator_link_stats as
select
  l.id            as link_id,
  l.coordinator_id,
  l.code,
  l.is_active,
  count(v.id)                       as total_visits,
  count(distinct v.visitor_id)      as unique_visitors,
  max(v.visited_at)                 as last_visit_at
from public.coordinator_links l
left join public.coordinator_visits v on v.link_id = l.id
group by l.id, l.coordinator_id, l.code, l.is_active;

-- ── Row-level security ───────────────────────────────────────────────────────
-- Writes (creating links, inserting visits) go through the service-role admin
-- client, which bypasses RLS. The policies below are defense-in-depth so a
-- coordinator can only ever read their own rows via the user-bound client.
alter table public.coordinator_links  enable row level security;
alter table public.coordinator_visits enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'coordinator_links'
      and policyname = 'Service role full access to coordinator_links'
  ) then
    create policy "Service role full access to coordinator_links"
      on public.coordinator_links as permissive for all
      to service_role using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'coordinator_links'
      and policyname = 'Coordinators read own links'
  ) then
    create policy "Coordinators read own links"
      on public.coordinator_links as permissive for select
      to authenticated using (auth.uid() = coordinator_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'coordinator_visits'
      and policyname = 'Service role full access to coordinator_visits'
  ) then
    create policy "Service role full access to coordinator_visits"
      on public.coordinator_visits as permissive for all
      to service_role using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'coordinator_visits'
      and policyname = 'Coordinators read own visits'
  ) then
    create policy "Coordinators read own visits"
      on public.coordinator_visits as permissive for select
      to authenticated using (auth.uid() = coordinator_id);
  end if;
end $$;

-- ── updated_at trigger for coordinator_links ─────────────────────────────────
create or replace function public.update_coordinator_links_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists coordinator_links_updated_at on public.coordinator_links;
create trigger coordinator_links_updated_at
  before update on public.coordinator_links
  for each row
  execute function public.update_coordinator_links_updated_at();
