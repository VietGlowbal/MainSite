-- ============================================================================
-- GLOWBAL — Course Match Insights
-- ----------------------------------------------------------------------------
-- Extends the existing apply tables for the five-pillar match-insights feature:
--   • application_match_analyses gets a structured `pillars` breakdown,
--     an analysis `confidence`, and which `inputs_present` backed it.
--   • application_tasks gains an 'improvement' task_type plus `pillar` /
--     `estimated_uplift` so Plus "improvement" tasks can raise the match score.
-- Run once in the Supabase SQL editor; idempotent.
-- ============================================================================

-- ── 1. Match analyses: pillar breakdown + confidence ────────────────────────
alter table public.application_match_analyses
  add column if not exists pillars jsonb default '{}'::jsonb,
  add column if not exists confidence int,
  add column if not exists inputs_present jsonb default '{}'::jsonb;

-- ── 2. Tasks: pillar tagging + estimated uplift ─────────────────────────────
alter table public.application_tasks
  add column if not exists pillar text,
  add column if not exists estimated_uplift int;

-- ── 3. Allow the new 'improvement' task_type ────────────────────────────────
-- The original CHECK is an inline (system-named) constraint; find + drop it,
-- then re-add it with 'improvement' included.
do $$
declare
  cname text;
begin
  select con.conname into cname
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'application_tasks'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%task_type%';

  if cname is not null then
    execute format('alter table public.application_tasks drop constraint %I', cname);
  end if;

  alter table public.application_tasks
    add constraint application_tasks_task_type_check
    check (task_type in (
      'research',
      'eligibility',
      'document',
      'profile',
      'scholarship',
      'mentor',
      'external_link',
      'deadline',
      'submission',
      'general',
      'improvement'
    ));
end $$;

create index if not exists idx_application_tasks_pillar
  on public.application_tasks(application_id, pillar);
