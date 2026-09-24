-- Final Application Check — the last surface in the Strategy journey.
--
-- Reviews the application as one package once the student has actually written
-- the documents: an overall readiness figure, a document-by-document review,
-- and a narrative consistency audit across everything.
--
-- WHY A NEW TABLE, AND WHY APPEND-ONLY.
--
-- Same shape as `application_match_analyses` and
-- `student_personal_report_versions`: one row per generation, ordered by
-- `created_at`, never updated in place. A student who reruns the check after
-- rewriting an essay should be able to see that the critical finding they
-- fixed is gone, which an upsert would destroy. It also keeps this migration
-- purely additive — see known-issues.md §0 for why altering an existing table
-- in place has repeatedly cost re-runs here.
--
-- WHY `readiness_percent` IS A COLUMN AND NOT PART OF THE JSON BLOB.
--
-- The figure is computed deterministically in
-- `src/features/apply/domain/final-check.ts` from component coverage minus
-- outstanding critical findings. Storing it as a real column keeps it
-- queryable and, more importantly, makes it obvious in the schema that it is
-- OUR number rather than something the model wrote. It is a completeness
-- measure, never a prediction of the admission outcome.
--
-- ON DELETE CASCADE is declared explicitly. known-issues.md §5r is an open
-- incident about per-application work surviving the deletion of its
-- application; a new per-application table must not add to it.
CREATE TABLE IF NOT EXISTS public.application_final_checks (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id     UUID NOT NULL REFERENCES public.course_applications(id) ON DELETE CASCADE,
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Deterministic, computed application-side. 0-100.
  readiness_percent  SMALLINT NOT NULL CHECK (readiness_percent BETWEEN 0 AND 100),
  -- Which components were present/reviewed at generation time, so a stored
  -- check can be re-read without recomputing against documents that have since
  -- changed underneath it.
  components         JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Model-authored: one entry per reviewed document.
  document_reviews   JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Model-authored: core narrative, pillars, consistency checks, balance.
  narrative_audit    JSONB,
  -- Disclosed limitations, e.g. "no letter of recommendation was attached".
  limitations        JSONB NOT NULL DEFAULT '[]'::jsonb,
  input_hash         TEXT NOT NULL,
  prompt_version     TEXT NOT NULL,
  model_name         TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_application_final_checks_application_created
  ON public.application_final_checks(application_id, created_at DESC);

ALTER TABLE public.application_final_checks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'application_final_checks'
      AND policyname = 'application_final_checks_select_own'
  ) THEN
    CREATE POLICY "application_final_checks_select_own"
      ON public.application_final_checks
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  -- Append-only by design: no UPDATE or DELETE policy. A stored check is a
  -- record of what the application looked like at a point in time.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'application_final_checks'
      AND policyname = 'application_final_checks_insert_own'
  ) THEN
    CREATE POLICY "application_final_checks_insert_own"
      ON public.application_final_checks
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
