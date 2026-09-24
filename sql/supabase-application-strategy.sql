-- Application Strategy (Feature 2) — CV and Personal Statement workspace
-- Run this against your Supabase project before shipping /ai-strategy/[applicationId].
--
-- WHAT THIS ADDS. Six tables scoping the per-application document work: the
-- strategy row itself, the CV target profile, the structured CV, CV reviews,
-- the statement strategy, and statement analyses.
--
-- WHY A STRATEGY ROW AT ALL. Everything here hangs off one `application_id`,
-- and `course_applications` is already crowded. A join table gives the six
-- children one parent to cascade from, and gives the overview page one row to
-- read a status off without aggregating five others.
--
-- WHY SECTIONS ARE JSONB AND NOT ROWS. `structured_cvs.sections` is always
-- read and written whole — the editor holds the entire CV in state and PATCHes
-- it back, and the PDF renderer needs every section to lay out a page. Rows
-- would buy ordering we already get from array position, at the cost of a join
-- and a per-entry sort_order to keep consistent. Contrast student_achievements
-- in supabase-reflection.sql, which IS rows: those are queried across students
-- and own storage objects. These are not.
--
-- WHY REVIEWS AND ANALYSES ARE APPEND-ONLY. `cv_reviews` and
-- `statement_analyses` are never updated, only inserted, and the latest row
-- wins. It costs a few rows per student and it means "your CV changed since
-- this review" can name the exact version the review ran against instead of
-- guessing from a timestamp.
--
-- WHY VERSIONS AND NOT TIMESTAMPS. `content_version` / `version` are integers
-- bumped on real content change. Staleness is then an equality check. With
-- timestamps, an autosave that changed nothing would invalidate a good review,
-- and clock skew between the app and Postgres would make it non-deterministic.
--
-- WHY user_id IS ON ALL SIX TABLES. It is denormalised so each RLS policy is a
-- single-column check with no subquery, matching every other table in this
-- schema. Deriving it through application_strategies would put a subquery in
-- the hot path of every read.

-- ── application_strategies ────────────────────────────────────────────────
-- One per course application. The UNIQUE on application_id is what makes
-- "the strategy for this application" a lookup rather than a choice.
CREATE TABLE IF NOT EXISTS application_strategies (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id   UUID NOT NULL UNIQUE
                     REFERENCES course_applications(id) ON DELETE CASCADE,

  -- The four-value vocabulary the overview is allowed to display. Derived in
  -- src/features/application-strategy/domain/status.ts and written here so the
  -- applications list can show it without recomputing.
  status           TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN (
      'not_started',
      'in_progress',
      'needs_attention',   -- critical gaps, a stale analysis, or failed readiness
      'ready_for_audit'
    )),

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE application_strategies ENABLE ROW LEVEL SECURITY;

-- Postgres has no `CREATE POLICY IF NOT EXISTS`, so guard with a DO block.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'application_strategies'
      AND policyname = 'application_strategies_owner'
  ) THEN
    CREATE POLICY "application_strategies_owner" ON application_strategies
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_application_strategies_user
  ON application_strategies(user_id);
CREATE INDEX IF NOT EXISTS idx_application_strategies_application
  ON application_strategies(application_id);

-- ── cv_target_profiles ────────────────────────────────────────────────────
-- What the CV has to demonstrate for this university and course. Seven fields,
-- all nullable: the generator is required to leave a field empty rather than
-- invent a programme claim it has no source for, so NULL is a real state and
-- not a defect.
CREATE TABLE IF NOT EXISTS cv_target_profiles (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strategy_id            UUID NOT NULL UNIQUE
                           REFERENCES application_strategies(id) ON DELETE CASCADE,

  -- Định hướng nghề nghiệp — the one field that is the student's own, and the
  -- only one that is optional free text on the form.
  career_direction       TEXT,
  -- Định vị trường
  university_positioning TEXT,
  -- Triết lý giáo dục
  education_philosophy   TEXT,
  -- Môi trường
  environment            TEXT,
  -- Mục tiêu chương trình
  programme_objectives   TEXT,
  -- Năng lực ưu tiên
  priority_capabilities  TEXT,
  -- Career Alignment
  career_alignment       TEXT,

  -- Array of strings naming what the generator could not establish. Surfaced
  -- per card as a missing-information flag.
  missing_information    JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- StrategySource[]. Kept separate from the field values on purpose: a source
  -- URL inline in a field would end up in the PDF and in the AI context.
  sources_used           JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Bumped on every field change. cv_reviews records the value it ran against.
  version                INTEGER NOT NULL DEFAULT 1,
  -- NULL until the student has generated at least once. Distinguishes "never
  -- generated" from "generated and then cleared", which the empty state needs.
  generated_at           TIMESTAMPTZ,

  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE cv_target_profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'cv_target_profiles'
      AND policyname = 'cv_target_profiles_owner'
  ) THEN
    CREATE POLICY "cv_target_profiles_owner" ON cv_target_profiles
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cv_target_profiles_strategy
  ON cv_target_profiles(strategy_id);

