-- ============================================================================
-- GLOWBAL — COORDINATOR ROLE + AMBASSADOR (đại sứ truyền thông) LINK TRACKING
--
-- One coordinator (team member) creates a personal share link (/c/<code>) for
-- each media ambassador and tracks how much traffic each ambassador drives
-- (total visits + unique visitors).
--
-- IDEMPOTENT TRANSFORM: an earlier v1 of this file created `coordinator_links`
-- / `coordinator_visits` / `coordinator_link_stats`. This script renames those
-- to the ambassador_* shape (no data loss, no DROP TABLE) and is safe to re-run
-- and to run on a fresh database.
-- ============================================================================

-- ── 1. Role flag (same pattern as student_profiles.is_admin) ─────────────────
alter table public.student_profiles
  add column if not exists is_coordinator boolean default false;

-- ── 2. Rename v1 tables → ambassador_* (only if old exists and new doesn't) ──
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'coordinator_links')
     and not exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'ambassador_links') then
    alter table public.coordinator_links rename to ambassador_links;
  end if;

  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'coordinator_visits')
     and not exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'ambassador_visits') then
    alter table public.coordinator_visits rename to ambassador_visits;
  end if;
end $$;

-- ── 3. Create tables if missing (fresh-install path) ─────────────────────────
create table if not exists public.ambassador_links (
  id              uuid primary key default gen_random_uuid(),
  coordinator_id  uuid not null references auth.users(id) on delete cascade, -- owner (the coordinator)
  ambassador_name text,                                                      -- set NOT NULL in step 4
  code            text not null unique,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.ambassador_visits (
  id              uuid primary key default gen_random_uuid(),
  link_id         uuid not null references public.ambassador_links(id) on delete cascade,
  coordinator_id  uuid not null references auth.users(id) on delete cascade, -- denormalised owner
  visitor_id      text not null,
  is_unique       boolean not null default false,
  visited_at      timestamptz not null default now(),
  landing_path    text,
  referrer        text,
  user_agent      text,
  ip_hash         text,
  utm             jsonb not null default '{}'::jsonb
);

-- ── 4. Ambassador name: add, backfill, enforce NOT NULL, drop legacy label ───
alter table public.ambassador_links add column if not exists ambassador_name text;

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'ambassador_links'
               and column_name = 'label') then
    update public.ambassador_links
      set ambassador_name = coalesce(ambassador_name, nullif(label, ''), 'Ambassador')
      where ambassador_name is null;
  else
    update public.ambassador_links
      set ambassador_name = 'Ambassador'
      where ambassador_name is null;
  end if;
end $$;

alter table public.ambassador_links alter column ambassador_name set not null;
alter table public.ambassador_links drop column if exists label;

-- ── 5. Indexes (new names; drop legacy names to avoid duplicates) ────────────
drop index if exists public.idx_coordinator_links_coordinator;
drop index if exists public.idx_coordinator_visits_link;
drop index if exists public.idx_coordinator_visits_coordinator;
drop index if exists public.idx_coordinator_visits_visitor;

create index if not exists idx_ambassador_links_coordinator
  on public.ambassador_links(coordinator_id);
create index if not exists idx_ambassador_visits_link
  on public.ambassador_visits(link_id);
create index if not exists idx_ambassador_visits_coordinator
  on public.ambassador_visits(coordinator_id, visited_at);
create index if not exists idx_ambassador_visits_visitor
  on public.ambassador_visits(link_id, visitor_id);

