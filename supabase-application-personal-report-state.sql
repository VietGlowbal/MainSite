-- Application-scoped Personal Report state and lineage.
--
-- Run this against your Supabase project before deploying any code that
-- generates or reads application-scoped Personal Reports (the orchestrator
-- degrades to a 503 until this file has run).
--
-- WHY THIS FILE EXISTS. Personal Report ownership moves from user-level
-- ("the report about me") to APPLICATION-level ("the report built from THIS
-- application's confirmed candidate snapshot"). Every report version must be
-- able to name the exact snapshot and analysis it was derived from, so a
-- report generated for application A can never silently change because the
-- shared draft data was later edited for application B. See
-- docs/plans/2026-08-26-application-personal-report-backend.md.
--
-- WHAT IS EXTENDED VS CREATED.
--
-- `student_personal_report_versions` is EXTENDED in place (never replaced):
-- it keeps its existing foreign keys and every existing row. Existing rows
-- keep `application_id IS NULL` forever — they are legacy archive records,
-- readable through the old global readers, never assigned to an application.
--
-- The five new tables below are APPEND-ONLY like their siblings: SELECT/INSERT
-- owner policies only, no UPDATE/DELETE policy anywhere.

-- ── student_personal_report_versions: application + derivation lineage ─────
ALTER TABLE public.student_personal_report_versions
  ADD COLUMN IF NOT EXISTS application_id UUID
    REFERENCES public.course_applications(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS confirmed_snapshot_id UUID
    REFERENCES public.confirmed_candidate_snapshots(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_analysis_version_id UUID,
  -- Which shape of the report contract this row was written against (e.g.
  -- 'v2' pre-application, 'v3' once summary/growthAreas/evidenceCoverage land).
  ADD COLUMN IF NOT EXISTS report_contract_version TEXT,
  -- Deterministic identity of (snapshot × contracts × inputs). Two requests
  -- computing the same key mean "same report"; backed by the partial unique
  -- index below so concurrent non-force generations cannot double-insert.
  ADD COLUMN IF NOT EXISTS cache_key TEXT;

CREATE INDEX IF NOT EXISTS idx_personal_report_versions_application_created
  ON public.student_personal_report_versions(application_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_personal_report_application_cache_key
  ON public.student_personal_report_versions(application_id, cache_key)
  WHERE application_id IS NOT NULL AND cache_key IS NOT NULL;

COMMENT ON COLUMN public.student_personal_report_versions.application_id IS
  'NULL on legacy archive rows written before reports became application-scoped. Never backfilled.';
COMMENT ON COLUMN public.student_personal_report_versions.confirmed_snapshot_id IS
  'The exact confirmed_candidate_snapshots row this report was derived from.';
COMMENT ON COLUMN public.student_personal_report_versions.source_analysis_version_id IS
  'The application_profile_analysis_versions row whose outputs fed this report.';
COMMENT ON COLUMN public.student_personal_report_versions.cache_key IS
  'Hash of (snapshot, contracts, inputs, module versions). Same key ⇒ same report row.';

-- ── confirmed_candidate_snapshots: revision chain + integrity hash ─────────
ALTER TABLE public.confirmed_candidate_snapshots
  ADD COLUMN IF NOT EXISTS payload_hash TEXT,
  ADD COLUMN IF NOT EXISTS supersedes_snapshot_id UUID
    REFERENCES public.confirmed_candidate_snapshots(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_candidate_snapshots_application_confirmed
  ON public.confirmed_candidate_snapshots(application_id, confirmed_at DESC);

COMMENT ON COLUMN public.confirmed_candidate_snapshots.payload_hash IS
  'SHA-256 of the canonical serialized snapshot payload; equal hashes prove two snapshots carried identical content.';
COMMENT ON COLUMN public.confirmed_candidate_snapshots.supersedes_snapshot_id IS
  'Set when a reopened application re-confirms: points at the previous snapshot for the SAME application.';

-- ── programme_target_profile_versions ───────────────────────────────────────
-- Reusable PROGRAMME-level Target Profile extracted from already-ingested
-- catalogue data (catalog_programmes view over courses, plus admission/
-- requirement tables). Append-only: a changed source fingerprint produces a
-- NEW row; cache hits read the newest row whose fingerprint still matches.
CREATE TABLE IF NOT EXISTS public.programme_target_profile_versions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- catalog_programmes is a VIEW over courses; programme_id == courses.id.
  programme_id      UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  scholarship_key   TEXT,
  -- Fingerprint of the ingested source rows the profile was extracted from.
  source_fingerprint TEXT NOT NULL,
  profile           JSONB NOT NULL,
  status            TEXT NOT NULL DEFAULT 'ready',
  model_name        TEXT NOT NULL,
  prompt_version    TEXT NOT NULL,
  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_programme_target_profiles_programme_created
  ON public.programme_target_profile_versions(programme_id, COALESCE(scholarship_key, ''), created_at DESC);

ALTER TABLE public.programme_target_profile_versions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- READ: shared programme-level cache — any authenticated user may read a
  -- stored profile (content is catalogue-derived, no personal data). Without
  -- this, cross-user reuse is impossible and every student pays the AI cost.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'programme_target_profile_versions'
      AND policyname = 'programme_target_profile_versions_select_authenticated'
  ) THEN
    CREATE POLICY "programme_target_profile_versions_select_authenticated"
      ON public.programme_target_profile_versions
      FOR SELECT TO authenticated
      USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'programme_target_profile_versions'
      AND policyname = 'programme_target_profile_versions_insert_own'
  ) THEN
    CREATE POLICY "programme_target_profile_versions_insert_own"
      ON public.programme_target_profile_versions
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = created_by);
  END IF;
END $$;

-- ── application_profile_analysis_versions ───────────────────────────────────
-- One row per completed composite analysis of ONE application's confirmed
-- snapshot (ApplicantAIState modules). Written only after EVERY required
-- module validates — never a partial analysis.
CREATE TABLE IF NOT EXISTS public.application_profile_analysis_versions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id        UUID NOT NULL REFERENCES public.course_applications(id) ON DELETE CASCADE,
  confirmed_snapshot_id UUID REFERENCES public.confirmed_candidate_snapshots(id) ON DELETE SET NULL,
  -- Hash of the normalized analysis input; equal hash + equal module versions ⇒ reusable analysis.
  input_hash            TEXT NOT NULL,
  module_versions       JSONB NOT NULL DEFAULT '{}'::jsonb,
  structured_outputs    JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Completed Evidence Bank (Task 7). Stored only after provenance validation passes.
  evidence_bank         JSONB,
  generation_metadata   JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_application_profile_analyses_application_created
  ON public.application_profile_analysis_versions(application_id, created_at DESC);

ALTER TABLE public.application_profile_analysis_versions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'application_profile_analysis_versions'
      AND policyname = 'application_profile_analysis_versions_select_own'
  ) THEN
    CREATE POLICY "application_profile_analysis_versions_select_own"
      ON public.application_profile_analysis_versions
      FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'application_profile_analysis_versions'
      AND policyname = 'application_profile_analysis_versions_insert_own'
  ) THEN
    CREATE POLICY "application_profile_analysis_versions_insert_own"
      ON public.application_profile_analysis_versions
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ── application_academic_assessment_versions ────────────────────────────────
-- Deterministic-first academic requirement assessment per application
-- snapshot (meets / possibly_meets / does_not_meet / insufficient_information).
-- Append-only like the profile analysis it accompanies.
CREATE TABLE IF NOT EXISTS public.application_academic_assessment_versions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id        UUID NOT NULL REFERENCES public.course_applications(id) ON DELETE CASCADE,
  confirmed_snapshot_id UUID REFERENCES public.confirmed_candidate_snapshots(id) ON DELETE SET NULL,
  input_hash            TEXT NOT NULL,
  assessment            JSONB NOT NULL,
  module_versions       JSONB NOT NULL DEFAULT '{}'::jsonb,
  generation_metadata   JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_application_academic_assessments_application_created
  ON public.application_academic_assessment_versions(application_id, created_at DESC);

