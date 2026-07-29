-- ============================================================================
-- Parse state on course_applications
-- ============================================================================
-- Two columns the application code already depends on but which are not in any
-- committed schema file:
--
--   parse_status  Written by add_selected_courses_to_apply, by
--                 /api/applications/from-course-url, and by the parse worker.
--                 Read by /api/applications/[id]/parse-status. It exists on the
--                 live database; this file is what should have created it.
--
--   parse_error   New. The worker needs somewhere to put a reason the student
--                 can act on ("that page is blocking automated visits") rather
--                 than leaving the row saying "Loading course details..."
--                 forever, which is what it did before.
--
-- Idempotent, so it is safe to re-run against a database that already has
-- parse_status.
-- ============================================================================

ALTER TABLE public.course_applications
  ADD COLUMN IF NOT EXISTS parse_status TEXT DEFAULT 'pending';

ALTER TABLE public.course_applications
  ADD COLUMN IF NOT EXISTS parse_error TEXT;

-- Drop first so the constraint definition below is authoritative on re-run.
ALTER TABLE public.course_applications
  DROP CONSTRAINT IF EXISTS course_applications_parse_status_check;

ALTER TABLE public.course_applications
  ADD CONSTRAINT course_applications_parse_status_check
  CHECK (parse_status IN ('pending', 'processing', 'complete', 'failed'));

COMMENT ON COLUMN public.course_applications.parse_status IS
  'Lifecycle of the background course-page extraction for this application.';

COMMENT ON COLUMN public.course_applications.parse_error IS
  'Student-facing reason the extraction failed. Null while pending or on success.';

-- The apply list filters to the rows still being worked on so it knows whether
-- to keep polling; without this it sequential-scans the whole table per poll.
CREATE INDEX IF NOT EXISTS idx_course_applications_parse_status
  ON public.course_applications(user_id, parse_status)
  WHERE parse_status IN ('pending', 'processing');
