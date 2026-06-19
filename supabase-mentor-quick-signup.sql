-- ============================================================================
-- GLOWBAL — MENTOR QUICK SIGNUP FLAG
-- Run this in the Supabase SQL Editor, AFTER supabase-global-station.sql /
-- supabase-mentorship.sql (which create + extend public.achiever_profiles).
-- Safe to re-run.
--
-- Adds a flag marking mentors who came through the fast-track ("quick signup")
-- flow: a token-gated link we share with people we already know would make
-- good mentors. They skip the document-evidence upload step. The profile is
-- STILL created as 'pending' and reviewed by an admin — the token only removes
-- the document burden, it does not auto-approve.
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'achiever_profiles'
      and column_name = 'quick_signup'
  ) then
    alter table public.achiever_profiles
      add column quick_signup boolean not null default false;
  end if;
end $$;
