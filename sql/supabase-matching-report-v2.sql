-- Matching Report V2 migration
-- Additive columns on application_match_analyses for criterion-level matching.
-- Idempotent: safe to run multiple times.
-- No RLS policy changes — the table already has owner policies.

ALTER TABLE public.application_match_analyses
  ADD COLUMN IF NOT EXISTS report_v2 JSONB,
  ADD COLUMN IF NOT EXISTS report_contract_version TEXT,
  ADD COLUMN IF NOT EXISTS matching_engine_version TEXT,
  ADD COLUMN IF NOT EXISTS target_profile_version_id UUID
    REFERENCES public.programme_target_profile_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_analysis_version_id UUID
    REFERENCES public.application_profile_analysis_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS confirmed_snapshot_id UUID
    REFERENCES public.confirmed_candidate_snapshots(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.application_match_analyses.report_v2 IS
  'Full criterion-level matching report (matching-report-v2 contract). NULL for legacy rows.';
COMMENT ON COLUMN public.application_match_analyses.report_contract_version IS
  'Contract version of report_v2, e.g. matching-report-v2.';
COMMENT ON COLUMN public.application_match_analyses.matching_engine_version IS
  'Matching engine version that produced the report, e.g. matching-v2.0.0.';
COMMENT ON COLUMN public.application_match_analyses.target_profile_version_id IS
  'FK to the target profile version used for criterion normalization.';
COMMENT ON COLUMN public.application_match_analyses.source_analysis_version_id IS
  'FK to the application profile analysis version that produced the evidence bank.';
COMMENT ON COLUMN public.application_match_analyses.confirmed_snapshot_id IS
  'FK to the confirmed candidate snapshot the evidence bank was built from.';

-- Unique index for content-identity cache: same application + prompt bundle +
-- engine + input hash = same report. Only applies to V2 rows.
CREATE UNIQUE INDEX IF NOT EXISTS uq_match_analysis_v2_identity
  ON public.application_match_analyses(
    application_id,
    prompt_version,
    matching_engine_version,
    input_hash
  )
  WHERE report_v2 IS NOT NULL
    AND matching_engine_version IS NOT NULL
    AND input_hash IS NOT NULL;
