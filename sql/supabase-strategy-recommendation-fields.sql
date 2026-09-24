-- AI Strategy Dashboard — recommendation-engine correctness fields.
-- Run after supabase-strategy-dashboard.sql, before shipping the fixed
-- recommendation generator (fix/recommendation-engine-correctness).
--
-- See .kiro/specs/ai-strategy-dashboard/requirements.md Requirement 10 and
-- design.md's recommendation-generator section.
--
-- WHY THIS IS A SEPARATE FILE, NOT AN EDIT TO supabase-strategy-dashboard.sql.
-- That migration already shipped (merged in #110/#112) and may already be
-- applied against a live database; editing it after the fact would make a
-- second `ADD COLUMN IF NOT EXISTS` run against an already-migrated database
-- silently do nothing new, while a fresh database run from the edited file
-- would look identical to one that ran the original — two different
-- histories that happen to converge, which is exactly the kind of migration
-- drift `docs/known-issues.md §0` warns about. A new file makes "what ran,
-- when" traceable the same way every other `supabase-*.sql` file here does.
--
-- WHAT THIS FIXES. The first pass of the recommendation generator
-- (`recommendationFromImprovementAction`) computed `estimatedImpact` and
-- `pillar` in memory but never persisted either — the columns didn't exist,
-- so `POST .../strategy/recommendations` silently dropped them and every
-- row read them back as null forever. It also had no way to tell "this row
-- came from that analysis run", which is what reconciling on a re-run
-- needs: without it, a regenerate can only append or skip by title, never
-- update a changed recommendation or retire one that's no longer relevant.

ALTER TABLE application_recommendations
  ADD COLUMN IF NOT EXISTS estimated_impact  INT CHECK (estimated_impact IS NULL OR estimated_impact BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS pillar             TEXT,
  -- Which Course Match Analysis run produced this row. Nullable: the
  -- pre-existing "sidebar tip" rows (category IS NULL) never had one and
  -- never will.
  ADD COLUMN IF NOT EXISTS source_analysis_id UUID
    REFERENCES application_match_analyses(id) ON DELETE SET NULL,
  -- Archived, not deleted: a recommendation the latest analysis no longer
  -- produces is retired here rather than dropped, so completed work stays
  -- in the record and nothing needs to be recreated from scratch if it
  -- becomes relevant again. NULL = active; every list query in the app
  -- filters WHERE archived_at IS NULL.
  ADD COLUMN IF NOT EXISTS archived_at        TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_application_recommendations_source_analysis
  ON application_recommendations(source_analysis_id);
CREATE INDEX IF NOT EXISTS idx_application_recommendations_archived
  ON application_recommendations(application_id, archived_at);
