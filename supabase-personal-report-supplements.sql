-- Lets a student answer a Personal Report's own follow-up questions
-- (e.g. "why are you interested in these subjects") directly from the
-- report, without reopening their confirmed Candidate Information.
--
-- WHY THIS IS A SEPARATE TABLE, NOT A WRITE BACK TO student_profiles.
--
-- Reported live 2026-08-14: the report's "Answer this" / "add more detail"
-- actions used to send a student to `/ai-strategy/reflection`, which renders
-- read-only once that application's Candidate Information has been
-- confirmed — the entire point of that lock (see
-- supabase-candidate-confirmation.sql) is that a report is generated from,
-- and stays truthful to, the exact answers a student explicitly reviewed and
-- approved. Quietly reopening `student_profiles.study_motivation` for
-- editing from inside a report would undermine that guarantee for every
-- application whose report was built from it — owner decision: report-only
-- answers live in their own table, read ONLY by Personal Report generation,
-- and never merged back into the confirmed profile or any confirmed
-- snapshot.
--
-- `field_key` is intentionally an open string, not a FK to a real
-- `student_profiles` column — the report layer decides which of its own
-- gaps are answerable this way (currently just `study_motivation`) without
-- this table needing a migration every time that set grows.
CREATE TABLE IF NOT EXISTS public.personal_report_supplements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  answer TEXT NOT NULL CHECK (char_length(answer) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, field_key)
);

CREATE INDEX IF NOT EXISTS idx_personal_report_supplements_user
  ON public.personal_report_supplements(user_id);

ALTER TABLE public.personal_report_supplements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'personal_report_supplements'
      AND policyname = 'personal_report_supplements_owner'
  ) THEN
    CREATE POLICY "personal_report_supplements_owner" ON public.personal_report_supplements
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