-- ── 5b. Referral attribution (one ambassador per referred user, last-touch) ──
-- A user who arrives via /c/<code> and then signs up / logs in is attributed to
-- the ambassador link. user_id is the PK so an upsert overwrites the previous
-- attribution (last-touch) and "referred users" = a simple row count per link.
create table if not exists public.ambassador_referrals (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  link_id         uuid not null references public.ambassador_links(id) on delete cascade,
  coordinator_id  uuid not null references auth.users(id) on delete cascade,
  referred_at     timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_ambassador_referrals_link
  on public.ambassador_referrals(link_id);
create index if not exists idx_ambassador_referrals_coordinator
  on public.ambassador_referrals(coordinator_id);

-- ── 6. Aggregate view (per ambassador) ───────────────────────────────────────
-- Scalar subqueries (not joins) so adding referred_users can't multiply the
-- visit counts via a cartesian product across the two child tables.
drop view if exists public.coordinator_link_stats;
create or replace view public.ambassador_link_stats as
select
  l.id              as link_id,
  l.coordinator_id,
  l.code,
  l.ambassador_name,
  l.is_active,
  (select count(*)                  from public.ambassador_visits v    where v.link_id = l.id) as total_visits,
  (select count(distinct v.visitor_id) from public.ambassador_visits v where v.link_id = l.id) as unique_visitors,
  (select max(v.visited_at)         from public.ambassador_visits v    where v.link_id = l.id) as last_visit_at,
  (select count(*)                  from public.ambassador_referrals r where r.link_id = l.id) as referred_users
from public.ambassador_links l;

-- ── 6b. Sign-ups (referred users) per coordinator per day ────────────────────
-- Powers the coordinator dashboard's "Total sign-ups through links" box (sum)
-- + 30-day chart. Day is bucketed in Vietnam time (Asia/Ho_Chi_Minh).
-- Supersedes the old login-based coordinator_login_daily view.
drop view if exists public.coordinator_login_daily;
create or replace view public.coordinator_referral_daily as
select
  coordinator_id,
  (referred_at at time zone 'Asia/Ho_Chi_Minh')::date as day,
  count(*)                                             as signup_count
from public.ambassador_referrals
group by coordinator_id, (referred_at at time zone 'Asia/Ho_Chi_Minh')::date;

-- ── 7. Row-level security ────────────────────────────────────────────────────
-- Writes go through the service-role admin client (bypasses RLS); ownership is
-- enforced in code. The SELECT policies are defense-in-depth so a coordinator
-- can only ever read their own rows via the user-bound client.
alter table public.ambassador_links     enable row level security;
alter table public.ambassador_visits    enable row level security;
alter table public.ambassador_referrals enable row level security;

-- Drop legacy v1 policy names (they carried over onto the renamed tables).
drop policy if exists "Service role full access to coordinator_links"  on public.ambassador_links;
drop policy if exists "Coordinators read own links"                    on public.ambassador_links;
drop policy if exists "Service role full access to coordinator_visits" on public.ambassador_visits;
drop policy if exists "Coordinators read own visits"                   on public.ambassador_visits;

drop policy if exists "Service role full access to ambassador_links" on public.ambassador_links;
create policy "Service role full access to ambassador_links"
  on public.ambassador_links as permissive for all
  to service_role using (true) with check (true);

drop policy if exists "Coordinators read own ambassador_links" on public.ambassador_links;
create policy "Coordinators read own ambassador_links"
  on public.ambassador_links as permissive for select
  to authenticated using (auth.uid() = coordinator_id);

drop policy if exists "Service role full access to ambassador_visits" on public.ambassador_visits;
create policy "Service role full access to ambassador_visits"
  on public.ambassador_visits as permissive for all
  to service_role using (true) with check (true);

drop policy if exists "Coordinators read own ambassador_visits" on public.ambassador_visits;
create policy "Coordinators read own ambassador_visits"
  on public.ambassador_visits as permissive for select
  to authenticated using (auth.uid() = coordinator_id);

drop policy if exists "Service role full access to ambassador_referrals" on public.ambassador_referrals;
create policy "Service role full access to ambassador_referrals"
  on public.ambassador_referrals as permissive for all
  to service_role using (true) with check (true);

drop policy if exists "Coordinators read own ambassador_referrals" on public.ambassador_referrals;
create policy "Coordinators read own ambassador_referrals"
  on public.ambassador_referrals as permissive for select
  to authenticated using (auth.uid() = coordinator_id);

-- ── 8. updated_at trigger ────────────────────────────────────────────────────
create or replace function public.update_ambassador_links_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists coordinator_links_updated_at on public.ambassador_links;
drop trigger if exists ambassador_links_updated_at  on public.ambassador_links;
create trigger ambassador_links_updated_at
  before update on public.ambassador_links
  for each row
  execute function public.update_ambassador_links_updated_at();

-- Remove the now-unused v1 trigger function (after its trigger is gone).
drop function if exists public.update_coordinator_links_updated_at();
