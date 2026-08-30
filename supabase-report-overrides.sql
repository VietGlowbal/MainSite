-- Feature 2 / Part 4 — student-authored overrides for generated report content.
--
-- WHY A NEW TABLE. The Strategic Priority Table is applicant-editable
-- (`docs/strategy-reports-spec.md`, decision 5). Regeneration rewrites
-- `report_v2`, so edits must NOT live inside it — they key on the payload's
-- stable item keys and layer on top at render time:
--
--   effective value = student override ?? generated base value
--
-- Matching stable keys survive regeneration; new generated rows simply have
-- no override; retired rows leave historical edits in place rather than
-- deleting user work.

CREATE TABLE IF NOT EXISTS public.application_report_overrides (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES course_applications(id) ON DELETE CASCADE,

  -- Which report family this belongs to ('strategy_f8' or 'strategy_v3';
  -- namespaced so future editable reports do not collide).
  report_kind   TEXT NOT NULL DEFAULT 'strategy_f8',

  -- Stable semantic identity of the edited item (e.g. a V3 priority key)
  -- plus the field within it. Never an array index.
  item_key      TEXT NOT NULL,
  field         TEXT NOT NULL,
  value         JSONB,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (application_id, report_kind, item_key, field)
);

ALTER TABLE public.application_report_overrides ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'application_report_overrides'
      AND policyname = 'application_report_overrides_owner'
  ) THEN
    CREATE POLICY "application_report_overrides_owner"
      ON public.application_report_overrides
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_report_overrides_application
  ON public.application_report_overrides(application_id, report_kind);