ALTER TABLE public.application_academic_assessment_versions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'application_academic_assessment_versions'
      AND policyname = 'application_academic_assessment_versions_select_own'
  ) THEN
    CREATE POLICY "application_academic_assessment_versions_select_own"
      ON public.application_academic_assessment_versions
      FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'application_academic_assessment_versions'
      AND policyname = 'application_academic_assessment_versions_insert_own'
  ) THEN
    CREATE POLICY "application_academic_assessment_versions_insert_own"
      ON public.application_academic_assessment_versions
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ── student_activity_follow_up_answers ──────────────────────────────────────
-- Adaptive Follow-up Q&A about ONE shared activity, asked inside ONE
-- application's context. Answers stay APPEND-ONLY here (never merged into the
-- activity row itself); the next confirm copies resolved answers into the new
-- snapshot. One question per response, ≤2 attempts per dimension, ≤6 per
-- activity are enforced by the API layer, not by constraints.
CREATE TABLE IF NOT EXISTS public.student_activity_follow_up_answers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES public.course_applications(id) ON DELETE CASCADE,
  activity_id    UUID NOT NULL REFERENCES public.student_activities(id) ON DELETE CASCADE,
  -- Priority dimension this question targeted: action > ownership > impact >
  -- transformation > challenge > motivation > context.
  dimension      TEXT NOT NULL,
  question       TEXT NOT NULL,
  answer         TEXT NOT NULL,
  -- Attempt number for this dimension (1..2).
  round          INT NOT NULL DEFAULT 1 CHECK (round BETWEEN 1 AND 2),
  -- Set when a later answer replaces this one for ranking purposes; history stays.
  superseded_by_answer_id UUID REFERENCES public.student_activity_follow_up_answers(id) ON DELETE SET NULL,
  model_name     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_follow_ups_activity_created
  ON public.student_activity_follow_up_answers(activity_id, created_at ASC);

