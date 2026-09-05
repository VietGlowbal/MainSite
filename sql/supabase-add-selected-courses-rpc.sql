-- ============================================================================
-- PHASE 13, TASK 13.7: Atomic Batch Course Application Creation
-- ============================================================================
-- This file contains a PostgreSQL RPC function for atomically creating multiple
-- course applications with their sources and parse jobs in a single transaction.
--
-- Purpose: Ensure ACID properties when adding selected courses from a search
-- session to a user's Apply shortlist.
--
-- Task Requirements:
-- - Create course_applications records
-- - Create application_sources records linking to official course pages
-- - Create course_parse_jobs records for background AI parsing
-- - Mark session results as selected
-- - All operations must succeed or fail together (atomicity)
-- ============================================================================

-- Drop existing function if it exists (for idempotent migrations)
DROP FUNCTION IF EXISTS public.add_selected_courses_to_apply(
  p_user_id UUID,
  p_session_id UUID,
  p_results JSONB
);

-- ============================================================================
-- Function: add_selected_courses_to_apply
-- ============================================================================
-- Atomically creates course applications, sources, and parse jobs for multiple
-- selected search results in a single transaction.
--
-- Parameters:
--   p_user_id     UUID   - The authenticated user's ID
--   p_session_id  UUID   - The course search session ID
--   p_results     JSONB  - Array of result objects to process
--
-- Expected p_results format:
-- [
--   {
--     "result_id": "uuid",
--     "university_id": 123,
--     "university_name": "Oxford",
--     "course_name": "Computer Science BSc",
--     "course_url": "https://...",
--     "source_domain": "ox.ac.uk"
--   },
--   ...
-- ]
--
-- Returns: JSONB object with:
-- {
--   "success": true,
--   "applications_created": [
--     {
--       "application_id": "uuid",
--       "course_name": "...",
--       "course_url": "...",
--       "parse_job_id": "uuid"
--     },
--     ...
--   ]
-- }
--
-- Error handling: If any operation fails, the entire transaction is rolled back.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.add_selected_courses_to_apply(
  p_user_id UUID,
  p_session_id UUID,
  p_results JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Run with function owner's permissions (allows insert even with RLS)
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_application_id UUID;
  v_applications JSONB := '[]'::JSONB;
  v_count INT := 0;
BEGIN
  -- Validate inputs
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id cannot be null';
  END IF;
  
  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'session_id cannot be null';
  END IF;
  
  IF p_results IS NULL OR jsonb_array_length(p_results) = 0 THEN
    RAISE EXCEPTION 'results array cannot be null or empty';
  END IF;

  -- Iterate over each result and create application + source + parse job
  FOR v_result IN SELECT * FROM jsonb_array_elements(p_results)
  LOOP
    -- Extract fields from result object
    DECLARE
      v_result_id UUID := (v_result->>'result_id')::UUID;
      v_university_id BIGINT := (v_result->>'university_id')::BIGINT;
      v_university_name TEXT := v_result->>'university_name';
      v_course_name TEXT := v_result->>'course_name';
      v_course_url TEXT := v_result->>'course_url';
      v_source_domain TEXT := v_result->>'source_domain';
      v_parse_job_id UUID;
    BEGIN
      -- 1. Create course_applications record
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
        p_user_id,
        v_university_id,
        v_university_name,
        v_course_name,
        v_course_url,
        'researching', -- Initial status
        'pending',     -- Parse will be triggered via job queue
        0,             -- No progress yet
        NOW(),
        NOW()
      )
      RETURNING id INTO v_application_id;

      -- 2. Create application_sources record
      INSERT INTO public.application_sources (
        application_id,
        university_id,
        source_type,
        title,
        url,
        source_domain,
        display_priority,
        is_official,
        confidence,
        validation_status,
        created_at,
        updated_at
      )
      VALUES (
        v_application_id,
        v_university_id,
        'official_course_page',
        v_course_name || ' - Official Course Page',
        v_course_url,
        v_source_domain,
        1, -- High priority for official course page
        true, -- This is an official source
        0.9, -- High confidence from search provider
        'pending', -- Will be validated by parser
        NOW(),
        NOW()
      );

      -- 3. Create course_parse_jobs record
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
        v_course_url,
        v_university_id,
        'pending',
        0,
        3, -- Allow up to 3 retry attempts
        NOW(), -- Job is immediately claimable
        NOW(),
        NOW()
      )
      RETURNING id INTO v_parse_job_id;

      -- 4. Mark session result as selected
      UPDATE public.course_search_session_results
      SET 
        selected = true,
        selected_at = NOW(),
        selected_application_id = v_application_id,
        updated_at = NOW()
      WHERE id = v_result_id;

      -- Add to results array
      v_applications := v_applications || jsonb_build_object(
        'application_id', v_application_id,
        'course_name', v_course_name,
        'course_url', v_course_url,
        'parse_job_id', v_parse_job_id,
        'parse_status', 'pending'
      );

      v_count := v_count + 1;
    END;
  END LOOP;

  -- Return success response
  RETURN jsonb_build_object(
    'success', true,
    'applications_created', v_applications,
    'count', v_count
  );

EXCEPTION
  WHEN OTHERS THEN
    -- On any error, rollback the transaction (PostgreSQL does this automatically)
    -- and return error details
    RAISE EXCEPTION 'Failed to add courses: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$$;

-- ============================================================================
-- Permissions
-- ============================================================================
-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.add_selected_courses_to_apply(UUID, UUID, JSONB) TO authenticated;

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON FUNCTION public.add_selected_courses_to_apply(UUID, UUID, JSONB) IS
'Atomically creates course applications with sources and parse jobs for selected search results. All operations occur in a single transaction for ACID guarantees.';

-- ============================================================================
-- Usage Example
-- ============================================================================
-- SELECT public.add_selected_courses_to_apply(
--   'user-uuid-here'::UUID,
--   'session-uuid-here'::UUID,
--   '[
--     {
--       "result_id": "result-uuid-1",
--       "university_id": 123,
--       "university_name": "University of Oxford",
--       "course_name": "Computer Science BSc",
--       "course_url": "https://www.ox.ac.uk/admissions/undergraduate/courses/computer-science",
--       "source_domain": "ox.ac.uk"
--     }
--   ]'::JSONB
-- );
