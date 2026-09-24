-- ============================================================================
-- GLOWBAL — SOP TIERING MIGRATION
-- Run in the Supabase SQL Editor (Dashboard → SQL Editor → New Query).
-- Safe to re-run: guarded with `if not exists`.
--
-- The Statement-of-Purpose (SOP) AI feedback tool is tiered by Plus status:
--   • Plus (student_profiles.plus_status = true): full analysis that uses the
--     student's uploaded CV/profile for tailored strategic recommendations.
--   • Free / declined: limited analysis (no CV, smaller token budget) capped at
--     a few free runs. This counter meters those free runs.
-- ============================================================================

do $$
begin
  if not exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='student_profiles' and column_name='sop_analyses_used') then
    alter table public.student_profiles add column sop_analyses_used int not null default 0;
  end if;
end $$;
