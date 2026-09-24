-- Atomic course shortlist creation.
--
-- The RPC accepts only database identifiers. The authenticated identity,
-- session ownership, result ownership, and all course metadata come from the
-- database, never from a caller-supplied user id or JSON document.

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

  -- Lock the owned session before validating and changing its results.
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

  -- Lock every selected row, then validate the whole batch before any insert.
  PERFORM 1
    FROM public.course_search_session_results AS r
   WHERE r.session_id = p_session_id
     AND r.id = ANY (p_result_ids)
   FOR UPDATE;

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

  -- All validation is complete. Each iteration now performs the three writes
  -- and links the result. Any error rolls back the entire function statement.
  FOR v_result IN
    SELECT r.*
      FROM public.course_search_session_results AS r
     WHERE r.session_id = p_session_id
       AND r.id = ANY (p_result_ids)
     ORDER BY array_position(p_result_ids, r.id)
  LOOP
    -- A retry of an already-selected result is intentionally idempotent.
    IF v_result.selected IS TRUE THEN
      CONTINUE;
    END IF;

    -- Protect against duplicate applications, including two results for the
    -- same URL in one request.
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
      user_id,
      university_id,
      university_name,
      course_name,
      course_url,
      status,
      parse_status,
      progress_percentage,
      created_at,
      updated_at
    )
    VALUES (
      v_user_id,
      v_result.university_id,
      v_university_name,
      v_result.course_name,
      v_result.course_url,
      'researching',
      'pending',
      0,
      now(),
      now()
    )
    RETURNING id INTO v_application_id;

    INSERT INTO public.application_sources (
      application_id,
      university_id,
      source_type,
      title,
      url,
      display_priority,
      is_official,
      confidence,
      validation_status,
      created_at,
      updated_at
    )
    VALUES (
      v_application_id,
      v_result.university_id,
      'course_page',
      v_result.course_name || ' - Official Course Page',
      v_result.course_url,
      1,
      true,
      0.7,
      'unchecked',
      now(),
      now()
    );

    INSERT INTO public.course_parse_jobs (
      application_id,
      course_url,
      university_id,
      status,
      attempts,
      max_attempts,
      next_attempt_at,
      created_at,
      updated_at
    )
    VALUES (
      v_application_id,
      v_result.course_url,
      v_result.university_id,
      'pending',
      0,
      3,
      now(),
      now(),
      now()
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
