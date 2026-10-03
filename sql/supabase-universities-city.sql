-- Add the optional city used by scholarship candidate valuation contexts.
-- Apply in the intended project's Supabase SQL Editor, per repository convention.
-- Existing rows remain NULL; this does not infer or backfill city data.
-- No changes to grants, RLS, indexes, scholarship policy, or application code.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE public.universities
  ADD COLUMN IF NOT EXISTS city TEXT;

-- IF NOT EXISTS does not validate an existing column's type or nullability.
-- Fail instead of silently accepting a conflicting schema or altering its data.
DO $universities_city_guard$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'universities'
      AND column_name = 'city'
      AND data_type = 'text'
      AND is_nullable = 'YES'
      AND column_default IS NULL
  ) THEN
    RAISE EXCEPTION 'Expected public.universities.city to be nullable TEXT without a default';
  END IF;
END;
$universities_city_guard$;

NOTIFY pgrst, 'reload schema';

COMMIT;
