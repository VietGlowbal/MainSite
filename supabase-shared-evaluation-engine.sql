-- ============================================================================
-- GlowBal Shared Evaluation Engine (F1-F6) — schema support
-- ----------------------------------------------------------------------------
-- Purely additive. No column is dropped, renamed, or made non-nullable, so
-- this can be run against a live database and rolled back by ignoring the new
-- columns. Run in the Supabase SQL editor; safe to run more than once.
--
-- WHY EXTEND THE EXISTING REPORT TABLES RATHER THAN A NEW PARALLEL TABLE
--
-- `student_personal_reports` (supabase-ai-strategy-reports.sql) already
-- stores the Personal Report's narrative output plus input_hash,
-- prompt_version and generated_at/updated_at — exactly the idempotent-
-- regeneration shape core principle 10 and the task's storage requirement
-- ask for. `applicant_analyses` (supabase-strategy-dashboard.sql,
-- supabase-evaluation-engine.sql) is the same shape for the per-application
-- narrative that will back the Matching/Strategy Report. Both tables get one
-- new column each: the STRUCTURED result of a `ProfileEvaluation` run
-- (src/shared/evaluation), stored as JSONB alongside the existing prose
-- report/narrative — not instead of it. A second, parallel
-- "profile_evaluations" table would immediately raise the question of which
-- of two rows is authoritative for the same student at the same moment; one
-- table, one additional column, has no such question.
--
-- `evaluation_engine_version` is deliberately separate from the existing
-- `prompt_version` columns: prompt_version already exists on both tables and
-- versions the AI CALL text, but the deterministic scoring code in
-- src/shared/evaluation changes independently of any prompt (a formula fix
-- needs no new prompt) — so it needs its own version stamp to answer "was
-- this row scored with the current formulas" without conflating the two.
-- ============================================================================

-- ── student_personal_reports: the structured F1-F6 result behind the report ─
ALTER TABLE public.student_personal_reports
  ADD COLUMN IF NOT EXISTS structured_evaluation JSONB,
  ADD COLUMN IF NOT EXISTS evaluation_engine_version TEXT;

COMMENT ON COLUMN public.student_personal_reports.structured_evaluation IS
  'The ProfileEvaluation object (src/shared/evaluation) this report was built '
  'from — F1/F2/F3/F4 scores, insights and their evidenceRefs/confidence/'
  'limitations. The prose report is a rendering of this, not a separate source '
  'of truth.';
COMMENT ON COLUMN public.student_personal_reports.evaluation_engine_version IS
  'Version stamp for the deterministic scoring code in src/shared/evaluation, '
  'independent of prompt_version — a formula change bumps this without '
  'requiring a new prompt.';

-- ── applicant_analyses: the same structured result, per application ────────
-- Backs the future Matching Report / Strategy Report consumers of the
-- engine's F1-F4 output for a specific application, alongside the existing
-- per-application narrative columns.
ALTER TABLE public.applicant_analyses
  ADD COLUMN IF NOT EXISTS structured_evaluation JSONB,
  ADD COLUMN IF NOT EXISTS evaluation_engine_version TEXT,
  ADD COLUMN IF NOT EXISTS input_hash TEXT;

COMMENT ON COLUMN public.applicant_analyses.structured_evaluation IS
  'The ProfileEvaluation object (src/shared/evaluation) this analysis was '
  'built from. See student_personal_reports.structured_evaluation for the '
  'same shape at the user level.';
COMMENT ON COLUMN public.applicant_analyses.input_hash IS
  'Hash of the candidate context this row was generated from — mirrors '
  'student_personal_reports.input_hash, and is what makes regeneration '
  'idempotent: a caller can skip generation entirely when the hash and '
  'evaluation_engine_version both match the latest stored row.';

CREATE INDEX IF NOT EXISTS idx_applicant_analyses_input_hash
  ON public.applicant_analyses(application_id, input_hash, evaluation_engine_version);

-- ── Verification ────────────────────────────────────────────────────────────
--   SELECT column_name, data_type FROM information_schema.columns
--    WHERE table_name = 'student_personal_reports'
--      AND column_name IN ('structured_evaluation', 'evaluation_engine_version');
--
--   SELECT column_name, data_type FROM information_schema.columns
--    WHERE table_name = 'applicant_analyses'
--      AND column_name IN ('structured_evaluation', 'evaluation_engine_version', 'input_hash');
