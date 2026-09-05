-- Versioned onboarding responses.
--
-- Run this after supabase-schema.sql. The table stores the canonical answer
-- payload so new questions can be added without repeatedly changing
-- student_profiles. The important profile fields are still projected into
-- student_profiles by the onboarding repository.

CREATE TABLE IF NOT EXISTS public.student_onboarding_responses (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flow_id         TEXT NOT NULL,
  flow_version    INTEGER NOT NULL,
  answers         JSONB NOT NULL DEFAULT '{}'::jsonb,
  completed_steps INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'in_progress',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT student_onboarding_responses_status_check
    CHECK (status IN ('in_progress', 'completed')),
  CONSTRAINT student_onboarding_responses_completed_steps_check
    CHECK (completed_steps >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS student_onboarding_responses_identity_idx
  ON public.student_onboarding_responses (user_id, flow_id, flow_version);

CREATE INDEX IF NOT EXISTS student_onboarding_responses_status_idx
  ON public.student_onboarding_responses (status, updated_at DESC);

ALTER TABLE public.student_onboarding_responses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'student_onboarding_responses'
      AND policyname = 'Users manage own onboarding responses'
  ) THEN
    CREATE POLICY "Users manage own onboarding responses"
      ON public.student_onboarding_responses
      FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
