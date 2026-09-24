-- AI Strategy Dashboard — F7 Strategic Recommendation Framework
-- ("Personalized Strategy" report). Run after supabase-ai-strategy-reports.sql
-- (its two inputs, applicant_analyses and application_match_analyses's
-- fit_* columns, must already exist).
--
-- WHY A SEPARATE FILE. Same reasoning as every other migration in this repo:
-- earlier ones may already be applied against a live database, and editing
-- one after the fact makes "what ran, when" untraceable — see
-- docs/known-issues.md §0.
--
-- WHAT THIS IS. A one-time, per-application synthesis over the Personal
-- Report (applicant_analyses' NarrativeProfile — coreIdentity/drivingForce/
-- signaturePattern/emergingThemes) and the Matching Report
-- (application_match_analyses' fit_dimensions/fit_classification): F7.1
-- Strategic Direction Selection, F7.2 Narrative Strategy, F7.3 Positioning
-- Strategy, F7.4 Portfolio Strategy, F7.5 Differentiation Strategy, F7.6
-- Execution Roadmap. Explicitly NOT the Planner — this is a read-only report
-- ("what should I become and why"), not a task tracker ("am I doing it").
--
-- Append-only, same convention as applicant_analyses/application_match_analyses:
-- each row is one generation, and the latest by created_at is "the" report.

CREATE TABLE IF NOT EXISTS application_strategy_recommendations (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id            UUID NOT NULL REFERENCES course_applications(id) ON DELETE CASCADE,
  user_id                   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Which Personal Report / Matching Report this was synthesised from, so a
  -- later regeneration can tell whether its inputs are still current.
  source_analysis_id        UUID REFERENCES applicant_analyses(id) ON DELETE SET NULL,
  source_match_analysis_id  UUID REFERENCES application_match_analyses(id) ON DELETE SET NULL,

  -- F7.1: candidate directions, each scored on 6 dimensions 0-10, plus which
  -- one was chosen and why. See strategyRecommendationSchema in
  -- src/features/ai-strategy-dashboard/domain/evaluation/strategy-recommendation.ts
  -- for the exact shape.
  direction_options         JSONB NOT NULL,
  chosen_direction          TEXT NOT NULL,
  chosen_direction_why      TEXT NOT NULL,

  -- F7.2
  narrative                 TEXT NOT NULL,

  -- F7.3
  positioning_before        TEXT NOT NULL,
  positioning_after         TEXT NOT NULL,
  positioning_rationale     TEXT NOT NULL,

  -- F7.4: real saved activities AND AI-proposed hypothetical opportunities,
  -- each scored highly_recommended / recommended / low_priority.
  portfolio_evaluations     JSONB NOT NULL,

  -- F7.5
  differentiation_insight   TEXT NOT NULL,
  differentiation_proposal  TEXT NOT NULL,

  -- F7.6: { chosenStrategy, why, prioritize[], avoid[], expectedPositioning, longTermNarrative }
  roadmap                   JSONB NOT NULL,

  -- Set once the report has been exported — mirrors cv_export_path's
  -- convention (src/lib/cv-pdf), a Storage path rather than the file itself.
  pdf_storage_path          TEXT,

  model_name                TEXT,
  prompt_version            TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE application_strategy_recommendations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'application_strategy_recommendations'
      AND policyname = 'application_strategy_recommendations_owner'
  ) THEN
    CREATE POLICY "application_strategy_recommendations_owner"
      ON application_strategy_recommendations
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_application_strategy_recommendations_application
  ON application_strategy_recommendations(application_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_application_strategy_recommendations_user
  ON application_strategy_recommendations(user_id);

COMMENT ON TABLE application_strategy_recommendations IS
  'F7 Strategic Recommendation Framework — the Personalized Strategy report. One row per generation, latest wins.';
