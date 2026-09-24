-- GLOWBAL CRITICAL SECURITY HARDENING — 2026-09-08
--
-- Scope: A1 (course shortlist SECURITY DEFINER RPC) and A2 (mentor PII and
-- verification-document access). Run in a transaction on the intended
-- Supabase project only after reviewing the preflight output.
--
-- Deployment order:
--   1. Apply this migration and run the verification queries at the end.
--   2. Deploy the matching route/lib application commit.
--   3. Run the disposable cross-user integration test against a non-production
--      Supabase project.
--
-- This file deliberately does not create buckets or grant authenticated users
-- access to private mentor/student objects. The service role is the admin path.

BEGIN;

DO $$
DECLARE
  v_table text;
  v_column text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'course_search_sessions',
    'course_search_session_results',
    'course_applications',
    'application_sources',
    'course_parse_jobs',
    'achiever_profiles'
  ] LOOP
    IF to_regclass(format('public.%s', v_table)) IS NULL THEN
      RAISE EXCEPTION 'Required table is missing: public.%', v_table;
    END IF;
  END LOOP;

  FOREACH v_column IN ARRAY ARRAY[
    'legal_name',
    'date_of_birth',
    'cv_storage_key',
    'acceptance_letter_storage_key',
    'transcript_storage_key',
    'student_card_storage_key',
    'stripe_account_id'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'achiever_profiles'
         AND column_name = v_column
    ) THEN
      RAISE EXCEPTION 'Required private mentor column is missing: %', v_column;
    END IF;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'mentor-documents')
     OR NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'student-documents') THEN
    RAISE EXCEPTION 'mentor-documents and student-documents buckets must exist before this migration';
  END IF;
END;
$$;

-- ============================================================================
-- A1: identity-bound atomic course shortlist RPC
-- ============================================================================

DROP FUNCTION IF EXISTS public.add_selected_courses_to_apply(uuid, uuid, jsonb);
DROP FUNCTION IF EXISTS public.add_selected_courses_to_apply(uuid, uuid[]);

