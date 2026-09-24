-- Feature 2 / Part 3 — AI-authored semantic narrative for the Matching Report.
--
-- WHY A NEW FILE. Additive-only follow-up convention (known-issues.md §0):
-- editing supabase-apply-v2.sql or supabase-ai-strategy-reports.sql after they
-- have run makes "what ran, when" untraceable.
--
-- WHAT THIS CARRIES. The six canonical Matching Report sections need more than
-- the deterministic F5 numbers already persisted in fit_* columns: a fit
-- statement, top alignments, critical-gap analysis, hidden risks, an
-- admissions perspective and a final recommendation. The AI may synthesise
-- this narrative, but never the scores — those stay in fit_dimensions /
-- fit_classification and are re-derived deterministically. The whole object is
-- optional: a report generated before this migration (or one whose narrative
-- failed Zod validation at write time) simply renders its deterministic
-- sections only.

ALTER TABLE public.application_match_analyses
  ADD COLUMN IF NOT EXISTS match_report_narrative JSONB;

COMMENT ON COLUMN public.application_match_analyses.match_report_narrative IS
  'Optional AI-synthesised narrative for the six canonical Matching Report sections (fit statement, alignments, gaps, risks, admissions perspective, recommendation). Scores/classification are NEVER read from here — they live in fit_* columns.';
