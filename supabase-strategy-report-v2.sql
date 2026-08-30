-- Feature 2 / Part 4 — the historical F8 and current V3 Strategy payloads.
--
-- WHY A NEW FILE. Additive-only convention (known-issues.md §0).
--
-- WHAT THIS CARRIES.
--
-- report_v2 holds historical F8 and current Strategy V3 JSON documents. V3
-- contains exactly four top-level sections and is validated by
-- `strategyReportV3Schema` before it is ever written; historical F8 remains
-- validated by `strategyReportV2Schema`. Scores, classification
-- and evidence are NEVER authored inside it; those live in the Matching
-- Report inputs this report was synthesised from (see source_* columns).
--
-- The legacy F7-shaped columns keep their values for every row written by
-- prompt <= f8-v2 so the current UI and Planner reconciliation keep working.
-- New rows written by f8-v3 leave those columns NULL, which is why this file
-- also drops their NOT NULL constraints — additive and safe to re-run; old
-- rows are untouched.

ALTER TABLE public.application_strategy_recommendations
  ADD COLUMN IF NOT EXISTS report_v2 JSONB;

ALTER TABLE public.application_strategy_recommendations
  ALTER COLUMN direction_options DROP NOT NULL,
  ALTER COLUMN chosen_direction DROP NOT NULL,
  ALTER COLUMN chosen_direction_why DROP NOT NULL,
  ALTER COLUMN narrative DROP NOT NULL,
  ALTER COLUMN positioning_before DROP NOT NULL,
  ALTER COLUMN positioning_after DROP NOT NULL,
  ALTER COLUMN positioning_rationale DROP NOT NULL,
  ALTER COLUMN portfolio_evaluations DROP NOT NULL,
  ALTER COLUMN differentiation_insight DROP NOT NULL,
  ALTER COLUMN differentiation_proposal DROP NOT NULL,
  ALTER COLUMN roadmap DROP NOT NULL;

COMMENT ON COLUMN public.application_strategy_recommendations.report_v2 IS
  'Historical F8 or current Strategy V3 payload, Zod-validated at write time. Legacy F7 columns stay populated only for historical rows.';
