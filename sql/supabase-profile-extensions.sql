-- Profile extensions
-- Run this against your Supabase project to support the profile sub-pages.

-- ── student_profiles new columns ──────────────────────────────────────────
ALTER TABLE student_profiles
  ADD COLUMN IF NOT EXISTS phone                  TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth          DATE,
  ADD COLUMN IF NOT EXISTS current_institution    TEXT,
  ADD COLUMN IF NOT EXISTS current_qualification  TEXT,
  ADD COLUMN IF NOT EXISTS predicted_grades       TEXT,
  ADD COLUMN IF NOT EXISTS graduation_year        INTEGER,
  ADD COLUMN IF NOT EXISTS preferred_cities       TEXT[],
  ADD COLUMN IF NOT EXISTS study_mode_preference  TEXT,
  ADD COLUMN IF NOT EXISTS target_intake          TEXT,
  ADD COLUMN IF NOT EXISTS application_cycle_year INTEGER;

-- ── work_experiences ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS work_experiences (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company          TEXT NOT NULL,
  role             TEXT NOT NULL,
  employment_type  TEXT,
  start_date       DATE,
  end_date         DATE,
  is_current       BOOLEAN NOT NULL DEFAULT FALSE,
  description      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE work_experiences ENABLE ROW LEVEL SECURITY;

-- Postgres has no `CREATE POLICY IF NOT EXISTS`, so guard with a DO block.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'work_experiences'
      AND policyname = 'work_experiences_owner'
  ) THEN
    CREATE POLICY "work_experiences_owner" ON work_experiences
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ── english_test_scores ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS english_test_scores (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  test_type        TEXT NOT NULL,
  overall_score    NUMERIC,
  listening_score  NUMERIC,
  reading_score    NUMERIC,
  writing_score    NUMERIC,
  speaking_score   NUMERIC,
  test_date        DATE,
  expiry_date      DATE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE english_test_scores ENABLE ROW LEVEL SECURITY;

-- Postgres has no `CREATE POLICY IF NOT EXISTS`, so guard with a DO block.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'english_test_scores'
      AND policyname = 'english_test_scores_owner'
  ) THEN
    CREATE POLICY "english_test_scores_owner" ON english_test_scores
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
