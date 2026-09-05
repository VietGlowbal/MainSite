-- GLOWBAL — Personal Report + Programme Fit Report
-- Apply manually in Supabase SQL Editor before deploying the report routes.
-- Idempotent and intentionally separate from older migrations.

CREATE TABLE IF NOT EXISTS public.student_personal_reports (
  user_id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  report         JSONB NOT NULL,
  input_hash     TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  model_name     TEXT NOT NULL,
  generated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.student_personal_reports ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'student_personal_reports'
      AND policyname = 'student_personal_reports_owner'
  ) THEN
    CREATE POLICY "student_personal_reports_owner"
      ON public.student_personal_reports
      FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

ALTER TABLE public.application_match_analyses
  ADD COLUMN IF NOT EXISTS input_hash TEXT,
  ADD COLUMN IF NOT EXISTS fit_dimensions JSONB,
  ADD COLUMN IF NOT EXISTS fit_eligibility JSONB,
  ADD COLUMN IF NOT EXISTS fit_classification TEXT,
  ADD COLUMN IF NOT EXISTS fit_confidence INT,
  ADD COLUMN IF NOT EXISTS fit_limitations JSONB DEFAULT '[]'::JSONB;

CREATE INDEX IF NOT EXISTS idx_match_analysis_cache_v2
  ON public.application_match_analyses
  (application_id, prompt_version, input_hash, created_at DESC);

COMMENT ON TABLE public.student_personal_reports IS
  'Latest-only evidence-bound Applicant Portrait for each student.';
COMMENT ON COLUMN public.application_match_analyses.fit_dimensions IS
  'F5 Programme Fit dimensions; separate from the legacy document-match pillars.';
