-- ============================================================================
-- GLOWBAL — university provenance column
-- ----------------------------------------------------------------------------
-- Adds a `source` marker on `public.universities` so we can tell apart:
--   • 'curated'        — the original hand-curated import (the 93 we shipped)
--   • 'mentor_signup'  — added when a mentor typed in a university we didn't have
--   • 'auto'           — added by the discovery cron (see
--                        /api/cron/discover-universities)
--
-- Rows that aren't 'curated' have sparse data (no tuition, strengths, etc.) and
-- usually no imagery yet — the image cron (/api/cron/university-images) fills
-- those in, and the team can enrich/verify them. Run once in the Supabase SQL
-- editor; idempotent.
-- ============================================================================

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

-- Helpful for the review queue: "show me everything that wasn't hand-curated".
create index if not exists idx_universities_source on public.universities(source);
