-- Feature 2 / report-flow integrity: Personal Report ancestry and F5 engine
-- identity for each Matching Report version.
--
-- Additive follow-up only. Apply `supabase-personal-report-versions.sql`
-- first so the typed Personal Report FK target exists.

ALTER TABLE public.application_match_analyses
  ADD COLUMN IF NOT EXISTS source_personal_report_version_id UUID
    REFERENCES public.student_personal_report_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_personal_report_input_hash TEXT,
  ADD COLUMN IF NOT EXISTS f5_engine_version TEXT;

CREATE INDEX IF NOT EXISTS idx_match_analyses_current_report_version
  ON public.application_match_analyses(application_id, prompt_version, f5_engine_version, created_at DESC);

COMMENT ON COLUMN public.application_match_analyses.source_personal_report_version_id IS
  'Canonical Personal Report V2 version completed before this Matching Report was generated.';
COMMENT ON COLUMN public.application_match_analyses.source_personal_report_input_hash IS
  'Content identity of the Personal Report V2 version used by this Matching Report, retained for audit and cache identity.';
COMMENT ON COLUMN public.application_match_analyses.f5_engine_version IS
  'Deterministic F5 evaluation engine version used to calculate persisted fit results.';
