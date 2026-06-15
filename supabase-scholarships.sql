-- ============================================================================
-- GLOWBAL — SCHOLARSHIPS MIGRATION
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query),
-- AFTER supabase-schema.sql (this file references public.universities).
-- Safe to re-run: every object guards with `if not exists` / `do $$` blocks.
--
-- Why two tables instead of one column on `universities`?
--   Scholarships are NOT 1:1 with a university. A row can be:
--     - scope='university'  → tied to one OR many specific universities
--     - scope='country'     → government / national (Chevening, MEXT, Fulbright)
--     - scope='consortium'  → multi-university programmes (Erasmus Mundus)
--     - scope='provider'    → a foundation / company, no specific school
--   `public.scholarships` holds the award; `public.scholarship_universities`
--   is the many-to-many link to specific schools (empty for country/provider).
--
-- NOTE: the legacy freetext `public.universities.scholarship` column is
-- superseded by these tables. Treat these as the source of truth; do not
-- dual-write. Drop that column once the university UI reads from here.
-- ============================================================================

-- ── 1. Enums ────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'scholarship_scope') then
    create type scholarship_scope as enum ('university', 'country', 'consortium', 'provider');
  end if;
  if not exists (select 1 from pg_type where typname = 'scholarship_status') then
    create type scholarship_status as enum ('draft', 'published', 'archived');
  end if;
end $$;

-- pg_trgm powers fuzzy name search (Supabase ships the extension).
create extension if not exists pg_trgm;

-- ── 2. scholarships table ─────────────────────────────────────────────────────
-- funding_type is text[] (not an array of enum): rows frequently combine types
-- ("Merit-based & Need-based"), and adding tokens to an enum array is painful
-- to migrate. Membership is enforced with a CHECK using the <@ (subset) operator.
create table if not exists public.scholarships (
  id              bigserial primary key,

  -- Identity
  name            text not null,
  slug            text,                          -- url-friendly, derived in ETL

  scope           scholarship_scope not null default 'provider',

  -- Non-university anchors (used when scope != 'university', or as context).
  country         text,                          -- e.g. 'United Kingdom'
  provider        text,                          -- e.g. 'Chevening / FCDO'

  -- Funding classification (combined → multiple tokens).
  funding_type    text[] not null default '{}',

  -- Value / coverage: structured-ish, with a freetext fallback that's always kept.
  coverage        text,                          -- "Full tuition + stipend"
  amount_min      numeric,
  amount_max      numeric,
  amount_currency text,                          -- 'USD','GBP','EUR','AUD','VND', …
  slots           int,                           -- # of awards when parseable
  slots_text      text,                          -- "~20/year", "varies", …

  -- Long freetext (mixed EN/VI — the auto-translate layer handles display).
  eligibility     text,                          -- "Đối tượng"
  applies_to_text text,                          -- raw "Trường áp dụng" (audit)
  conditions      text,                          -- "Điều kiện apply"
  insight         text,                          -- advisory notes

  -- Deadline: structured date when unambiguous + freetext fallback.
  deadline_date   date,
  deadline_text   text,

  -- Provenance / i18n
  source_url      text,
  source_lang     text check (source_lang in ('en', 'vi', 'mixed')),
  ranking_note    text,                          -- raw "Ranking" / acceptance-rate

  -- Catch-all for un-promoted columns (no data loss).
  raw             jsonb not null default '{}',

  -- Workflow: rows load as 'draft' (hidden) until curated → 'published'.
  status          scholarship_status not null default 'draft',

  -- Idempotency key for the loader: sha1(normalized name + '|' + url).
  source_key      text unique,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint scholarships_funding_type_valid check (
    funding_type <@ array[
      'merit', 'need', 'leadership', 'research', 'sport', 'diversity',
      'regional', 'field-specific', 'full-ride', 'partial', 'travel', 'other'
    ]::text[]
  )
);

create index if not exists idx_scholarships_status    on public.scholarships(status);
create index if not exists idx_scholarships_scope     on public.scholarships(scope);
create index if not exists idx_scholarships_country   on public.scholarships(country);
create index if not exists idx_scholarships_funding   on public.scholarships using gin (funding_type);
create index if not exists idx_scholarships_raw       on public.scholarships using gin (raw);
create index if not exists idx_scholarships_name_trgm on public.scholarships using gin (name gin_trgm_ops);

-- ── 3. scholarship_universities (many-to-many) ───────────────────────────────
create table if not exists public.scholarship_universities (
  scholarship_id  bigint not null references public.scholarships(id) on delete cascade,
  university_id   bigint not null references public.universities(id) on delete cascade,
  match_score     int,                           -- 0-100 ETL confidence
  match_method    text,                          -- 'exact' | 'alias' | 'ilike' | 'manual'
  confirmed       boolean not null default false, -- true after human review
  created_at      timestamptz not null default now(),
  primary key (scholarship_id, university_id)
);

create index if not exists idx_sch_uni_university on public.scholarship_universities(university_id);

-- ── 4. updated_at trigger ─────────────────────────────────────────────────────
create or replace function public.touch_scholarships_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_scholarships on public.scholarships;
create trigger trg_touch_scholarships
  before update on public.scholarships
  for each row
  execute function public.touch_scholarships_updated_at();

-- ── 5. RLS — mirror the universities public-read pattern, but published-only ──
alter table public.scholarships enable row level security;
alter table public.scholarship_universities enable row level security;

do $$
begin
  -- Normal users only ever see published scholarships.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'scholarships'
      and policyname = 'Authenticated users can read published scholarships'
  ) then
    create policy "Authenticated users can read published scholarships"
      on public.scholarships for select
      to authenticated
      using (status = 'published');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'scholarships'
      and policyname = 'Service role full access to scholarships'
  ) then
    create policy "Service role full access to scholarships"
      on public.scholarships for all
      to service_role
      using (true)
      with check (true);
  end if;

  -- Join rows readable only when their scholarship is published.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'scholarship_universities'
      and policyname = 'Read scholarship_universities for published'
  ) then
    create policy "Read scholarship_universities for published"
      on public.scholarship_universities for select
      to authenticated
      using (exists (
        select 1 from public.scholarships s
        where s.id = scholarship_universities.scholarship_id
          and s.status = 'published'
      ));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'scholarship_universities'
      and policyname = 'Service role full access to scholarship_universities'
  ) then
    create policy "Service role full access to scholarship_universities"
      on public.scholarship_universities for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;
