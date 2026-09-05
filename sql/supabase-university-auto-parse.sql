-- ============================================================================
-- GLOWBAL — universities created from a parsed course page
-- ----------------------------------------------------------------------------
-- The parse worker now resolves `course_applications.university_id` for every
-- application imported from a pasted URL, and creates a row when the directory
-- does not have that institution yet (see
-- src/features/universities/api/university-resolver.ts).
--
-- Those rows are tagged `source = 'auto_course_parse'`, a fourth value beside
-- the ones supabase-university-source.sql documents:
--   • 'curated'           — the original hand-curated import
--   • 'mentor_signup'     — a mentor typed in a university we did not have
--   • 'auto'              — the discovery cron (/api/cron/discover-universities)
--   • 'auto_course_parse' — THIS: read off a course page a student pasted
--
-- WHAT THESE ROWS DELIBERATELY DO NOT CONTAIN. Only identity: name, country,
-- type, local_name, primary_domain. Never qs_rank, accept_rate,
-- admission_difficulty or tuition. `computeUniversitySelectivity`
-- (src/lib/admission-fit.ts) reads exactly those columns to place a student in
-- reach / recommend / safe, and it degrades gracefully — with all of them null
-- it returns a neutral 58. A model asked to recall a ranking it did not read
-- will answer anyway, and a wrong rank does not fail loudly; it quietly tells a
-- student their safety school is a reach. Leave them null until a human fills
-- them in.
--
-- This script is idempotent. It depends on supabase-university-source.sql
-- (the `source` column) and supabase-university-domain.sql (`primary_domain`);
-- both are re-created here if missing so the order you run them does not matter.
-- ============================================================================

-- 1. `source`, in case supabase-university-source.sql has not been run.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'universities'
      and column_name = 'source'
  ) then
    alter table public.universities add column source text not null default 'curated';
  end if;
end $$;

-- 2. `primary_domain`, in case supabase-university-domain.sql has not been run.
--    The resolver falls back to name-only matching without it, which is
--    materially worse: the domain is the only signal it fully trusts.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'universities'
      and column_name = 'primary_domain'
  ) then
    alter table public.universities add column primary_domain text;
  end if;
end $$;

create index if not exists idx_universities_source on public.universities(source);

-- 3. Domain lookups are the resolver's hot path, and it queries with a trailing
--    wildcard (`ilike '%utoronto.ca'`) so a stored value with or without a
--    scheme both match. text_pattern_ops does not help a leading wildcard, so
--    this is a plain index — enough at directory scale, and honest about it.
create index if not exists idx_universities_primary_domain
  on public.universities(primary_domain)
  where primary_domain is not null;

-- 4. Finding an application that still needs linking. The backfill endpoint
--    (/api/cron/link-applications) filters on exactly this.
create index if not exists idx_course_applications_unlinked
  on public.course_applications(created_at desc)
  where university_id is null;

-- ── Review queue ────────────────────────────────────────────────────────────
-- Everything a student's paste has added, newest first. These are sparse by
-- design; enriching one is what turns a bare name into a page with a crest,
-- a hero image and real entry requirements.
--
-- select id, name, country, type, primary_domain
-- from public.universities
-- where source = 'auto_course_parse'
-- order by id desc;

-- How much of the backlog the resolver actually managed to link:
--
-- select
--   count(*) filter (where university_id is not null) as linked,
--   count(*) filter (where university_id is null)     as unlinked
-- from public.course_applications
-- where status <> 'archived';