-- ── structured_cvs ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS structured_cvs (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strategy_id            UUID NOT NULL UNIQUE
                           REFERENCES application_strategies(id) ON DELETE CASCADE,

  -- The uploaded_documents row this was imported from, when it was. NULL for a
  -- CV built from the profile or entered by hand. ON DELETE SET NULL: deleting
  -- the original upload must not delete the CV the student has since edited.
  source_document_id     UUID REFERENCES uploaded_documents(id) ON DELETE SET NULL,

  -- CvSection[] — see domain/cv-sections.ts. Ordered; array position IS the
  -- section order the student arranged.
  sections               JSONB NOT NULL DEFAULT '[]'::jsonb,

  selected_layout        TEXT
    CHECK (selected_layout IN ('academic', 'technical', 'leadership')),

  -- Bumped on every content change. The three columns below are the versions
  -- the review and the export were last run against; comparing them to this is
  -- the whole staleness mechanism.
  content_version        INTEGER NOT NULL DEFAULT 1,
  last_reviewed_version  INTEGER,
  last_exported_version  INTEGER,

  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE structured_cvs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'structured_cvs'
      AND policyname = 'structured_cvs_owner'
  ) THEN
    CREATE POLICY "structured_cvs_owner" ON structured_cvs
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_structured_cvs_strategy
  ON structured_cvs(strategy_id);

-- ── cv_reviews ────────────────────────────────────────────────────────────
-- Append-only. Latest row by created_at is the current review.
CREATE TABLE IF NOT EXISTS cv_reviews (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cv_id                  UUID NOT NULL REFERENCES structured_cvs(id) ON DELETE CASCADE,

  -- The two versions this review is an assessment OF. If either has moved on,
  -- the review is outdated and the page says so.
  target_profile_version INTEGER NOT NULL,
  content_version        INTEGER NOT NULL,

  -- CvStrength[]  — { title, evidence, targetProfileArea, programmeRelevance, strength }
  strengths              JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- CvMissingSignal[] — { signal, reason, action, targetSection }
  -- targetSection is constrained in the domain layer to a real CvSectionKind so
  -- "Open relevant section" always resolves to somewhere that exists.
  missing_signals        JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary                TEXT,
  sources_used           JSONB NOT NULL DEFAULT '[]'::jsonb,

  model                  TEXT,
  prompt_version         TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE cv_reviews ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'cv_reviews'
      AND policyname = 'cv_reviews_owner'
  ) THEN
    CREATE POLICY "cv_reviews_owner" ON cv_reviews
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- DESC on created_at because every read is "the latest one".
CREATE INDEX IF NOT EXISTS idx_cv_reviews_cv
  ON cv_reviews(cv_id, created_at DESC);

