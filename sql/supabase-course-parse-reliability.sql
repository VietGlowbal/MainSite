-- ============================================================================
-- Course Parse Reliability: Phase Tracking & Watchdog Indexes
-- ============================================================================
-- Additive migration for course parse job watchdog and granular phase tracking.
--
-- NOTE: Existing `sql/supabase-job-claim-resilience.sql` is a historical
-- prerequisite and must run before this file so `locked_by` exists before the
-- claim function is replaced. Do not rerun the older claim script after the
-- resilience or reliability migrations: doing so would restore started_at-only
-- stale semantics and remove the latest heartbeat-aware claim behavior.
--
-- All changes are safe, nullable, and backward-compatible with existing schemas:
-- - `phase` is nullable with NO default, ensuring historical or in-flight
--   processing jobs are not backfilled with a false 'queued' state.
-- - Partial index `idx_course_parse_jobs_watchdog` optimizes stale lease sweeps.
-- ============================================================================

-- 1. Add nullable phase column to course_parse_jobs if not exists (no default)
ALTER TABLE public.course_parse_jobs
  ADD COLUMN IF NOT EXISTS phase TEXT;

COMMENT ON COLUMN public.course_parse_jobs.phase IS
  'Fine-grained execution phase: queued, fetching, extracting, validating, ready, timeout, failed.';

-- 2. Index for watchdog/reaper query on stale processing jobs
CREATE INDEX IF NOT EXISTS idx_course_parse_jobs_watchdog
  ON public.course_parse_jobs (status, updated_at)
  WHERE status = 'processing';

-- 3. One authoritative stale-lease clock
--
-- `updated_at` is the worker heartbeat. `started_at` is retained only as a
-- fallback for legacy rows that predate reliable heartbeat writes. The claim
-- RPC and the application reaper must use the same effective activity time;
-- otherwise a live worker can be reclaimed merely because its original claim
-- is old. This replaces the function body without dropping any data or
-- changing its existing return contract.
CREATE INDEX IF NOT EXISTS idx_course_parse_jobs_stale_activity
  ON public.course_parse_jobs (updated_at, started_at)
  WHERE status = 'processing';

CREATE OR REPLACE FUNCTION public.claim_course_parse_jobs(
  worker_id TEXT,
  batch_size INT DEFAULT 5
)
RETURNS SETOF public.course_parse_jobs
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

  -- A gateway timeout can hide a successful claim. Return this worker's
  -- existing lease before attempting to claim more work, as the historical
  -- resilience RPC did.
  RETURN QUERY
  SELECT *
  FROM public.course_parse_jobs
  WHERE status = 'processing' AND locked_by = worker_id
  ORDER BY COALESCE(updated_at, started_at) ASC
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
    phase = 'fetching',
    updated_at = NOW()
  WHERE id IN (
    SELECT id
    FROM public.course_parse_jobs
    WHERE (
      (status = 'pending' AND (next_attempt_at IS NULL OR next_attempt_at <= NOW()))
      OR (
        status = 'processing'
        AND COALESCE(updated_at, started_at) < NOW() - INTERVAL '10 minutes'
      )
    )
      AND attempts < max_attempts
    ORDER BY COALESCE(updated_at, started_at) ASC NULLS FIRST, created_at ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;

COMMENT ON FUNCTION public.claim_course_parse_jobs(TEXT, INT) IS
'Atomically claims course parse jobs. Stale processing leases are measured by the latest updated_at heartbeat, falling back to started_at only for legacy rows.';

-- Preserve the worker-only execution boundary when this replacement is run on
-- a database whose historical ACLs were incomplete.  The claim RPC must never
-- be callable by browser roles.
REVOKE ALL ON FUNCTION public.claim_course_parse_jobs(TEXT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_course_parse_jobs(TEXT, INT) TO service_role;
