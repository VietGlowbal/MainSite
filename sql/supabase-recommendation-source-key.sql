-- Feature 2 / Part 4 — deterministic identity for generated Planner tasks.
--
-- WHY. reconcileSeeds previously matched on (pillar, title) — but the title
-- is model-authored PROSE, so a regenerated Strategy Report that rewords a
-- task created a duplicate instead of updating in place. Every generated seed
-- now carries a deterministic semantic key,
--
--   strategy-roadmap::{phaseKey}::{deliverableKey}
--
-- derived from the F8 payload's schema-enforced slugs. Reconciliation prefers
-- this key; the legacy (pillar,title) match remains as fallback for rows
-- written before this column existed.

ALTER TABLE public.application_recommendations
  ADD COLUMN IF NOT EXISTS source_key TEXT;

CREATE INDEX IF NOT EXISTS idx_application_recommendations_source_key
  ON public.application_recommendations(application_id, source_key)
  WHERE source_key IS NOT NULL;

COMMENT ON COLUMN public.application_recommendations.source_key IS
  'Deterministic semantic identity of a generated seed (e.g. strategy-roadmap::{phase}::{deliverable}). Reconcile matches on this first; never an array index or raw prose.';
