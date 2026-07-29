-- Academic intake — onboarding câu 6 and câu 7
-- Run this against your Supabase project before deploying the 9-step wizard.
--
-- ⚠️ SAFE AND NECESSARY TO RE-RUN if you applied an earlier copy of this file.
-- `curriculum` shipped as TEXT and is now TEXT[]; because `ADD COLUMN IF NOT
-- EXISTS` compares column NAMES and ignores types, re-running the version below
-- alone would skip it forever and leave the column TEXT. The repair block after
-- the ALTER TABLE converts it. Every statement in this file is idempotent.
--
-- Figma 375:11536 (câu 6) and 375:11616 (câu 7) on the "Khanh Linh - Chi"
-- canvas ask for academic data the 7-step wizard never collected. Three of the
-- four groups had nowhere to go:
--
--   curriculum + grading scale + GPA   -> no columns   -> added below
--   English test + score               -> english_test_scores (already exists)
--   standardized test + score          -> no table     -> created below
--
-- `current_qualification` and `predicted_grades` (supabase-profile-extensions)
-- are deliberately NOT reused. They are free text written by /profile/academic
-- ("e.g. A*AA, GPA 3.8, 38 IB points"), and the wizard needs the scale and the
-- number apart so a GPA can be compared against `universities.gpa_range`.
-- Overloading them would make both unparseable.

-- ── student_profiles: câu 6 ───────────────────────────────────────────────
ALTER TABLE student_profiles
  -- "Vietnamese National Curriculum" | "IB Diploma Programme (IBDP)" |
  -- "Cambridge International (IGCSE / AS & A Level)" |
  -- "AP + US High School Diploma" | "Others"
  --
  -- An ARRAY, because the frame draws checkboxes and a student can genuinely
  -- sit two curricula at once — Vietnamese National plus AP is a common pair.
  -- A single TEXT column would silently drop the second tick at save time.
  ADD COLUMN IF NOT EXISTS curriculum      TEXT[],
  -- The scale the GPA below is expressed on: "10-point scale" | "4.0 scale".
  -- Kept separate from the value because "3.8" means nothing without it, and
  -- the frame makes the student pick it explicitly.
  ADD COLUMN IF NOT EXISTS gpa_scale       TEXT,
  -- NUMERIC, not TEXT: this is the one academic field meant to be compared,
  -- and a 10-point GPA needs one decimal place.
  ADD COLUMN IF NOT EXISTS gpa_value       NUMERIC(4, 2);

-- ── Repair: curriculum TEXT -> TEXT[] ─────────────────────────────────────
-- REQUIRED for any project that ran an earlier copy of this file.
--
-- `curriculum` was declared TEXT in the first version of this migration and
-- changed to TEXT[] afterwards (a student can sit two curricula; a single
-- column silently dropped the second tick). Editing the line above was NOT
-- enough: `ADD COLUMN IF NOT EXISTS` matches on the column NAME only and never
-- looks at its type, so on a database that already has a TEXT `curriculum`
-- the statement above is skipped silently, however many times it is re-run.
--
-- That leaves the column TEXT while the wizard writes and reads a string[] —
-- `curriculum.join(' · ')` in onboarding-wizard.tsx then runs against a string.
--
-- Guarded by the catalog rather than by IF NOT EXISTS, so this is idempotent:
-- it converts a TEXT column once and is a no-op on a column already TEXT[].
-- Any existing single value is preserved as a one-element array.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'student_profiles'
      AND column_name  = 'curriculum'
      AND data_type <> 'ARRAY'
  ) THEN
    ALTER TABLE public.student_profiles
      ALTER COLUMN curriculum TYPE TEXT[]
      USING CASE
        WHEN curriculum IS NULL OR btrim(curriculum) = '' THEN NULL
        ELSE ARRAY[curriculum]
      END;
  END IF;
END $$;

-- ── standardized_test_scores: câu 7, lower half ───────────────────────────
-- Mirrors english_test_scores deliberately — same shape, same RLS, same
-- one-row-per-test model — so the two read the same way in application code.
-- Separate table rather than a `category` column on english_test_scores,
-- because "listening / reading / writing / speaking" are meaningless for SAT.
CREATE TABLE IF NOT EXISTS standardized_test_scores (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- "SAT" | "ACT" | "AP Exams" | "IB Diploma" | "A-Level" | "GCSE / IGCSE"
  test_type     TEXT NOT NULL,
  -- Free text, not NUMERIC: the frame's own placeholder is "7 / 10", and these
  -- tests do not share a scale — SAT is 1600, ACT is 36, A-Level is letters.
  score         TEXT,
  test_date     DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per test type per student; re-answering câu 7 updates rather than
-- accumulating duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS standardized_test_scores_user_test
  ON standardized_test_scores (user_id, test_type);

ALTER TABLE standardized_test_scores ENABLE ROW LEVEL SECURITY;

-- Postgres has no `CREATE POLICY IF NOT EXISTS`, so guard with a DO block.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'standardized_test_scores'
      AND policyname = 'standardized_test_scores_owner'
  ) THEN
    CREATE POLICY "standardized_test_scores_owner" ON standardized_test_scores
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ── english_test_scores: one row per test type ────────────────────────────
-- câu 7 upper half writes here. /profile/english already inserts freely, so
-- this index is added only if the data allows it — a project that already has
-- duplicate (user_id, test_type) pairs will fail this statement, which is the
-- correct outcome: dedupe first rather than losing a row silently.
CREATE UNIQUE INDEX IF NOT EXISTS english_test_scores_user_test
  ON english_test_scores (user_id, test_type);
