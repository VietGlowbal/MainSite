-- ============================================================================
-- PHASE 15, TASK 15.1: Atomic Job Claiming for Course Parse Worker
-- ============================================================================
-- This file contains the PostgreSQL RPC function for atomically claiming
-- pending course parse jobs using FOR UPDATE SKIP LOCKED to prevent
-- race conditions between multiple workers.
--
-- Task Requirements:
-- - Atomic job claiming to prevent race conditions
-- - Uses FOR UPDATE SKIP LOCKED pattern
-- - Claims jobs WHERE status = 'pending' AND attempts < max_attempts
-- - Respects retry scheduling (next_attempt_at)
-- - Null-safe condition ensures new jobs are claimed immediately
-- ============================================================================

-- Drop existing function if it exists (for idempotent migrations)
DROP FUNCTION IF EXISTS public.claim_course_parse_jobs(
  worker_id TEXT,
  batch_size INT
);

-- ============================================================================
-- Function: claim_course_parse_jobs
-- ============================================================================
-- Atomically claims a batch of pending jobs for processing by a worker.
-- Uses FOR UPDATE SKIP LOCKED to ensure each job is claimed by exactly one
-- worker, even with multiple workers running concurrently.
--
-- Parameters:
--   worker_id     TEXT - Unique identifier for the worker claiming jobs
--   batch_size    INT  - Maximum number of jobs to claim
--
-- Returns: Array of job records with structure:
-- [
--   {
--     "id": "uuid",
--     "application_id": "uuid",
--     "course_url": "https://...",
--     "university_id": 123,
--     "status": "processing",
--     "attempts": 1,
--     "max_attempts": 3,
--     "started_at": "timestamp",
--     ...
--   },
--   ...
-- ]
--
-- Behavior:
-- - Claims jobs with status = 'pending'
-- - Only claims jobs with attempts < max_attempts
-- - Respects retry scheduling: (next_attempt_at IS NULL OR next_attempt_at <= NOW())
-- - Updates claimed jobs to status = 'processing'
-- - Increments attempts counter
-- - Sets started_at timestamp
-- - Clears next_attempt_at to prevent re-claiming
-- ============================================================================

CREATE OR REPLACE FUNCTION public.claim_course_parse_jobs(
  worker_id TEXT,
  batch_size INT DEFAULT 5
)
RETURNS SETOF course_parse_jobs
LANGUAGE plpgsql
SECURITY DEFINER -- Run with function owner's permissions
SET search_path = public
AS $$
DECLARE
  v_job_record course_parse_jobs;
BEGIN
  -- Validate inputs
  IF worker_id IS NULL OR worker_id = '' THEN
    RAISE EXCEPTION 'worker_id cannot be null or empty';
  END IF;
  
  IF batch_size IS NULL OR batch_size < 1 THEN
    RAISE EXCEPTION 'batch_size must be at least 1';
  END IF;

  -- Claim jobs atomically using FOR UPDATE SKIP LOCKED
  RETURN QUERY
  UPDATE course_parse_jobs
  SET 
    status = 'processing',
    attempts = attempts + 1,
    started_at = NOW(),
    next_attempt_at = NULL, -- Clear retry schedule
    updated_at = NOW()
  WHERE id IN (
    SELECT id
    FROM course_parse_jobs
    WHERE 
      status = 'pending'
      AND attempts < max_attempts
      AND (next_attempt_at IS NULL OR next_attempt_at <= NOW())
    ORDER BY created_at ASC -- FIFO: oldest jobs first
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED -- Atomic claiming, skip locked rows
  )
  RETURNING *;
END;
$$;

-- ============================================================================
-- Permissions
-- ============================================================================
-- Grant execute permission to service role (workers use service role key)
GRANT EXECUTE ON FUNCTION public.claim_course_parse_jobs(TEXT, INT) TO service_role;

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON FUNCTION public.claim_course_parse_jobs(TEXT, INT) IS
'Atomically claims pending course parse jobs for processing. Uses FOR UPDATE SKIP LOCKED to prevent race conditions between multiple workers.';

-- ============================================================================
-- Usage Example
-- ============================================================================
-- -- Claim up to 5 jobs for worker-01
-- SELECT * FROM public.claim_course_parse_jobs('worker-01', 5);
--
-- -- Claimed jobs will have:
-- -- - status changed from 'pending' to 'processing'
-- -- - attempts incremented
-- -- - started_at set to NOW()
-- -- - next_attempt_at cleared
