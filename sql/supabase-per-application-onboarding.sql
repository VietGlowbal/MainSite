-- Makes Candidate Information review/confirmation per-APPLICATION instead of
-- per-STUDENT.
--
-- Run this against your Supabase project before shipping the per-application
-- onboarding fix.
--
-- WHY THIS EXISTS. `student_profiles.confirmed_at` (plus
-- `personal_summary_completed_at`/`achievements_completed_at`) is one flag
-- per student, shared across every application. That is correct for the
-- underlying candidate data (one profile, reused everywhere) but wrong for
-- whether the student has REVIEWED that data for a given application: once
-- confirmed on application A, a brand-new application B's onboarding used to
-- see the SAME global flags and silently skip reflections, achievements, and
-- Review & Confirm entirely — reported live 2026-08-13 as "you can't confirm
-- for a new application, it always uses the old one." Every application must
-- independently go through the same three stops before its reports generate,
-- with a one-click "skip" (not an automatic system skip) for a returning
-- student whose answers are still correct.
--
-- The global `student_profiles` columns are UNTOUCHED by this migration and
-- keep being written — they remain the fallback for the handful of entry
-- points that have no specific application context (the legacy
-- `/ai-strategy/report` generation, reached with no application in scope).

ALTER TABLE public.course_applications
  ADD COLUMN IF NOT EXISTS personal_summary_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS achievements_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS candidate_confirmed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.course_applications.personal_summary_reviewed_at IS
  'Set by PATCH /api/reflection when the "about" step is saved (or skipped) for THIS application.';
COMMENT ON COLUMN public.course_applications.achievements_reviewed_at IS
  'Set by PATCH /api/reflection when achievements/activities are saved (or skipped) for THIS application.';
COMMENT ON COLUMN public.course_applications.candidate_confirmed_at IS
  'Set by POST /api/candidate-information/confirm for THIS application. While set, this application''s reflections/achievements pages render read-only and PATCH /api/reflection rejects edits made in this application''s context.';

-- ── confirmed_candidate_snapshots: tag each row with the application it was
-- confirmed for ───────────────────────────────────────────────────────────
--
-- The table was already append-only (one row per confirmation, never
-- updated) specifically so a later feature that supports re-confirming could
-- insert a new row without touching history — this is that feature. Nullable
-- because existing rows, from before per-application confirmation existed,
-- have no single application to point at.
ALTER TABLE public.confirmed_candidate_snapshots
  ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES public.course_applications(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_confirmed_candidate_snapshots_application
  ON public.confirmed_candidate_snapshots(application_id);