CREATE OR REPLACE FUNCTION public.add_selected_courses_to_apply(
  p_session_id uuid,
  p_result_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_user_id uuid;
  v_session public.course_search_sessions%ROWTYPE;
  v_result public.course_search_session_results%ROWTYPE;
  v_result_count bigint;
  v_application_id uuid;
  v_parse_job_id uuid;
  v_university_name text;
  v_applications jsonb := '[]'::jsonb;
  v_created_count integer := 0;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'Session is required' USING ERRCODE = '22004';
  END IF;
  IF p_result_ids IS NULL OR cardinality(p_result_ids) = 0 THEN
    RAISE EXCEPTION 'At least one result is required' USING ERRCODE = '22023';
  END IF;
  IF cardinality(p_result_ids) > 10 THEN
    RAISE EXCEPTION 'At most 10 results may be added' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM unnest(p_result_ids) AS ids(result_id)
     GROUP BY ids.result_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Result IDs must be unique' USING ERRCODE = '22023';
  END IF;

  SELECT s.*
    INTO v_session
    FROM public.course_search_sessions AS s
   WHERE s.id = p_session_id
     AND s.user_id = v_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found' USING ERRCODE = '42501';
  END IF;
  IF v_session.status <> 'complete' THEN
    RAISE EXCEPTION 'Session is not complete' USING ERRCODE = '22023';
  END IF;

  SELECT count(*)
    INTO v_result_count
    FROM public.course_search_session_results AS r
   WHERE r.session_id = p_session_id
     AND r.id = ANY (p_result_ids);

  IF v_result_count <> cardinality(p_result_ids) THEN
    RAISE EXCEPTION 'One or more selected results do not belong to this session'
      USING ERRCODE = '42501';
  END IF;

  PERFORM 1
    FROM public.course_search_session_results AS r
   WHERE r.session_id = p_session_id
     AND r.id = ANY (p_result_ids)
   FOR UPDATE;

  -- Validate every row and its existing application link before any insert.
  FOR v_result IN
    SELECT r.*
      FROM public.course_search_session_results AS r
     WHERE r.session_id = p_session_id
       AND r.id = ANY (p_result_ids)
     ORDER BY array_position(p_result_ids, r.id)
  LOOP
    IF nullif(btrim(coalesce(v_result.course_name, '')), '') IS NULL
       OR nullif(btrim(coalesce(v_result.course_url, '')), '') IS NULL
       OR v_result.university_id IS NULL THEN
      RAISE EXCEPTION 'Selected result is incomplete' USING ERRCODE = '22023';
    END IF;

    SELECT u.name
      INTO v_university_name
      FROM public.universities AS u
     WHERE u.id = v_result.university_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Selected result has no matching university'
        USING ERRCODE = '22023';
    END IF;

    IF v_result.selected IS TRUE AND v_result.selected_application_id IS NOT NULL THEN
      PERFORM 1
        FROM public.course_applications AS a
       WHERE a.id = v_result.selected_application_id
         AND a.user_id = v_user_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Selected result belongs to another user'
          USING ERRCODE = '42501';
      END IF;
    ELSIF v_result.selected IS TRUE OR v_result.selected_application_id IS NOT NULL THEN
      RAISE EXCEPTION 'Selected result state is inconsistent' USING ERRCODE = '22023';
    END IF;
  END LOOP;

  FOR v_result IN
    SELECT r.*
      FROM public.course_search_session_results AS r
     WHERE r.session_id = p_session_id
       AND r.id = ANY (p_result_ids)
     ORDER BY array_position(p_result_ids, r.id)
  LOOP
    IF v_result.selected IS TRUE THEN
      CONTINUE;
    END IF;

    -- This also collapses duplicate URLs within one batch.
    v_application_id := NULL;
    SELECT a.id
      INTO v_application_id
      FROM public.course_applications AS a
     WHERE a.user_id = v_user_id
       AND a.course_url = v_result.course_url
     ORDER BY a.created_at, a.id
     LIMIT 1
     FOR UPDATE;

    IF v_application_id IS NOT NULL THEN
      UPDATE public.course_search_session_results
         SET selected = true,
             selected_at = now(),
             selected_application_id = v_application_id,
             updated_at = now()
       WHERE id = v_result.id;
      CONTINUE;
    END IF;

    SELECT u.name
      INTO v_university_name
      FROM public.universities AS u
     WHERE u.id = v_result.university_id;

    INSERT INTO public.course_applications (
      user_id, university_id, university_name, course_name, course_url,
      status, parse_status, progress_percentage, created_at, updated_at
    )
    VALUES (
      v_user_id, v_result.university_id, v_university_name,
      v_result.course_name, v_result.course_url,
      'researching', 'pending', 0, now(), now()
    )
    RETURNING id INTO v_application_id;

    INSERT INTO public.application_sources (
      application_id, university_id, source_type, title, url,
      display_priority, is_official, confidence, validation_status,
      created_at, updated_at
    )
    VALUES (
      v_application_id, v_result.university_id, 'course_page',
      v_result.course_name || ' - Official Course Page', v_result.course_url,
      1, true, 0.7, 'unchecked', now(), now()
    );

    INSERT INTO public.course_parse_jobs (
      application_id, course_url, university_id, status, attempts,
      max_attempts, next_attempt_at, created_at, updated_at
    )
    VALUES (
      v_application_id, v_result.course_url, v_result.university_id,
      'pending', 0, 3, now(), now(), now()
    )
    RETURNING id INTO v_parse_job_id;

    UPDATE public.course_search_session_results
       SET selected = true,
           selected_at = now(),
           selected_application_id = v_application_id,
           updated_at = now()
     WHERE id = v_result.id;

    v_applications := v_applications || jsonb_build_object(
      'application_id', v_application_id,
      'course_name', v_result.course_name,
      'course_url', v_result.course_url,
      'parse_job_id', v_parse_job_id,
      'parse_status', 'pending'
    );
    v_created_count := v_created_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'applications_created', v_applications,
    'count', v_created_count
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.add_selected_courses_to_apply(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_selected_courses_to_apply(uuid, uuid[]) TO authenticated;
COMMENT ON FUNCTION public.add_selected_courses_to_apply(uuid, uuid[]) IS
'Atomically adds owned search-session results to the caller''s shortlist. Identity and course metadata are read from auth/database state, never caller-supplied.';

-- ============================================================================
-- A2: public mentor projection, private base columns, and private buckets
-- ============================================================================

CREATE OR REPLACE VIEW public.public_mentor_profiles
WITH (security_invoker = true)
AS
SELECT
  id,
  display_name,
  avatar_url,
  university_id,
  degree_level,
  subject,
  graduation_year,
  study_start_year,
  currently_enrolled,
  bio,
  help_topics,
  strengths,
  languages,
  session_price_vnd,
  session_duration_mins,
  hourly_rate_amount,
  hourly_rate_currency,
  total_sessions,
  avg_rating,
  verified_at,
  created_at
FROM public.achiever_profiles
WHERE status = 'approved';

REVOKE ALL ON public.public_mentor_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.public_mentor_profiles TO anon, authenticated;

-- Direct table reads are restricted to public mentor fields. The service role
-- retains the full row for the authenticated owner dashboard and admin APIs.
REVOKE SELECT ON public.achiever_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  id, display_name, avatar_url, university_id, degree_level, subject,
  graduation_year, study_start_year, currently_enrolled, bio, help_topics,
  strengths, languages, session_price_vnd, session_duration_mins,
  hourly_rate_amount, hourly_rate_currency, total_sessions, avg_rating,
  status, verified_at, created_at
) ON public.achiever_profiles TO anon, authenticated;
GRANT SELECT ON public.achiever_profiles TO service_role;

DROP POLICY IF EXISTS "Anyone can read approved achiever profiles" ON public.achiever_profiles;
CREATE POLICY "Anyone can read approved achiever profiles"
  ON public.achiever_profiles FOR SELECT
  TO anon, authenticated
  USING (status = 'approved' OR id = auth.uid());

UPDATE storage.buckets
   SET public = false
 WHERE id IN ('mentor-documents', 'student-documents');

DROP POLICY IF EXISTS "Mentor uploads own documents" ON storage.objects;
DROP POLICY IF EXISTS "Mentor reads own documents" ON storage.objects;
DROP POLICY IF EXISTS "Mentor updates own documents" ON storage.objects;
DROP POLICY IF EXISTS "Mentor deletes own documents" ON storage.objects;
CREATE POLICY "Mentor uploads own documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'mentor-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "Mentor reads own documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'mentor-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "Mentor updates own documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'mentor-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'mentor-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "Mentor deletes own documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'mentor-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users upload own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users read own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users update own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own documents" ON storage.objects;
CREATE POLICY "Users upload own documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'student-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "Users read own documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'student-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "Users update own documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'student-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'student-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "Users delete own documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'student-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

COMMIT;

-- ============================================================================
-- Post-deployment verification (run separately, read-only)
-- ============================================================================
-- SELECT to_regprocedure('public.add_selected_courses_to_apply(uuid,uuid[])');
-- SELECT to_regprocedure('public.add_selected_courses_to_apply(uuid,uuid,jsonb)');
-- SELECT has_function_privilege('anon', 'public.add_selected_courses_to_apply(uuid,uuid[])', 'EXECUTE');
-- SELECT has_function_privilege('authenticated', 'public.add_selected_courses_to_apply(uuid,uuid[])', 'EXECUTE');
-- SELECT column_name FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'public_mentor_profiles'
--   ORDER BY ordinal_position;
-- SELECT has_column_privilege('authenticated', 'public.achiever_profiles', 'legal_name', 'SELECT');
-- SELECT has_column_privilege('authenticated', 'public.achiever_profiles', 'display_name', 'SELECT');
-- SELECT id, public FROM storage.buckets
--   WHERE id IN ('mentor-documents', 'student-documents');
-- SELECT policyname, cmd, roles, qual, with_check
--   FROM pg_policies
--   WHERE (schemaname = 'public' AND tablename = 'achiever_profiles')
--      OR (schemaname = 'storage' AND tablename = 'objects'
--          AND policyname ILIKE '%document%');

-- Rollback: never restore the removed p_user_id/p_results RPC. If application
-- deployment must be rolled back, keep this database hardening in place and
-- roll back only the route to a compatible secure caller after investigation.
