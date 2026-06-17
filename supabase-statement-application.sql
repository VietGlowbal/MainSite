-- ============================================================================
-- Link personal statements to course applications
-- ============================================================================
-- The SOP / personal-statement feedback tool was originally scoped to the
-- "My Universities" shortlist (personal_statements.user_university_id).
-- The Apply journey works off course_applications (UUID) instead, so we add a
-- nullable application_id column. A statement now belongs to EITHER a shortlist
-- entry (user_university_id) OR an application (application_id).

ALTER TABLE public.personal_statements
  ADD COLUMN IF NOT EXISTS application_id UUID
  REFERENCES public.course_applications(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_personal_statements_application_id
  ON public.personal_statements(application_id);

-- user_university_id is already nullable in supabase-schema.sql, but make the
-- intent explicit for environments created before this change.
ALTER TABLE public.personal_statements
  ALTER COLUMN user_university_id DROP NOT NULL;
