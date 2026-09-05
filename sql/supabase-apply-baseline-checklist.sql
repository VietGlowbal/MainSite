-- ============================================================================
-- Baseline checklists: created_by = 'system', and a nullable course_url
-- ============================================================================
-- Both changes exist because applications are no longer created from a pasted
-- course URL. They are created from a saved university and the subject the
-- student chose, and most saved universities have no course page to parse:
-- 24 of 106 have a programme catalogue, and only 20 of those clear the
-- ingestion domain gate (measured 2026-08-01). Those applications get a
-- baseline checklist instead of an AI-extracted one.
--
-- A GUARDED FOLLOW-UP, NOT AN EDIT. supabase-apply-system.sql has already been
-- applied; per docs/known-issues.md §0 an applied migration is never edited,
-- because `ADD COLUMN IF NOT EXISTS` matches on name and not on type and can
-- therefore never repair a column that is already wrong. Idempotent, so it is
-- safe to re-run.
--
--   1. created_by gains 'system'
--      valid_created_by was CHECK (created_by IN ('ai', 'user')). A baseline
--      task is neither: the student did not write it, and no model produced it.
--      The distinction is load-bearing rather than cosmetic — writeChecklist()
--      replaces the AI's tasks when a parse lands, and it must not delete the
--      baseline tasks the student has already ticked off underneath it.
--
--   2. course_url loses NOT NULL
--      An application planned for a university with no catalogued programme has
--      no course page, and inventing one would put a link on the row that goes
--      somewhere wrong. The live database appears to have dropped this already
--      — PostgREST reports university_name and course_name as required and
--      course_url as not, though all three are NOT NULL in
--      supabase-apply-system.sql, and an insert omitting it raises the foreign
--      key error rather than 23502. That could not be confirmed by writing to
--      production, so this states the intent explicitly and is a no-op where it
--      already holds.
-- ============================================================================

-- 1. ------------------------------------------------------------------------
-- Drop first so the definition below is authoritative on re-run, matching the
-- pattern in supabase-apply-parse-state.sql.
ALTER TABLE public.application_tasks
  DROP CONSTRAINT IF EXISTS valid_created_by;

ALTER TABLE public.application_tasks
  ADD CONSTRAINT valid_created_by
  CHECK (created_by IN ('ai', 'user', 'system'));

COMMENT ON COLUMN public.application_tasks.created_by IS
  'Who put this task on the checklist: ai (extracted from the course page), '
  'system (the baseline every application starts with), or user.';

-- 2. ------------------------------------------------------------------------
ALTER TABLE public.course_applications
  ALTER COLUMN course_url DROP NOT NULL;

COMMENT ON COLUMN public.course_applications.course_url IS
  'The official course page, when one is known. Null for an application planned '
  'from a saved university whose programme is not in the catalogue — such a row '
  'carries the baseline checklist and no AI extraction.';
