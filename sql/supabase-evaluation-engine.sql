-- ============================================================================
-- Shared Evaluation Engine (F1-F6) — schema support
-- ----------------------------------------------------------------------------
-- Purely additive. No column is dropped or renamed, so this can be run against
-- a live database and rolled back by ignoring the new column.
--
-- WHY THE COLUMN NAMES DO NOT MATCH THE NEW DOMAIN NAMES
--
-- The engine calls these sections coreIdentity / drivingForce /
-- signaturePattern / personalPositioning. The columns are still
-- personality_summary / motivation_analysis / competitive_advantages /
-- suggested_positioning, because rows written before the engine existed carry
-- real analyses for real students. Renaming would either strand those rows or
-- require a rewrite migration for a cosmetic gain. The mapping happens once, in
-- `narrativeFromRow`.
--
-- Run this in the Supabase SQL editor. Safe to run more than once.
-- ============================================================================

-- ── F1: Emerging Themes ─────────────────────────────────────────────────────
-- The one portrait section with nothing behind it. Five of the six mapped onto
-- existing columns; this did not exist in any form, and was added rather than
-- faked from `growth_areas` — growth areas are what is MISSING, themes are the
-- patterns that recur across what is already there. See
-- domain/evaluation/reflection.ts.
ALTER TABLE applicant_analyses
  ADD COLUMN IF NOT EXISTS emerging_themes TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN applicant_analyses.emerging_themes IS
  'F1 CMCAITF Reflection: patterns recurring across the student record. Empty '
  'when nothing recurs across at least two separate items — the prompt is told '
  'not to manufacture a theme from a single data point.';

-- ── Verification ────────────────────────────────────────────────────────────
-- Expect one row, emerging_themes, ARRAY, NO, '{}'::text[]
--
--   SELECT column_name, data_type, is_nullable, column_default
--     FROM information_schema.columns
--    WHERE table_name = 'applicant_analyses'
--      AND column_name = 'emerging_themes';
