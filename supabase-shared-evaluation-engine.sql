-- ============================================================================
-- GlowBal Shared Evaluation Engine / Personal Report V2 — schema support
-- ----------------------------------------------------------------------------
-- Safe forward migration for the canonical USER-LEVEL Personal Report.
-- No table/column is dropped or renamed. Existing V1 payloads remain readable.
-- Run before deploying code that selects report_v2 / structured_evaluation.
-- ============================================================================

-- One structured F1-F4/F6 profile evaluation per user, stored beside the
-- existing user-level Personal Report row. Programme Fit (F5) is application-
-- level and will continue to live with application match analysis, not here.
ALTER TABLE public.student_personal_reports
  ADD COLUMN IF NOT EXISTS structured_evaluation JSONB,
  ADD COLUMN IF NOT EXISTS evaluation_engine_version TEXT,
  ADD COLUMN IF NOT EXISTS report_v2 JSONB,
  ADD COLUMN IF NOT EXISTS report_v2_generated_at TIMESTAMPTZ;

-- The original V1 schema required a V1 `report` blob and prompt version on
-- every row. V2 writes `report_v2` instead, so `report` must be nullable.
-- `prompt_version` is still written by V2 (it now versions semantic extraction
-- / grounding), but relaxing the old V1 NOT NULL constraint keeps historical
-- / partially migrated rows safe and makes rollback straightforward.
ALTER TABLE public.student_personal_reports
  ALTER COLUMN report DROP NOT NULL,
  ALTER COLUMN prompt_version DROP NOT NULL;

COMMENT ON COLUMN public.student_personal_reports.structured_evaluation IS
  'Canonical user-level ProfileEvaluation: structured F6/F1/F2/F3/F4 findings, evidence refs, confidence and limitations. Programme-specific F5 does not belong here.';

COMMENT ON COLUMN public.student_personal_reports.evaluation_engine_version IS
  'Version of deterministic framework/scoring logic. Independent of prompt_version, which versions semantic extraction/grounding.';

COMMENT ON COLUMN public.student_personal_reports.report_v2 IS
  'PersonalReportV2: six canonical sections rendered from structured_evaluation (Core Identity, Driving Force, Signature Pattern, Emerging Themes, Personal Positioning, Proof of Me).';

COMMENT ON COLUMN public.student_personal_reports.report_v2_generated_at IS
  'Timestamp at which report_v2 was rendered from the canonical structured evaluation.';

COMMENT ON COLUMN public.student_personal_reports.prompt_version IS
  'For Personal Report V2, versions the semantic extraction/grounding contract. A change invalidates cached output even when deterministic engine_version is unchanged.';

-- Verification (optional):
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'student_personal_reports'
--   AND column_name IN (
--     'structured_evaluation',
--     'evaluation_engine_version',
--     'report_v2',
--     'report_v2_generated_at',
--     'prompt_version'
--   );
