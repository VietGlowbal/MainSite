-- Reflection — structured achievements and activities
-- Run this against your Supabase project before shipping /ai-strategy/reflection.
--
-- WHY NEW TABLES. `student_profiles.achievements` is a JSON array of
-- { id, title, description, year }. The reflection form asks for considerably
-- more per achievement — the category, the awarding or organising body, the
-- level it was won at, and a file standing as evidence — and it asks for
-- non-academic activities, which have no home at all today.
--
-- Modelling those as rows rather than widening the JSON blob buys three things
-- the candidate portrait depends on: a file per achievement (a JSON column
-- cannot own a storage object), ordering the student controls, and the ability
-- to query "which students have a national-level award" without unnesting.
--
-- The existing `achievements` column is deliberately left in place. The profile
-- page still reads and writes it, and nothing here is worth breaking that for;
-- a later pass can migrate and drop it once /profile/achievements moves over.

-- ── student_achievements ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS student_achievements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Taxonomy from the reflection form's "Loại thành tích học thuật" dropdown.
  -- TEXT with a CHECK rather than an enum type: adding a category later is then
  -- one ALTER rather than a type migration, and the set is still enforced.
  category       TEXT NOT NULL
    CHECK (category IN (
      'academic_award',      -- Giải thưởng học thuật
      'research',            -- Nghiên cứu & xuất bản
      'certification',       -- Chứng chỉ
      'mentoring',           -- Mentor / giảng dạy
      'other'
    )),

  title          TEXT NOT NULL,
  -- The competition or programme it was won through.
  competition    TEXT,
  -- Who awarded or ran it.
  organisation   TEXT,
  -- 'school' | 'district' | 'provincial' | 'national' | 'international'.
  -- Free text on purpose: award levels do not generalise across countries, and
  -- a constraint here would reject a legitimate Vietnamese classification.
  level          TEXT,
  -- Year only. Students rarely remember the day, and an incomplete DATE would
  -- have to be faked to a January the 1st that then displays as fact.
  year           INTEGER,
  detail         TEXT,

  -- Evidence lives in Supabase Storage; this is the object key, matching how
  -- uploaded_documents already references it.
  evidence_key   TEXT,

  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE student_achievements ENABLE ROW LEVEL SECURITY;

-- Postgres has no `CREATE POLICY IF NOT EXISTS`, so guard with a DO block.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'student_achievements'
      AND policyname = 'student_achievements_owner'
  ) THEN
    CREATE POLICY "student_achievements_owner" ON student_achievements
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_student_achievements_user
  ON student_achievements(user_id, sort_order);

-- ── student_activities ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS student_activities (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Taxonomy from the form's "Hoạt động phi học thuật" checklist.
  category       TEXT NOT NULL
    CHECK (category IN (
      'community_project',   -- Volunteering, community service, social impact
      'leadership',          -- Club leadership, student council, event organiser
      'innovation',          -- Passion projects, startups, engineering, research
      'personal_growth',     -- Competitions, certifications, online programmes
      'other'
    )),

  title          TEXT NOT NULL,
  -- Club, project or programme the activity sat under.
  organisation   TEXT,
  level          TEXT,
  -- Free text ("2024–2026", "Summer 2025"). Students describe these as spans,
  -- and forcing two DATEs would mean inventing precision they did not give.
  period         TEXT,
  description    TEXT,

  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE student_activities ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'student_activities'
      AND policyname = 'student_activities_owner'
  ) THEN
    CREATE POLICY "student_activities_owner" ON student_activities
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_student_activities_user
  ON student_activities(user_id, sort_order);

-- ── student_profiles: the two fields reflection asks for and has nowhere
--    to put ─────────────────────────────────────────────────────────────────
-- Everything else on the form already has a column: nationality, study_level,
-- target_subjects, preferred_countries, budget_range, predicted_grades,
-- current_qualification. Reflection reads and writes those in place rather
-- than duplicating them, so a student who updates their IELTS on
-- /profile/english does not get a stale match report.
ALTER TABLE student_profiles
  -- "Personal savings or parents", "Scholarship", "Loan", ... The form asks
  -- how study will be funded, separately from how much.
  ADD COLUMN IF NOT EXISTS funding_source TEXT,
  -- Tuition budget in USD, as a band ("20000-30000"). Distinct from
  -- budget_range, which the onboarding wizard writes in VND.
  ADD COLUMN IF NOT EXISTS tuition_budget_usd TEXT;

COMMENT ON COLUMN student_profiles.funding_source IS
  'How the student expects to fund study. Set by /ai-strategy/reflection.';

COMMENT ON COLUMN student_profiles.tuition_budget_usd IS
  'Annual tuition budget band in USD. budget_range holds the VND total from onboarding.';
