-- ============================================================================
-- GLOWBAL — TEAM MIGRATION (homepage "Team behind GlowBal" section)
-- Run in the Supabase SQL Editor (Dashboard → SQL Editor → New Query).
-- Safe to re-run: every object guards with `if not exists` / `on conflict`.
--
-- Two tables:
--   public.team_members      — one row per founder / team member / mentor
--   public.team_achievements — credibility bullets, grouped by category
--
-- Unlike scholarships (authenticated-only), team data is shown on the public
-- landing page, so RLS allows anon + authenticated to read VISIBLE rows.
-- Writes are service-role only (seeded via SQL / admin tooling).
-- ============================================================================

-- ── 1. team_members ─────────────────────────────────────────────────────────
create table if not exists public.team_members (
  id                  uuid primary key default gen_random_uuid(),

  full_name           text not null,
  slug                text unique not null,
  role                text not null,

  short_bio           text,
  photo_url           text,

  university          text,
  degree              text,
  major               text,
  exchange_university text,

  favourite_quote     text,

  linkedin_url        text,
  instagram_url       text,
  email               text,

  display_order       int not null default 0,
  is_featured         boolean not null default false,
  is_visible          boolean not null default true,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_team_members_visible on public.team_members(is_visible);
create index if not exists idx_team_members_order   on public.team_members(display_order);

-- ── 2. team_achievements ──────────────────────────────────────────────────────
-- category ∈ scholarship | mentoring | education | leadership | award |
--             debate | international_experience | product | quote
create table if not exists public.team_achievements (
  id              uuid primary key default gen_random_uuid(),

  team_member_id  uuid not null references public.team_members(id) on delete cascade,

  category        text not null,
  title           text not null,
  description     text,
  year            int,
  display_order   int not null default 0,

  created_at      timestamptz not null default now(),

  constraint team_achievements_category_valid check (
    category in (
      'scholarship', 'mentoring', 'education', 'leadership', 'award',
      'debate', 'international_experience', 'product', 'quote'
    )
  )
);

create index if not exists idx_team_achievements_member on public.team_achievements(team_member_id);

-- ── 3. updated_at trigger ─────────────────────────────────────────────────────
create or replace function public.touch_team_members_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_team_members on public.team_members;
create trigger trg_touch_team_members
  before update on public.team_members
  for each row
  execute function public.touch_team_members_updated_at();

-- ── 4. RLS — public read of visible rows; service role full access ────────────
alter table public.team_members      enable row level security;
alter table public.team_achievements enable row level security;

do $$
begin
  -- Anyone (incl. anonymous visitors) can read visible team members.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'team_members'
      and policyname = 'Public can read visible team members'
  ) then
    create policy "Public can read visible team members"
      on public.team_members for select
      to anon, authenticated
      using (is_visible = true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'team_members'
      and policyname = 'Service role full access to team_members'
  ) then
    create policy "Service role full access to team_members"
      on public.team_members for all
      to service_role
      using (true)
      with check (true);
  end if;

  -- Achievements readable when their member is visible.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'team_achievements'
      and policyname = 'Public can read achievements of visible members'
  ) then
    create policy "Public can read achievements of visible members"
      on public.team_achievements for select
      to anon, authenticated
      using (exists (
        select 1 from public.team_members m
        where m.id = team_achievements.team_member_id
          and m.is_visible = true
      ));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'team_achievements'
      and policyname = 'Service role full access to team_achievements'
  ) then
    create policy "Service role full access to team_achievements"
      on public.team_achievements for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

-- ── 5. Seed: Nguyen Khanh Linh (founder) ──────────────────────────────────────
insert into public.team_members (
  full_name, slug, role, short_bio,
  university, degree, major, exchange_university,
  favourite_quote, photo_url, display_order, is_featured, is_visible
) values (
  'Nguyen Khanh Linh',
  'nguyen-khanh-linh',
  'Founder',
  'Scholarship recipient, student mentor, and international exchange student helping students build stronger study-abroad plans.',
  'VinUniversity',
  'Bachelor of Business Administration',
  'Marketing',
  'University of Birmingham, UK',
  'Because it is either the pain of perseverance or the pain of failure',
  null,
  1,
  true,
  true
)
on conflict (slug) do nothing;

-- Achievements for the founder (idempotent: clear + reinsert this member's rows).
delete from public.team_achievements
where team_member_id = (select id from public.team_members where slug = 'nguyen-khanh-linh');

insert into public.team_achievements (team_member_id, category, title, description, year, display_order)
select m.id, v.category, v.title, v.description, v.year, v.display_order
from public.team_members m
cross join (values
  ('scholarship', '80% Merit-based Scholarship, VinUniversity',
   'Awarded an 80% merit-based scholarship at VinUniversity.', null::int, 1),
  ('mentoring', 'Mentored students to major VinUniversity scholarships',
   'Mentored 3 students to 75%, 2 students to 80%, and multiple students to 70% VinUniversity Merit-based Scholarships.', null::int, 2),
  ('international_experience', 'Exchange Student at University of Birmingham, UK',
   'Completed an international exchange at the University of Birmingham, UK.', null::int, 3),
  ('debate', 'Open Division Final Judge, Hanoi Debate Tournament 2024',
   'Served as an Open Division Final Judge at Hanoi Debate Tournament 2024.', 2024, 4),
  ('award', '3-time Dean''s List Award Recipient',
   'Recognised on the Dean''s List three times at VinUniversity.', null::int, 5),
  ('leadership', 'Champion of Change, Spring 2026',
   'Named Champion of Change for the Spring 2026 term at VinUniversity.', 2026, 6)
) as v(category, title, description, year, display_order)
where m.slug = 'nguyen-khanh-linh';
