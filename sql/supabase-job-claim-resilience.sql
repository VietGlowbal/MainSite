-- Follow-up resilience migration for the durable job-claim RPCs.
-- Run once in the Supabase SQL editor before deploying the accompanying code.

ALTER TABLE public.course_parse_jobs
  ADD COLUMN IF NOT EXISTS locked_by TEXT;

CREATE INDEX IF NOT EXISTS idx_course_parse_jobs_claimable
  ON public.course_parse_jobs (next_attempt_at, created_at)
  WHERE status = 'pending' AND attempts < max_attempts;

CREATE INDEX IF NOT EXISTS idx_course_parse_jobs_stale_lease
  ON public.course_parse_jobs (started_at)
  WHERE status = 'processing';

CREATE INDEX IF NOT EXISTS idx_application_personal_report_generation_jobs_stale_lease
  ON public.application_personal_report_generation_jobs (locked_at)
  WHERE status = 'processing';

CREATE OR REPLACE FUNCTION public.claim_course_parse_jobs(
  worker_id TEXT,
  batch_size INT DEFAULT 5
)
RETURNS SETOF course_parse_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF worker_id IS NULL OR worker_id = '' THEN
    RAISE EXCEPTION 'worker_id cannot be null or empty';
  END IF;
  IF batch_size IS NULL OR batch_size < 1 THEN
    RAISE EXCEPTION 'batch_size must be at least 1';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(worker_id));

  RETURN QUERY
  SELECT *
  FROM public.course_parse_jobs
  WHERE status = 'processing' AND locked_by = worker_id
  ORDER BY started_at ASC
  LIMIT batch_size;
  IF FOUND THEN RETURN; END IF;

  RETURN QUERY
  UPDATE public.course_parse_jobs
  SET
    status = 'processing',
    attempts = attempts + 1,
    started_at = NOW(),
    next_attempt_at = NULL,
    locked_by = worker_id,
    updated_at = NOW()
  WHERE id IN (
    SELECT id
    FROM public.course_parse_jobs
    WHERE (
      (status = 'pending' AND (next_attempt_at IS NULL OR next_attempt_at <= NOW()))
      OR (status = 'processing' AND started_at < NOW() - INTERVAL '10 minutes')
    )
      AND attempts < max_attempts
    ORDER BY created_at ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_application_personal_report_generation_jobs(
  p_worker_id TEXT,
  p_batch_size INTEGER DEFAULT 1
)
RETURNS SETOF public.application_personal_report_generation_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_worker_id IS NULL OR p_worker_id = '' THEN
    RAISE EXCEPTION 'worker_id cannot be null or empty';
  END IF;
  IF p_batch_size IS NULL OR p_batch_size < 1 OR p_batch_size > 10 THEN
    RAISE EXCEPTION 'batch_size must be between 1 and 10';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_worker_id));

  RETURN QUERY
  SELECT *
  FROM public.application_personal_report_generation_jobs
  WHERE status = 'processing' AND locked_by = p_worker_id
  ORDER BY locked_at ASC
  LIMIT p_batch_size;
  IF FOUND THEN RETURN; END IF;

  RETURN QUERY
  UPDATE public.application_personal_report_generation_jobs
  SET
    status = 'processing',
    attempts = attempts + 1,
    locked_at = NOW(),
    locked_by = p_worker_id,
    next_attempt_at = NOW() + INTERVAL '10 minutes',
    updated_at = NOW()
  WHERE id IN (
    SELECT id
    FROM public.application_personal_report_generation_jobs
    WHERE (
      (status IN ('pending', 'retry') AND next_attempt_at <= NOW())
      OR (status = 'processing' AND locked_at < NOW() - INTERVAL '10 minutes')
    )
      AND attempts < 6
    ORDER BY next_attempt_at ASC, created_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_course_parse_jobs(TEXT, INT) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_course_parse_jobs(TEXT, INT) TO service_role;
REVOKE ALL ON FUNCTION public.claim_application_personal_report_generation_jobs(TEXT, INTEGER) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_application_personal_report_generation_jobs(TEXT, INTEGER) TO service_role;
