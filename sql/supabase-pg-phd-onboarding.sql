-- PG/PhD Onboarding Branching — Additive fields for postgraduate and PhD academic profiles.
-- Run after supabase-academic-intake.sql and supabase-onboarding-responses.sql.
--
-- Backward-compatible: all columns are nullable JSONB.
-- Existing undergraduate rows and all existing consumers remain intact.
--
-- Undergraduate academic data continues to live in:
--   student_profiles.curriculum (TEXT[])
--   student_profiles.curriculum_grades (JSONB)
--   student_profiles.gpa_scale (TEXT)
--   student_profiles.gpa_value (NUMERIC)
--   student_profiles.graduation_year (INTEGER)
--
-- Postgraduate academic data lives in:
--   student_profiles.postgraduate_academic (JSONB):
--     {
--       "degree": "Bachelor of Science",
--       "institution": "University Name",
--       "field_of_study": "Computer Science",
--       "gpa_scale": "4.0 scale",
--       "gpa": "3.8",
--       "classification": "First Class Honours",
--       "completion_year": "2024"
--     }
--   With projection to current_institution, current_qualification, graduation_year,
--   gpa_scale, gpa_value where applicable.
--
-- PhD academic and research data lives in:
--   student_profiles.phd_academic (JSONB):
--     {
--       "bachelor_degree": "BSc in Mathematics, University of Tokyo",
--       "master_degree": "MSc in Computer Science, Stanford",
--       "institution": "Current / Latest Institution",
--       "research_experience": "Published 2 papers at ...",
--       "publications": "...",
--       "research_direction": "Reinforcement learning for healthcare ...",
--       "supervisor_fit": "Dr. Smith group alignment ..."
--     }
--   With projection to current_institution, current_qualification, academic_background.

ALTER TABLE public.student_profiles
  ADD COLUMN IF NOT EXISTS postgraduate_academic JSONB,
  ADD COLUMN IF NOT EXISTS phd_academic JSONB;

COMMENT ON COLUMN public.student_profiles.postgraduate_academic IS
  'Additive structured academic data for postgraduate applicants (bachelor degree, institution, field of study, GPA/classification, completion timing).';

COMMENT ON COLUMN public.student_profiles.phd_academic IS
  'Additive structured research and academic history for PhD applicants (bachelor/master history, research experience, publications, research direction, supervisor fit context).';
