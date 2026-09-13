-- ============================================================================
-- Course Parse Reliability: Phase Tracking & Watchdog Indexes
-- ============================================================================
-- Additive migration for course parse job watchdog and granular phase tracking.
--
-- NOTE: Existing `sql/supabase-job-claim-resilience.sql` is a historical migration
-- and remains unmodified. This file is purely additive and idempotent.
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
