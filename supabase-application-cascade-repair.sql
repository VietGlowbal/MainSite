-- Repairs ON DELETE CASCADE on every per-application table, and cleans up
-- rows that were orphaned before this repair ran.
--
-- Run this against your Supabase project to fix "deleting an application
-- leaves its reports/tasks/recommendations/CV+statement strategy work
-- behind" — reported live 2026-08-14.
--
-- WHY THIS EXISTS. `DELETE /api/applications/[id]` (src/app/api/applications/
-- [id]/route.ts) is deliberately a single `DELETE FROM course_applications`
-- with nothing else — its own doc comment says every child table is
-- `ON DELETE CASCADE`, and every one of this repo's `supabase-*.sql` files
-- DOES declare that, on every table that stores per-application data
-- (application_stages, application_tasks, application_requirements,
-- application_sources, application_match_analyses, application_recommendations,
-- application_events, applicant_analyses, application_strategy_recommendations,
-- application_strategies, application_lor_strategies, and the CV/statement/
-- coach tables that hang off application_strategies/application_recommendations
-- one level further down). On paper, deleting the parent row should already
-- take everything with it.
--
-- The likely reason it doesn't, in production, is the exact trap
-- `known-issues.md` §0 already cost the owner four re-runs over: `CREATE
-- TABLE IF NOT EXISTS` is a no-op against a table that already exists, and
-- editing a CREATE TABLE statement's `ON DELETE` clause after the table has
-- already been created does nothing to the live constraint — only running
-- the original CREATE gets you the original (possibly `NO ACTION`) delete
-- rule, forever, no matter how many times you re-run the now-corrected file.
-- If any of these tables were first created before their file's CASCADE
-- clause was written (or ever changed), the database is still enforcing
-- whatever rule it had on day one.
--
-- This migration does not guess which tables drifted or what their
-- constraint is currently named: for each (child table, FK column, parent
-- table) triple, it looks up the ACTUAL constraint by inspecting
-- information_schema, drops it, and adds an identical one with `ON DELETE
-- CASCADE` — a genuine no-op if the constraint was already correct, a real
-- repair if it was not. It only touches tables that exist in this
-- environment, so it is safe to run regardless of which optional migrations
-- have been applied. Before tightening each constraint it also deletes any
-- row already orphaned by the drift (a child row whose parent no longer
-- exists) — otherwise `ADD CONSTRAINT` would fail outright the moment any
-- past buggy delete has already left one behind, and leaving those rows in
-- place is the exact "keep our databases clean" complaint this migration
-- exists to fix.
--
-- Two tables are deliberately EXCLUDED — their `application_id` foreign key
-- is `ON DELETE SET NULL` by design, not a bug, and must stay that way:
--   - confirmed_candidate_snapshots (supabase-per-application-onboarding.sql)
--   - personal_statements (supabase-statement-application.sql)
-- A statement a student wrote, or a candidate-information confirmation they
-- made, stays theirs even once the application it was drafted for is gone.
--
-- Safe to run repeatedly.

CREATE OR REPLACE FUNCTION pg_temp.repair_application_cascade(
  child_table   TEXT,
  fk_column     TEXT,
  parent_table  TEXT,
  parent_column TEXT DEFAULT 'id'
) RETURNS VOID AS $$
DECLARE
  fk_name TEXT;
  orphaned_count INT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = child_table
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = parent_table
  ) THEN
    RETURN;
  END IF;

  -- Clean up rows already orphaned by the drift, so ADD CONSTRAINT below
  -- does not fail on a pre-existing violation.
  EXECUTE format(
    'DELETE FROM public.%I c WHERE c.%I IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.%I p WHERE p.%I = c.%I
     )',
    child_table, fk_column, parent_table, parent_column, fk_column
  );
  GET DIAGNOSTICS orphaned_count = ROW_COUNT;
  IF orphaned_count > 0 THEN
    RAISE NOTICE 'repair_application_cascade: deleted % orphaned row(s) from %.%',
      orphaned_count, child_table, fk_column;
  END IF;

  SELECT tc.constraint_name INTO fk_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
   AND tc.table_schema = ccu.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND tc.table_name = child_table
    AND kcu.column_name = fk_column
    AND ccu.table_name = parent_table
    AND ccu.column_name = parent_column
  LIMIT 1;

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', child_table, fk_name);
  ELSE
    fk_name := child_table || '_' || fk_column || '_fkey';
  END IF;

  EXECUTE format(
    'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.%I(%I) ON DELETE CASCADE',
    child_table, fk_name, fk_column, parent_table, parent_column
  );
END;
$$ LANGUAGE plpgsql;

-- ── Direct children of course_applications ──────────────────────────────
SELECT pg_temp.repair_application_cascade('application_stages', 'application_id', 'course_applications');
SELECT pg_temp.repair_application_cascade('application_tasks', 'application_id', 'course_applications');
SELECT pg_temp.repair_application_cascade('extracted_requirements', 'application_id', 'course_applications');
SELECT pg_temp.repair_application_cascade('support_resources', 'application_id', 'course_applications');
SELECT pg_temp.repair_application_cascade('application_requirements', 'application_id', 'course_applications');
SELECT pg_temp.repair_application_cascade('application_sources', 'application_id', 'course_applications');
SELECT pg_temp.repair_application_cascade('application_match_analyses', 'application_id', 'course_applications');
SELECT pg_temp.repair_application_cascade('application_recommendations', 'application_id', 'course_applications');
SELECT pg_temp.repair_application_cascade('application_events', 'application_id', 'course_applications');
SELECT pg_temp.repair_application_cascade('applicant_analyses', 'application_id', 'course_applications');
SELECT pg_temp.repair_application_cascade('application_strategy_recommendations', 'application_id', 'course_applications');
SELECT pg_temp.repair_application_cascade('application_strategies', 'application_id', 'course_applications');
SELECT pg_temp.repair_application_cascade('application_lor_strategies', 'application_id', 'course_applications');

-- ── One level further down: CV / statement / coach tables that hang off
--    application_strategies or application_recommendations, not directly
--    off course_applications — still deleted transitively once their own
--    parent's cascade is repaired above, but repaired explicitly here too
--    in case any one of THESE links independently drifted. ──────────────
SELECT pg_temp.repair_application_cascade('cv_target_profiles', 'strategy_id', 'application_strategies');
SELECT pg_temp.repair_application_cascade('structured_cvs', 'strategy_id', 'application_strategies');
SELECT pg_temp.repair_application_cascade('statement_strategies', 'strategy_id', 'application_strategies');
SELECT pg_temp.repair_application_cascade('statement_analyses', 'strategy_id', 'application_strategies');
SELECT pg_temp.repair_application_cascade('cv_reviews', 'cv_id', 'structured_cvs');
SELECT pg_temp.repair_application_cascade('strategy_coach_threads', 'recommendation_id', 'application_recommendations');
SELECT pg_temp.repair_application_cascade('strategy_coach_messages', 'thread_id', 'strategy_coach_threads');

DROP FUNCTION pg_temp.repair_application_cascade(TEXT, TEXT, TEXT, TEXT);
