-- Reflection — the three questions the reports were already asking for.
-- Run this against your Supabase project before shipping the rebuilt
-- /ai-strategy/reflection flow.
--
-- WHY THESE THREE. `src/lib/ai/match-insights.ts` builds two of its prompt
-- inputs from columns nothing in reflection ever wrote:
--
--   careerDirection  ← student_profiles.career_interests / goals
--   personalContext  ← student_profiles.goals
--
-- and the F7 strategy report scores every candidate direction on a
-- `futureAlignment` dimension defined as "fit with the target programme and
-- career direction". For a student who never visited the separate /profile
-- pages, all of that arrived empty and the model was scoring future alignment
-- against a blank. Reflection is the one flow every student goes through, so
-- it is where the questions belong.
--
-- WHAT IS REUSED, NOT ADDED. `goals` already exists on the base schema and
-- `supabase-strategy-personal-summary.sql` already repurposed it as "Career
-- goals" for the unified profile editor. The career-goal question writes to
-- that same column rather than adding a second one — two columns for one fact
-- is how the reflection form and the profile editor end up disagreeing about
-- a student's plans. Only the two that genuinely had nowhere to live are new.

ALTER TABLE public.student_profiles
  -- Why this subject. Distinct from `goals` (where they want to end up):
  -- motivation is the reason for the choice, and the portrait's "driving
  -- force" section is built from it. Folding both into one column would make
  -- the prompt unable to tell a reason from a destination.
  ADD COLUMN IF NOT EXISTS study_motivation TEXT,

  -- When the student intends to start, e.g. "Autumn / Fall 2027".
  --
  -- TEXT, and deliberately NOT a date. The vocabulary students use is a term
  -- and a year, not a day, and the exact start date belongs to the programme
  -- rather than the applicant. `course_applications.intake` already stores the
  -- university's published intake per application; this is the student's own
  -- target across all of them, which is what the Planner and the strategy
  -- roadmap need in order to have any endpoint to plan back from.
  --
  -- Values come from INTAKE_TERMS in features/apply/domain/reflection.ts. No
  -- CHECK constraint: the list is reviewed as years go stale, and a student
  -- holding an intake that has just dropped off the list should keep the value
  -- until they next answer rather than have the write rejected. The form's
  -- `oneOf` narrowing already drops anything unrecognised on read.
  ADD COLUMN IF NOT EXISTS target_intake TEXT;
