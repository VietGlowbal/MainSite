-- The redesigned application setup flow: Review Profile -> Activities &
-- Achievements (each with its own Context/Motivation/Challenge/Action/
-- Impact/Transformation/Future reflection and an AI-generated Reflection
-- Card) -> Personal Reflection (five cross-cutting questions) -> Review &
-- Confirm.
--
-- Run this against your Supabase project before shipping the new flow. Every
-- reader that touches these columns degrades gracefully (tolerant
-- select-without-the-new-columns retry) until it has run — see
-- `docs/known-issues.md §0` for why columns are always ADDed, never edited,
-- once shipped.
--
-- WHAT IS NOT A NEW TABLE, ON PURPOSE. The application-specific immutable
-- snapshot the spec asks for (`ApplicationSnapshot`) is NOT a new table —
-- `confirmed_candidate_snapshots.payload` (from
-- `supabase-candidate-confirmation.sql`) already stores the whole
-- `ReflectionValues` object as JSONB, one row per confirmation, append-only,
-- tagged per application by `supabase-per-application-onboarding.sql`. The
-- reflection/reflectionCard fields added below to `student_achievements`/
-- `student_activities`, and `personal_reflection_answers` added to
-- `student_profiles`, all flow into that same JSONB payload the moment they
-- are added to the `ReflectionValues` shape in
-- `src/features/apply/domain/reflection.ts` — no second snapshot schema to
-- keep in sync.

-- ── Activity-level reflection + AI Reflection Card ──────────────────────────
--
-- One JSONB pair per row rather than seven text columns per table (Context/
-- Motivation/.../Future) plus another six for the card: both shapes are
-- always read and written whole by the owner of the row, so a normalised
-- schema would buy nothing but migrations every time a card field changes.
-- Added to BOTH tables — `student_achievements` and `student_activities` —
-- because the spec's "Activities & Achievements" step treats both as one
-- "experiences" concept; which table a row lives in already encodes half of
-- the category mapping (`experienceCategoryFor` in
-- `src/features/apply/domain/activity-reflection.ts` does the rest).

ALTER TABLE public.student_achievements
  ADD COLUMN IF NOT EXISTS reflection JSONB,
  ADD COLUMN IF NOT EXISTS reflection_card JSONB,
  ADD COLUMN IF NOT EXISTS reflection_card_status TEXT
    CHECK (reflection_card_status IS NULL OR reflection_card_status IN ('generated', 'confirmed', 'edited')),
  ADD COLUMN IF NOT EXISTS reflection_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reflection_card_generated_at TIMESTAMPTZ;

ALTER TABLE public.student_activities
  ADD COLUMN IF NOT EXISTS reflection JSONB,
  ADD COLUMN IF NOT EXISTS reflection_card JSONB,
  ADD COLUMN IF NOT EXISTS reflection_card_status TEXT
    CHECK (reflection_card_status IS NULL OR reflection_card_status IN ('generated', 'confirmed', 'edited')),
  ADD COLUMN IF NOT EXISTS reflection_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reflection_card_generated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.student_achievements.reflection IS
  'Raw student answers to the seven reflection dimensions — {context, motivation, challenge, action, impact, transformation, future, updatedAt}. Never overwritten by the AI-generated card.';
COMMENT ON COLUMN public.student_achievements.reflection_card IS
  'AI-generated summary — {story, contributions[], evidence[], demonstratedSkills[{skill,evidence}], keyTakeaway, futureConnection, status}. Grounded in `reflection` only; see src/lib/ai/reflection-card-generation.ts.';
COMMENT ON COLUMN public.student_activities.reflection IS
  'Raw student answers to the seven reflection dimensions — {context, motivation, challenge, action, impact, transformation, future, updatedAt}. Never overwritten by the AI-generated card.';
COMMENT ON COLUMN public.student_activities.reflection_card IS
  'AI-generated summary — {story, contributions[], evidence[], demonstratedSkills[{skill,evidence}], keyTakeaway, futureConnection, status}. Grounded in `reflection` only; see src/lib/ai/reflection-card-generation.ts.';

-- ── Personal Reflection (five cross-cutting questions, once per student) ────
--
-- Same reasoning as `student_profiles.subject_motivations`: written and read
-- whole, always by the profile's owner, capped at five fixed keys — a table
-- would only add RLS policies to keep in step for no benefit.

ALTER TABLE public.student_profiles
  ADD COLUMN IF NOT EXISTS personal_reflection_answers JSONB,
  ADD COLUMN IF NOT EXISTS personal_reflection_completed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.student_profiles.personal_reflection_answers IS
  '{ q1: "...", q2: "...", q3: "...", q4: "...", q5: "...", q6: "...", q7: "..." } — see src/features/apply/domain/personal-reflection.ts. Global, reusable across every application, like achievements.';

-- ── Per-application Personal Reflection review flag ─────────────────────────
--
-- Mirrors `personal_summary_reviewed_at`/`achievements_reviewed_at` from
-- `supabase-per-application-onboarding.sql`: the underlying answers are
-- shared across every application, but whether THIS application has moved
-- past the Personal Reflection step is its own per-application fact.

ALTER TABLE public.course_applications
  ADD COLUMN IF NOT EXISTS personal_reflection_reviewed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.course_applications.personal_reflection_reviewed_at IS
  'Set by PATCH /api/reflection/personal when the seven Personal Reflection questions are saved for THIS application.';
