-- ============================================================================
-- GLOWBAL — LOGIN EVENTS
-- Append-only log of user sign-ins. Supabase only exposes last_sign_in_at (a
-- single timestamp), so we record one row per sign-in to count "số lượt login"
-- per user on the admin dashboard. Best-effort: written from a client hook on
-- the SIGNED_IN auth event, so counting starts from deploy (historical logins
-- are not recoverable). Safe to re-run.
-- ============================================================================

create table if not exists public.login_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  source      text  -- 'oauth' | 'password' | 'unknown'
);

create index if not exists idx_login_events_user
  on public.login_events(user_id, occurred_at);

-- Per-user login count, so the admin dashboard doesn't fetch every event row.
create or replace view public.user_login_counts as
select user_id, count(*) as login_count
from public.login_events
group by user_id;

-- Logins by referred users, per coordinator per day. Powers the coordinator
-- dashboard's "Total logins through links" box + 30-day chart.
-- NOTE: depends on public.ambassador_referrals (supabase-coordinator.sql) — run
-- that migration first. Day is bucketed in Vietnam time (Asia/Ho_Chi_Minh).
create or replace view public.coordinator_login_daily as
select
  r.coordinator_id,
  (e.occurred_at at time zone 'Asia/Ho_Chi_Minh')::date as day,
  count(*)                                              as login_count
from public.login_events e
join public.ambassador_referrals r on r.user_id = e.user_id
group by r.coordinator_id, (e.occurred_at at time zone 'Asia/Ho_Chi_Minh')::date;

alter table public.login_events enable row level security;

-- Writes go through the service-role admin client (the login-event API);
-- there is no client read path, so only a service-role policy is needed.
drop policy if exists "Service role full access to login_events" on public.login_events;
create policy "Service role full access to login_events"
  on public.login_events as permissive for all
  to service_role using (true) with check (true);
