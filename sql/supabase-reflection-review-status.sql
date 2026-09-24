-- Reflection step 2 — review status and source provenance on achievements
-- and activities.
--
-- Run this against your Supabase project before shipping the rebuilt
-- achievements/activities page (the card-grid redesign of
-- /ai-strategy/reflection/achievements).
--
-- WHY THESE COLUMNS. The previous page was one big form the student filled in
-- by hand; every row it saved was, by definition, something the student
-- typed and stood behind. The rebuilt page auto-populates cards straight from
-- AI extraction, and an extracted card must never look as trusted as one the
-- student wrote themselves until they have actually looked at it — that is
-- the whole point of a "needs review" state.
--
--   review_status  'needs_review' while unconfirmed, 'reviewed' once the
--                   student has looked at it (via the one-at-a-time review
--                   flow, an edit, or an explicit "Keep"). NULL on every
--                   existing row is read as 'reviewed': everything already
--                   saved here was a student's own typed entry, and there is
--                   nothing to review about it.
--
--   source_type    'document' for anything that came from an uploaded PDF,
--                   'manual' for anything the student typed directly. NULL
--                   reads as 'manual' for the same reason NULL review_status
--                   reads as reviewed — every pre-existing row was typed.
--
--   sources        Which uploaded document(s) this was extracted from, and
--                   where — `[{ documentId, fileName, page, quote }, ...]`.
--                   Powers the card's "View source" action and, when two
--                   extractions describe the same achievement, the "Merge"
--                   action that unions this array rather than picking one
--                   side. JSONB rather than a join table: the array is
--                   written and read whole by the same form that owns the
--                   row, capped at 6 entries by the application schema, and
--                   a join table would buy nothing but a second RLS surface.
--
-- No CHECK constraint on review_status/source_type beyond the enum: the
-- application's zod schema is the source of truth for the value set, and a
-- CHECK here would need updating in lockstep with it for no real safety gain
-- — nothing but this feature ever writes these two columns.

ALTER TABLE public.student_achievements
  ADD COLUMN IF NOT EXISTS review_status TEXT
    CHECK (review_status IN ('needs_review', 'reviewed')),
  ADD COLUMN IF NOT EXISTS source_type TEXT
    CHECK (source_type IN ('document', 'manual')),
  ADD COLUMN IF NOT EXISTS sources JSONB;

ALTER TABLE public.student_activities
  ADD COLUMN IF NOT EXISTS review_status TEXT
    CHECK (review_status IN ('needs_review', 'reviewed')),
  ADD COLUMN IF NOT EXISTS source_type TEXT
    CHECK (source_type IN ('document', 'manual')),
  ADD COLUMN IF NOT EXISTS sources JSONB;

COMMENT ON COLUMN public.student_achievements.review_status IS
  'needs_review | reviewed. NULL (pre-existing rows) reads as reviewed.';
COMMENT ON COLUMN public.student_achievements.source_type IS
  'document | manual. NULL (pre-existing rows) reads as manual.';
COMMENT ON COLUMN public.student_achievements.sources IS
  '[{ documentId, fileName, page, quote }, ...] — which uploaded document(s) this came from.';

COMMENT ON COLUMN public.student_activities.review_status IS
  'needs_review | reviewed. NULL (pre-existing rows) reads as reviewed.';
COMMENT ON COLUMN public.student_activities.source_type IS
  'document | manual. NULL (pre-existing rows) reads as manual.';
COMMENT ON COLUMN public.student_activities.sources IS
  '[{ documentId, fileName, page, quote }, ...] — which uploaded document(s) this came from.';
