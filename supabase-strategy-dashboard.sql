-- AI Strategy Dashboard — Applicant Analysis, AI Coach, and the extensions to
-- the existing match/recommendation/evidence tables that the Dashboard needs.
-- Run this against your Supabase project before shipping /ai-strategy/*/strategy.
--
-- See .kiro/specs/ai-strategy-dashboard/{requirements,design}.md for the full
-- spec. Phase 1 scope only: this migration adds tables and columns, it does
-- not add any AI call, page or route — those are later phases.
--
-- WHY EXTEND RATHER THAN FORK. `application_match_analyses` and
-- `application_recommendations` (supabase-apply-v2.sql) already carry most of
-- what the Dashboard needs — current/max score, per-pillar breakdown,
-- strengths/weaknesses, priority, action target, confidence. Forking a
-- parallel "strategy_match_analyses"/"strategy_recommendations" pair would
-- split one concept into two competing tables the moment a student has both
-- a course-workspace match score and a dashboard one. Extend in place.

-- ── applicant_analyses ──────────────────────────────────────────────────────
-- The candidate-portrait report (V2 Stage 3, Report 1). Append-only: each row
-- is one AI generation, and the latest by created_at is "the" analysis, same
-- pattern as cv_reviews/statement_analyses on the ai-application-strategy spec.
CREATE TABLE IF NOT EXISTS applicant_analyses (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id           UUID NOT NULL REFERENCES course_applications(id) ON DELETE CASCADE,
  user_id                  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- student_profiles version this analysis was generated against, so an
  -- edited Personal Summary can be detected as making the analysis stale
  -- without comparing timestamps.
  profile_version          INT NOT NULL,

  personality_summary      TEXT,
  learning_style            TEXT[],
  academic_strengths       TEXT[],
  growth_areas              TEXT[],
  motivation_analysis       TEXT,
  competitive_advantages   TEXT[],
  suggested_positioning     TEXT,
  -- 0-100, shown visually (not as a bare number) per requirements.md 6.1.
  overall_rating            INT CHECK (overall_rating BETWEEN 0 AND 100),

  -- Which input categories were actually available when this ran, mirroring
  -- match-insights' MatchInputsPresent shape.
  inputs_present            JSONB DEFAULT '{}'::JSONB,

  model_name                TEXT,
  prompt_version             TEXT,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE applicant_analyses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'applicant_analyses'
      AND policyname = 'applicant_analyses_owner'
  ) THEN
    CREATE POLICY "applicant_analyses_owner" ON applicant_analyses
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_applicant_analyses_application
  ON applicant_analyses(application_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_applicant_analyses_user
  ON applicant_analyses(user_id);

-- ── strategy_coach_threads / strategy_coach_messages ────────────────────────
-- AI Coach (V2 Stage 5). One thread per recommendation, not per application —
-- "How do I improve this?" is scoped to the recommendation the student opened
-- it from. Phase 1 ships only the schema; no route reads or writes these yet.
CREATE TABLE IF NOT EXISTS strategy_coach_threads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID NOT NULL REFERENCES application_recommendations(id) ON DELETE CASCADE,
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS strategy_coach_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id   UUID NOT NULL REFERENCES strategy_coach_threads(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE strategy_coach_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategy_coach_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'strategy_coach_threads'
      AND policyname = 'strategy_coach_threads_owner'
  ) THEN
    CREATE POLICY "strategy_coach_threads_owner" ON strategy_coach_threads
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'strategy_coach_messages'
      AND policyname = 'strategy_coach_messages_owner'
  ) THEN
    CREATE POLICY "strategy_coach_messages_owner" ON strategy_coach_messages
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_strategy_coach_threads_recommendation
  ON strategy_coach_threads(recommendation_id);
CREATE INDEX IF NOT EXISTS idx_strategy_coach_messages_thread
  ON strategy_coach_messages(thread_id, created_at);

-- ── application_recommendations: Progress Tracker + table shape ───────────
-- Adds the 5-value Progress_Status (requirements.md Requirement 13) and the
-- remaining per-recommendation fields the AI Recommendation Table needs
-- (Requirement 10.2) on top of the priority/action_*/confidence/is_dismissed
-- columns this table already has.
ALTER TABLE application_recommendations
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'in_progress', 'completed', 'needs_review', 'blocked')),
  ADD COLUMN IF NOT EXISTS estimated_effort   TEXT,
  ADD COLUMN IF NOT EXISTS deadline            DATE,
  ADD COLUMN IF NOT EXISTS evidence_required  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS category            TEXT,
  ADD COLUMN IF NOT EXISTS related_requirement TEXT;

CREATE INDEX IF NOT EXISTS idx_application_recommendations_status
  ON application_recommendations(status);
CREATE INDEX IF NOT EXISTS idx_application_recommendations_category
  ON application_recommendations(category);

-- ── uploaded_documents: Evidence Upload ────────────────────────────────────
-- Nullable — a document keeps working as a plain course-workspace upload when
-- this is null; it only becomes "evidence" when a student attaches it to a
-- specific recommendation from the recommendation detail page.
ALTER TABLE uploaded_documents
  ADD COLUMN IF NOT EXISTS recommendation_id UUID
    REFERENCES application_recommendations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_uploaded_documents_recommendation
  ON uploaded_documents(recommendation_id);

-- ── student_activities: add the Employment achievement category ──────────
-- requirements.md 4.1/4.4 — V2 lists Employment (internships, work
-- experience, part-time jobs) as its own Achievements category; the existing
-- taxonomy has no home for it (leadership/volunteering/projects don't fit).
-- Postgres names an unnamed column CHECK '<table>_<column>_check'; this drops
-- and re-adds it under that default name. If a prior migration renamed the
-- constraint, find its real name first with:
--   SELECT conname FROM pg_constraint WHERE conrelid = 'student_activities'::regclass AND contype = 'c';
ALTER TABLE student_activities
  DROP CONSTRAINT IF EXISTS student_activities_category_check;

ALTER TABLE student_activities
  ADD CONSTRAINT student_activities_category_check
  CHECK (category IN (
    'community_project',
    'leadership',
    'innovation',
    'personal_growth',
    'mentoring',
    'employment',           -- Internships, work experience, part-time jobs
    'other'
  ));
