-- Feature 2 / Part 2 — semantically-correct source lineage and idempotency
-- for application_strategy_recommendations.
--
-- WHY A NEW FILE. Same reasoning as every other migration in this repo:
-- editing supabase-strategy-recommendation-report.sql after it has run makes
-- "what ran, when" untraceable, and ADD COLUMN IF NOT EXISTS matches names,
-- not types — a follow-up file is the only safe shape (known-issues.md §0).
--
-- WHAT THIS FIXES. The Strategy generator now consumes the canonical
-- user-level Personal Report V2 (student_personal_report_versions) instead of
-- the legacy applicant_analyses blob. The table's only personal-report
-- lineage column, source_analysis_id, still carries its original FK to
-- applicant_analyses(id), so writing a personal-report-version id into it
-- fails with 23503 on every fresh generation — the route's only escape was to
-- null the column, which silently destroyed lineage AND made every later
-- request look like an unchanged-input cache hit. Rather than overloading one
-- column across two unrelated tables (the exact trap the Feature 2 plan
-- forbids), lineage gets its own correctly typed column:
--
--   source_personal_report_version_id → student_personal_report_versions(id)
--   source_analysis_id                → unchanged; keeps its legacy
--                                       applicant_analyses meaning for rows
--                                       written before the F8 migration.
--
-- input_hash gives the cache check one content-derived identity covering ALL
-- canonical inputs (personal report version + match analysis + programme
-- facts + achievements/activities snapshot + engine/prompt versions), so
-- "identical completed version exists" is provable instead of inferred from
-- two source ids.

ALTER TABLE public.application_strategy_recommendations
  ADD COLUMN IF NOT EXISTS input_hash TEXT,
  ADD COLUMN IF NOT EXISTS source_personal_report_version_id UUID
    REFERENCES public.student_personal_report_versions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_strategy_recommendations_input_hash
  ON public.application_strategy_recommendations(application_id, input_hash);

COMMENT ON COLUMN public.application_strategy_recommendations.input_hash IS
  'Stable hash of all canonical generation inputs (personal report version, match analysis, programme facts, achievements/activities, model+prompt versions). Equal hash = identical inputs = cached report is current.';
COMMENT ON COLUMN public.application_strategy_recommendations.source_personal_report_version_id IS
  'Canonical Personal Report V2 version this strategy was synthesised from. source_analysis_id keeps its legacy applicant_analyses meaning and must not be reused for this.';
