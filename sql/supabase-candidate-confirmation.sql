-- Review & Confirm — the checkpoint between finishing Candidate Information
-- and generating reports.
--
-- Run this against your Supabase project before shipping the confirmation
-- flow (Review & Confirm → confirmation modal → locked profile).
--
-- WHY A SNAPSHOT TABLE. Reports must be generated from the exact version of
-- a student's information they explicitly approved, not whatever the live
-- `student_profiles`/`student_achievements`/`student_activities` rows say at
-- the moment generation happens to run. Freezing a copy at confirmation time
-- is what makes "this is what your reports were built from" (the read-only
-- Reflections/Achievements pages, after confirmation) a true statement.
--
-- WHY ONE JSONB COLUMN. The payload is `{ reflection, documents }` — the
-- exact shape `reflectionSchema` already validates the whole candidate
-- information form against, plus the document list. A fully normalised
-- snapshot (a table per personal/academic/study/achievement/... slice) would
-- mean six-plus new tables for data that is read and written as one object
-- everywhere else in this feature; JSONB of the same shape freezes it with
-- no new surface to keep in sync. `schema_version` exists so a future shape
-- change can tell an old snapshot from a new one when reading it back.
--
-- WHY APPEND-ONLY, LIKE applicant_analyses. A locked profile is not
-- "editable once unlocked" in this feature (that is future-cycle work, out
-- of scope here) — but keeping every confirmation as its own row rather than
-- updating one in place means a later feature that DOES support starting a
-- fresh cycle can simply insert a new row without needing to preserve or
-- discard history. The latest row for a user is "the" confirmation.
--
-- WHAT IS NOT BUILT HERE, ON PURPOSE. Report generation (Personal / Matching
-- / Strategy) keeps reading the live `student_profiles`/`student_achievements`
-- /`student_activities` tables it already reads — it is not rewired to read
-- from this snapshot. That is safe because those tables are frozen the
-- moment `confirmed_at` is set (see the lock enforcement in
-- `PATCH /api/reflection`): a live read and a snapshot read return the same
-- data for as long as this feature has no "start a new draft" flow.

CREATE TABLE IF NOT EXISTS public.confirmed_candidate_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- { reflection: ReflectionValues, documents: [{ id, fileName }, ...] }
  payload         JSONB NOT NULL,
  schema_version  INT NOT NULL DEFAULT 1,

  confirmed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.confirmed_candidate_snapshots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'confirmed_candidate_snapshots'
      AND policyname = 'confirmed_candidate_snapshots_owner'
  ) THEN
    -- Read-only for the owner past creation: a snapshot is written once, by
    -- the confirm route, and never updated by the student — there is
    -- nothing here for an ordinary UPDATE/DELETE policy to permit.
    CREATE POLICY "confirmed_candidate_snapshots_owner" ON public.confirmed_candidate_snapshots
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  -- ⚠️ THE ROW THIS TABLE EXISTS TO STORE COULD NEVER BE WRITTEN WITHOUT
  -- THIS. `POST /api/candidate-information/confirm` inserts through the
  -- ordinary user-session client (`createClient()`, not `createAdminClient`),
  -- because the confirmation is an action the signed-in student is taking on
  -- their own profile — so RLS applies to that insert like any other write in
  -- this app. With only the SELECT policy above, RLS defaults to denying
  -- every insert, including the owner's own: confirming failed in production
  -- with a 403 "new row violates row-level security policy" the moment a
  -- student who had actually run the rest of this file first tried it. (The
  -- route's own error handling made this worse, not better: the 403's message
  -- happens to contain this table's name, which its `migrationMissing()`
  -- check matched, reporting the misleading "not available yet, try again
  -- shortly" — a retry that could never succeed. That check has since been
  -- narrowed; this policy is the actual fix.)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'confirmed_candidate_snapshots'
      AND policyname = 'confirmed_candidate_snapshots_insert_own'
  ) THEN
    CREATE POLICY "confirmed_candidate_snapshots_insert_own" ON public.confirmed_candidate_snapshots
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_confirmed_candidate_snapshots_user
  ON public.confirmed_candidate_snapshots(user_id, confirmed_at DESC);

-- ── student_profiles: the lock flag ─────────────────────────────────────────
-- Set the moment a snapshot is created; checked by PATCH /api/reflection (and
-- read by the reflection/achievements page.tsx server components) to decide
-- between the editable form and the read-only view.
ALTER TABLE public.student_profiles
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.student_profiles.confirmed_at IS
  'Set by POST /api/candidate-information/confirm. While set, candidate-information edits are rejected and the reflection/achievements pages render read-only.';
