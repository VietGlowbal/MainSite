-- ============================================================================
-- Course Parse Reliability: Phase Tracking & Watchdog Indexes
-- ============================================================================
-- Additive migration for course parse job watchdog and granular phase tracking.
-- All changes are idempotent and backward-compatible with existing schema.

-- 1. Add nullable phase column to course_parse_jobs if not exists
ALTER TABLE public.course_parse_jobs
  ADD COLUMN IF NOT EXISTS phase TEXT DEFAULT 'queued';

COMMENT ON COLUMN public.course_parse_jobs.phase IS
  'Fine-grained execution phase: queued, fetching, extracting, validating, ready, timeout, failed.';

-- 2. Index for watchdog/reaper query on stale processing jobs
CREATE INDEX IF NOT EXISTS idx_course_parse_jobs_watchdog
  ON public.course_parse_jobs (status, updated_at)
  WHERE status = 'processing';
