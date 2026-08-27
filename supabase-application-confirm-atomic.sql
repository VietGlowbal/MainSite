-- Atomic application confirmation follow-up migration.
-- Run after supabase-candidate-confirmation.sql,
-- supabase-per-application-onboarding.sql, and
-- supabase-application-personal-report-state.sql.
--
-- The route supplies the already validated, immutable snapshot payload. The
-- function locks the application row, re-checks confirmation state, appends
-- exactly one revision, and sets the per-application lock in one transaction.

CREATE OR REPLACE FUNCTION public.confirm_application_candidate_snapshot(
  p_application_id UUID,
  p_payload JSONB,
  p_payload_hash TEXT,
  p_confirmed_at TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE (snapshot_id UUID, confirmed_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_existing_confirmed_at TIMESTAMPTZ;
  v_previous_snapshot_id UUID;
  v_saved_confirmed_at TIMESTAMPTZ;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT ca.candidate_confirmed_at
    INTO v_existing_confirmed_at
    FROM public.course_applications AS ca
   WHERE ca.id = p_application_id
     AND ca.user_id = v_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found' USING ERRCODE = 'P0001';
  END IF;

  IF v_existing_confirmed_at IS NOT NULL THEN
    SELECT s.id, s.confirmed_at
      INTO snapshot_id, v_saved_confirmed_at
      FROM public.confirmed_candidate_snapshots AS s
     WHERE s.user_id = v_user_id
       AND s.application_id = p_application_id
     ORDER BY s.confirmed_at DESC
     LIMIT 1;
    confirmed_at := v_saved_confirmed_at;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT s.id
    INTO v_previous_snapshot_id
    FROM public.confirmed_candidate_snapshots AS s
   WHERE s.user_id = v_user_id
     AND s.application_id = p_application_id
   ORDER BY s.confirmed_at DESC
   LIMIT 1;

  INSERT INTO public.confirmed_candidate_snapshots (
    user_id,
    application_id,
    payload,
    schema_version,
    confirmed_at,
    payload_hash,
    supersedes_snapshot_id
  ) VALUES (
    v_user_id,
    p_application_id,
    p_payload,
    2,
    p_confirmed_at,
    p_payload_hash,
    v_previous_snapshot_id
  )
  RETURNING id, confirmed_at INTO snapshot_id, v_saved_confirmed_at;
  confirmed_at := v_saved_confirmed_at;

  UPDATE public.course_applications
     SET candidate_confirmed_at = p_confirmed_at
   WHERE id = p_application_id
     AND user_id = v_user_id;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_application_candidate_snapshot(UUID, JSONB, TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_application_candidate_snapshot(UUID, JSONB, TEXT, TIMESTAMPTZ) TO authenticated;