ALTER TABLE public.student_activity_follow_up_answers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'student_activity_follow_up_answers'
      AND policyname = 'student_activity_follow_up_answers_select_own'
  ) THEN
    CREATE POLICY "student_activity_follow_up_answers_select_own"
      ON public.student_activity_follow_up_answers
      FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'student_activity_follow_up_answers'
      AND policyname = 'student_activity_follow_up_answers_insert_own'
  ) THEN
    CREATE POLICY "student_activity_follow_up_answers_insert_own"
      ON public.student_activity_follow_up_answers
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ── application_personal_report_supplements ─────────────────────────────────
-- Application-scoped replacement for the legacy user-level
-- personal_report_supplements: answers to a specific application report's own
-- follow-up questions. Upsert keyed on (user, application, field_key); the
-- legacy global table is untouched and remains read-only history.
CREATE TABLE IF NOT EXISTS public.application_personal_report_supplements (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id    UUID NOT NULL REFERENCES public.course_applications(id) ON DELETE CASCADE,
  report_version_id UUID REFERENCES public.student_personal_report_versions(id) ON DELETE SET NULL,
  field_key         TEXT NOT NULL,
  answer            TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_application_personal_report_supplements_key
    UNIQUE (user_id, application_id, field_key)
);

ALTER TABLE public.application_personal_report_supplements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'application_personal_report_supplements'
      AND policyname = 'application_personal_report_supplements_select_own'
  ) THEN
    CREATE POLICY "application_personal_report_supplements_select_own"
      ON public.application_personal_report_supplements
      FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'application_personal_report_supplements'
      AND policyname = 'application_personal_report_supplements_insert_own'
  ) THEN
    CREATE POLICY "application_personal_report_supplements_insert_own"
      ON public.application_personal_report_supplements
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Verification (optional):
-- SELECT column_name FROM information_schema.columns WHERE table_name='student_personal_report_versions' ORDER BY ordinal_position;
-- SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE '%target%' OR tablename LIKE 'application_%analysis%';
