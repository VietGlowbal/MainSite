-- LOR F7.1/F7.2 strategy state. Run after supabase-apply-v2.sql and
-- supabase-reflection.sql. Safe to run repeatedly in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.application_lor_strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL UNIQUE
    REFERENCES public.course_applications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  recommender_type TEXT NOT NULL CHECK (recommender_type IN (
    'subject_teacher',
    'homeroom_teacher',
    'school_counselor',
    'research_supervisor',
    'club_advisor',
    'internship_supervisor',
    'employer',
    'volunteer_supervisor',
    'coach',
    'academic_mentor',
    'other'
  )),
  relationship_context TEXT NOT NULL CHECK (char_length(relationship_context) BETWEEN 10 AND 1000),
  known_duration TEXT NOT NULL CHECK (known_duration IN (
    'less_than_six_months',
    'six_to_twelve_months',
    'one_to_two_years',
    'more_than_two_years'
  )),
  observed_evidence JSONB NOT NULL DEFAULT '[]'::JSONB
    CHECK (jsonb_typeof(observed_evidence) = 'array'),
  perspective JSONB NOT NULL CHECK (jsonb_typeof(perspective) = 'object'),
  recommendations JSONB NOT NULL DEFAULT '[]'::JSONB
    CHECK (jsonb_typeof(recommendations) = 'array'),
  do_not_prioritize JSONB NOT NULL DEFAULT '[]'::JSONB
    CHECK (jsonb_typeof(do_not_prioritize) = 'array'),
  recommendation_brief TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_application_lor_strategies_user
  ON public.application_lor_strategies(user_id);

ALTER TABLE public.application_lor_strategies ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'application_lor_strategies'
      AND policyname = 'Users can view their LOR strategy'
  ) THEN
    CREATE POLICY "Users can view their LOR strategy"
      ON public.application_lor_strategies FOR SELECT
      TO authenticated
      USING (
        (SELECT auth.uid()) = user_id
        AND EXISTS (
          SELECT 1 FROM public.course_applications
          WHERE course_applications.id = application_lor_strategies.application_id
            AND course_applications.user_id = (SELECT auth.uid())
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'application_lor_strategies'
      AND policyname = 'Users can create their LOR strategy'
  ) THEN
    CREATE POLICY "Users can create their LOR strategy"
      ON public.application_lor_strategies FOR INSERT
      TO authenticated
      WITH CHECK (
        (SELECT auth.uid()) = user_id
        AND EXISTS (
          SELECT 1 FROM public.course_applications
          WHERE course_applications.id = application_lor_strategies.application_id
            AND course_applications.user_id = (SELECT auth.uid())
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'application_lor_strategies'
      AND policyname = 'Users can update their LOR strategy'
  ) THEN
    CREATE POLICY "Users can update their LOR strategy"
      ON public.application_lor_strategies FOR UPDATE
      TO authenticated
      USING (
        (SELECT auth.uid()) = user_id
        AND EXISTS (
          SELECT 1 FROM public.course_applications
          WHERE course_applications.id = application_lor_strategies.application_id
            AND course_applications.user_id = (SELECT auth.uid())
        )
      )
      WITH CHECK (
        (SELECT auth.uid()) = user_id
        AND EXISTS (
          SELECT 1 FROM public.course_applications
          WHERE course_applications.id = application_lor_strategies.application_id
            AND course_applications.user_id = (SELECT auth.uid())
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'application_lor_strategies'
      AND policyname = 'Users can delete their LOR strategy'
  ) THEN
    CREATE POLICY "Users can delete their LOR strategy"
      ON public.application_lor_strategies FOR DELETE
      TO authenticated
      USING (
        (SELECT auth.uid()) = user_id
        AND EXISTS (
          SELECT 1 FROM public.course_applications
          WHERE course_applications.id = application_lor_strategies.application_id
            AND course_applications.user_id = (SELECT auth.uid())
        )
      );
  END IF;
END $$;

-- New Supabase projects no longer expose public tables through the Data API
-- automatically, so grants are explicit and remain separate from RLS.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_lor_strategies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_lor_strategies TO service_role;

CREATE OR REPLACE FUNCTION public.consume_statement_review(review_limit INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  consumed BOOLEAN := FALSE;
BEGIN
  IF review_limit < 1 THEN
    RETURN FALSE;
  END IF;

  UPDATE public.student_profiles
  SET sop_analyses_used = COALESCE(sop_analyses_used, 0) + 1
  WHERE user_id = (SELECT auth.uid())
    AND COALESCE(plus_status, FALSE) = FALSE
    AND COALESCE(sop_analyses_used, 0) < review_limit
  RETURNING TRUE INTO consumed;

  IF consumed THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.student_profiles
    WHERE user_id = (SELECT auth.uid())
      AND COALESCE(plus_status, FALSE) = TRUE
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consume_statement_review(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_statement_review(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_statement_review(INTEGER) TO service_role;
