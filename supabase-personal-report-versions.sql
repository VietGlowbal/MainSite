-- Turns the Personal Report from "one row per student, overwritten on every
-- regeneration" into an append-only version history, with a `trigger`
-- column recording WHY each version was created — student action or a
-- system event — for the version-history dropdown on the report page.
--
-- WHY A NEW TABLE INSTEAD OF ALTERING student_personal_reports.
--
-- `student_personal_reports.user_id` is the PRIMARY KEY (see
-- supabase-ai-strategy-reports.sql) — one row per student, upserted on
-- every regeneration, so every previous version was destroyed the moment a
-- new one was saved. Changing an existing table's primary key in place, on
-- a table that may already hold real production rows, is exactly the kind
-- of migration this repo avoids (see known-issues.md §0's "ALTER on a
-- table that already exists" trap) — a fresh, append-only table with the
-- same shape as `application_match_analyses` (which already stores every
-- Matching Report generation as its own row, ordered by `created_at`) is
-- the safer, precedented shape.
--
-- Reported live 2026-08-14: "the personal report now isn't generating at
-- all" — traced to the one-row model combined with a 24h free-tier
-- regeneration cooldown that was designed around a manual "regenerate"
-- button. Once achievements/reflections became editable again per new
-- application, students routinely changed their shared profile between
-- applications and kept hitting that cooldown wall on every later
-- application's confirm flow. The application-code fix (this same change)
-- removes the time-based cooldown entirely — regeneration is now driven by
-- the input actually changing (already checked before any AI call) plus
-- two concrete triggers: a new Matching Report being generated, and a
-- student answering one of the report's own follow-up questions.
CREATE TABLE IF NOT EXISTS public.student_personal_report_versions (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_v2                  JSONB NOT NULL,
  structured_evaluation      JSONB,
  evaluation_engine_version  TEXT,
  input_hash                 TEXT NOT NULL,
  prompt_version             TEXT,
  model_name                 TEXT NOT NULL,
  -- 'manual' (student clicked "Create report", or answered a report
  -- question), 'matching_report' (regenerated alongside a Matching Report),
  -- 'supplement_answer' (regenerated after a report-only answer was
  -- saved). Open string, not an enum: the report layer owns this set.
  trigger                    TEXT NOT NULL DEFAULT 'manual',
  generated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_personal_report_versions_user_created
  ON public.student_personal_report_versions(user_id, created_at DESC);

ALTER TABLE public.student_personal_report_versions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'student_personal_report_versions'
      AND policyname = 'student_personal_report_versions_select_own'
  ) THEN
    CREATE POLICY "student_personal_report_versions_select_own"
      ON public.student_personal_report_versions
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
  -- Append-only by design: no UPDATE/DELETE policy. A version, once
  -- written, is immutable history — matching what the dropdown promises.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'student_personal_report_versions'
      AND policyname = 'student_personal_report_versions_insert_own'
  ) THEN
    CREATE POLICY "student_personal_report_versions_insert_own"
      ON public.student_personal_report_versions
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- One-time backfill: carry each student's existing (single, latest)
-- report_v2 row over as their first version, so nobody's report history
-- appears to start empty just because this migration ran after they had
-- already generated one. Guarded by "this user has no version rows yet" so
-- re-running the migration never duplicates the backfilled row, even after
-- real new versions have since been created for that user.
INSERT INTO public.student_personal_report_versions
  (user_id, report_v2, structured_evaluation, evaluation_engine_version,
   input_hash, prompt_version, model_name, trigger, generated_at, created_at)
SELECT
  spr.user_id,
  spr.report_v2,
  spr.structured_evaluation,
  spr.evaluation_engine_version,
  spr.input_hash,
  spr.prompt_version,
  spr.model_name,
  'manual',
  COALESCE(spr.report_v2_generated_at, spr.updated_at),
  COALESCE(spr.report_v2_generated_at, spr.updated_at)
FROM public.student_personal_reports spr
WHERE spr.report_v2 IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.student_personal_report_versions v
    WHERE v.user_id = spr.user_id
  );

-- Verification (optional):
-- SELECT count(*) FROM public.student_personal_report_versions;
-- SELECT user_id, count(*) FROM public.student_personal_report_versions GROUP BY user_id ORDER BY count(*) DESC LIMIT 5;
