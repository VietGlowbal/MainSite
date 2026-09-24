-- AI Strategy Dashboard — real onboarding-completion state.
-- Run after supabase-strategy-dashboard.sql / supabase-strategy-personal-summary.sql.
--
-- See .kiro/specs/ai-strategy-dashboard/requirements.md Requirement 1.2-1.3,
-- 15.4.
--
-- WHAT THIS REPLACES. The first pass approximated "has this student done
-- onboarding" with "do they have at least one student_achievements or
-- student_activities row" (`fetchStrategyOnboardingStatus`). That's wrong in
-- both directions: a student who genuinely has zero achievements can never
-- satisfy it (so they can never finish onboarding, per the spec's own
-- Requirement 4.3, which lets Achievements be completed empty), and a
-- student who added one activity years ago via a completely different flow
-- satisfies it without ever having seen the Personal Summary editor this
-- spec describes. Neither is what "onboarding complete" should mean.
--
-- Personal Summary and Achievements completion live on student_profiles
-- (shared across every Strategy, same as the data itself — Requirement
-- 15.2). AI Analysis completion needs no new column: an applicant_analyses
-- row existing for the application already means it ran. Strategy
-- Introduction is the one step that's genuinely per-Strategy rather than
-- shared, so it lives on course_applications.

ALTER TABLE public.student_profiles
  ADD COLUMN IF NOT EXISTS personal_summary_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS achievements_completed_at      TIMESTAMPTZ;

ALTER TABLE public.course_applications
  ADD COLUMN IF NOT EXISTS strategy_intro_seen_at TIMESTAMPTZ;
