-- Issued-question and answer-integrity follow-up migration.
-- Run after supabase-application-personal-report-state.sql.

CREATE TABLE IF NOT EXISTS public.student_activity_follow_up_questions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES public.course_applications(id) ON DELETE CASCADE,
  activity_id    UUID NOT NULL REFERENCES public.student_activities(id) ON DELETE CASCADE,
  dimension      TEXT NOT NULL,
  round          INT NOT NULL CHECK (round BETWEEN 1 AND 2),
  question       TEXT NOT NULL,
  answered_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (application_id, activity_id, dimension, round)
);

ALTER TABLE public.student_activity_follow_up_answers
  ADD COLUMN IF NOT EXISTS question_id UUID REFERENCES public.student_activity_follow_up_questions(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_activity_follow_up_answer_question
  ON public.student_activity_follow_up_answers(question_id)
  WHERE question_id IS NOT NULL;

ALTER TABLE public.student_activity_follow_up_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student_activity_follow_up_questions_select_own" ON public.student_activity_follow_up_questions;
CREATE POLICY "student_activity_follow_up_questions_select_own"
  ON public.student_activity_follow_up_questions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "student_activity_follow_up_questions_insert_own" ON public.student_activity_follow_up_questions;
CREATE POLICY "student_activity_follow_up_questions_insert_own"
  ON public.student_activity_follow_up_questions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "student_activity_follow_up_questions_update_own" ON public.student_activity_follow_up_questions;
CREATE POLICY "student_activity_follow_up_questions_update_own"
  ON public.student_activity_follow_up_questions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.consume_activity_follow_up_question()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.question_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.student_activity_follow_up_questions
     SET answered_at = COALESCE(answered_at, now())
   WHERE id = NEW.question_id
     AND user_id = NEW.user_id
     AND application_id = NEW.application_id
     AND activity_id = NEW.activity_id
     AND dimension = NEW.dimension
     AND round = NEW.round
     AND question = NEW.question
     AND answered_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Follow-up question is stale or already answered' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.student_activity_follow_up_answers
     SET superseded_by_answer_id = NEW.id
   WHERE user_id = NEW.user_id
     AND application_id = NEW.application_id
     AND activity_id = NEW.activity_id
     AND dimension = NEW.dimension
     AND superseded_by_answer_id IS NULL
     AND id <> NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_consume_activity_follow_up_question ON public.student_activity_follow_up_answers;
CREATE TRIGGER trg_consume_activity_follow_up_question
AFTER INSERT ON public.student_activity_follow_up_answers
FOR EACH ROW EXECUTE FUNCTION public.consume_activity_follow_up_question();

REVOKE ALL ON FUNCTION public.consume_activity_follow_up_question() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_activity_follow_up_question() TO authenticated;
