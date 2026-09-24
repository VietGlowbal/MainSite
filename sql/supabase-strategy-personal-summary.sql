-- Personal Summary — the additional student_profiles columns V2's unified
-- profile editor needs beyond what the existing reflection flow already
-- covers. Run after supabase-strategy-dashboard.sql, before shipping
-- /ai-strategy/[applicationId]/strategy/personal-summary.
--
-- See .kiro/specs/ai-strategy-dashboard/requirements.md Requirement 3.
--
-- WHAT IS REUSED, NOT ADDED HERE. `student_profiles` already has columns for
-- roughly half of Requirement 3.2's fields, via supabase-reflection.sql /
-- supabase-profile-extensions.sql / the base schema:
--   nationality, current_qualification (Qualification type), grades_summary
--   (gpa/ielts), target_subjects (Preferred subjects), preferred_countries
--   (Countries), budget_range/tuition_budget_usd (Budget), predicted_grades,
--   goals (repurposed as Career goals — see below).
-- This migration adds only the fields that genuinely had nowhere to live.
--
-- `goals` (base schema, previously untyped free text with no consumer) is
-- reused as University Preferences → Career goals rather than adding a
-- second column, the same call `student_activities`/`grades_summary` already
-- made for fields that already existed under a slightly different name.

ALTER TABLE public.student_profiles
  -- Personal Details
  ADD COLUMN IF NOT EXISTS country               TEXT,   -- country of residence; distinct from preferred_countries (target study countries)
  ADD COLUMN IF NOT EXISTS languages              TEXT[],
  ADD COLUMN IF NOT EXISTS age                     INT CHECK (age IS NULL OR (age BETWEEN 10 AND 100)),

  -- Education
  ADD COLUMN IF NOT EXISTS school_name             TEXT,
  ADD COLUMN IF NOT EXISTS current_year            TEXT,   -- free text ("Year 12", "Grade 11"): school-year vocabulary does not generalise across systems
  ADD COLUMN IF NOT EXISTS current_subjects        TEXT[], -- subjects studied now; distinct from target_subjects (the major applied for)

  -- University Preferences
  ADD COLUMN IF NOT EXISTS study_style             TEXT,

  -- Interests — which areas the student wants surfaced, not the structured
  -- records themselves (those are student_achievements/student_activities).
  ADD COLUMN IF NOT EXISTS interest_areas          TEXT[],

  -- Learning Style — multi-select, requirements.md 3.2
  ADD COLUMN IF NOT EXISTS learning_style          TEXT[],

  -- Personal Statement Questions — one JSONB blob rather than four columns,
  -- matching the grades_summary precedent already on this table.
  ADD COLUMN IF NOT EXISTS personal_statement_answers JSONB DEFAULT '{}'::JSONB;