-- ── statement_strategies ──────────────────────────────────────────────────
-- The brief: what the personal statement has to accomplish. The statement TEXT
-- itself stays in `personal_statements`, which already owns it and which
-- StatementWriter already reads and writes.
CREATE TABLE IF NOT EXISTS statement_strategies (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strategy_id    UUID NOT NULL UNIQUE
                   REFERENCES application_strategies(id) ON DELETE CASCADE,

  -- The essay prompt as published by the programme, and its limit. Both
  -- nullable: plenty of courses state neither, and the editor has to cope with
  -- not knowing rather than inventing a 4000-character default.
  prompt         TEXT,
  word_limit     INTEGER,

  -- StatementBrief — grouped rows, not prose. See domain/types.ts.
  brief          JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_urls    JSONB NOT NULL DEFAULT '[]'::jsonb,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE statement_strategies ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'statement_strategies'
      AND policyname = 'statement_strategies_owner'
  ) THEN
    CREATE POLICY "statement_strategies_owner" ON statement_strategies
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_statement_strategies_strategy
  ON statement_strategies(strategy_id);

-- ── statement_analyses ────────────────────────────────────────────────────
-- Append-only, one row per analysis run, five sections per row.
--
-- WHY ONE ROW AND NOT FIVE. The five sections are produced by a single model
-- call against a single draft. Splitting them across rows would allow a state
-- where the AACC assessment and the readiness check disagree about which draft
-- they read, which is exactly the bug the content_version column exists to
-- prevent.
CREATE TABLE IF NOT EXISTS statement_analyses (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strategy_id          UUID NOT NULL
                         REFERENCES application_strategies(id) ON DELETE CASCADE,
  -- personal_statements.id is bigserial, not a UUID — see supabase-schema.sql.
  -- Nullable so an analysis survives the draft row being deleted; the strategy
  -- link is what the page actually reads by.
  statement_id         BIGINT REFERENCES personal_statements(id) ON DELETE SET NULL,

  -- The draft version this analysis read. This mirrors the existing
  -- `personal_statements.version` column rather than introducing a second
  -- counter — that column is already incremented by the writer on save, and two
  -- versions of the same fact is how they end up disagreeing.
  content_version      INTEGER NOT NULL,

  -- StatementOverview
  overview             JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- StatementFinding[] — each carries a verbatim quote so the highlight can be
  -- re-matched after the student edits around it.
  ideas_and_structure  JSONB NOT NULL DEFAULT '[]'::jsonb,
  opening              JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- AaccAssessment — four pillars. Deliberately has no overall-score field.
  aacc                 JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- StatementReadiness — the nine checks plus 'needs_attention'|'ready'.
  readiness            JSONB NOT NULL DEFAULT '{}'::jsonb,

  model                TEXT,
  prompt_version       TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE statement_analyses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'statement_analyses'
      AND policyname = 'statement_analyses_owner'
  ) THEN
    CREATE POLICY "statement_analyses_owner" ON statement_analyses
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_statement_analyses_strategy
  ON statement_analyses(strategy_id, created_at DESC);

-- ── updated_at maintenance ────────────────────────────────────────────────
-- The four mutable tables carry updated_at and the app writes it, but a trigger
-- means a direct SQL fix in the dashboard cannot leave it lying. The two
-- append-only tables have no updated_at and need no trigger.
CREATE OR REPLACE FUNCTION touch_application_strategy_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'application_strategies',
    'cv_target_profiles',
    'structured_cvs',
    'statement_strategies'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'trg_' || t || '_touch'
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE UPDATE ON %I
           FOR EACH ROW EXECUTE FUNCTION touch_application_strategy_updated_at()',
        'trg_' || t || '_touch', t
      );
    END IF;
  END LOOP;
END $$;

-- ── Column documentation ──────────────────────────────────────────────────
COMMENT ON TABLE application_strategies IS
  'Feature 2 root: one CV + statement workspace per course application.';

COMMENT ON COLUMN structured_cvs.content_version IS
  'Bumped on content change. cv_reviews.content_version and last_exported_version are compared against it to detect stale reviews and stale PDFs.';

COMMENT ON COLUMN structured_cvs.sections IS
  'CvSection[]. Array position is the section order the student arranged.';

COMMENT ON COLUMN cv_target_profiles.version IS
  'Bumped on any field change. cv_reviews.target_profile_version records the value a review assessed against.';

COMMENT ON COLUMN statement_analyses.aacc IS
  'AaccAssessment: Academic, Activities, Character, Contribution. Per-pillar scores describe how clearly the draft demonstrates each area. NOT an admission probability, and there is deliberately no overall score.';
