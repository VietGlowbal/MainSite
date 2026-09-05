-- ============================================================================
-- Idempotency Keys Table for Request Deduplication
-- ============================================================================
-- Task 1.4 & 13.8: Create idempotency_keys table
--
-- This table stores idempotency keys for API requests to prevent duplicate
-- operations from double-click submissions or network retries.
--
-- Key format (recommended): SHA-256 hash of request-specific data
-- Example: SHA-256("${sessionId}:${sortedResultIds.join(',')}")
--
-- TTL: Keys are valid for 24 hours. Older keys are ignored by application logic.
-- ============================================================================

-- Drop existing table if recreating (development only)
-- DROP TABLE IF EXISTS public.idempotency_keys CASCADE;

CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User making the request
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- API endpoint path (e.g., '/api/apply-shortlist/add-courses')
  endpoint TEXT NOT NULL,
  
  -- Idempotency key (SHA-256 hash or user-provided string)
  key TEXT NOT NULL,
  
  -- Cached response body (stored as JSONB for flexibility)
  response_body JSONB NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Composite unique constraint: one key per user per endpoint
  CONSTRAINT unique_idempotency_key UNIQUE (user_id, endpoint, key)
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

-- Primary lookup: check if key exists for user/endpoint combination
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_lookup 
  ON public.idempotency_keys(user_id, endpoint, key);

-- Cleanup queries: find old keys to delete (optional background job)
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created_at 
  ON public.idempotency_keys(created_at);

-- ── Row Level Security (RLS) ─────────────────────────────────────────────────

ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Users can only read their own idempotency keys
CREATE POLICY "Users can read their own idempotency keys"
  ON public.idempotency_keys
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own idempotency keys (via upsert in API)
CREATE POLICY "Users can insert their own idempotency keys"
  ON public.idempotency_keys
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own idempotency keys (via upsert in API)
CREATE POLICY "Users can update their own idempotency keys"
  ON public.idempotency_keys
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own idempotency keys (optional, for cleanup)
CREATE POLICY "Users can delete their own idempotency keys"
  ON public.idempotency_keys
  FOR DELETE
  USING (auth.uid() = user_id);

-- ── Comments ─────────────────────────────────────────────────────────────────

COMMENT ON TABLE public.idempotency_keys IS 
  'Stores idempotency keys for API requests to prevent duplicate operations from double-click submissions or network retries. Keys are valid for 24 hours.';

COMMENT ON COLUMN public.idempotency_keys.user_id IS 
  'User who made the original request';

COMMENT ON COLUMN public.idempotency_keys.endpoint IS 
  'API endpoint path (e.g., /api/apply-shortlist/add-courses)';

COMMENT ON COLUMN public.idempotency_keys.key IS 
  'Idempotency key (SHA-256 hash or user-provided string). Recommended format: SHA-256(sessionId:sortedResultIds)';

COMMENT ON COLUMN public.idempotency_keys.response_body IS 
  'Cached response body returned for duplicate requests within 24-hour window';

COMMENT ON COLUMN public.idempotency_keys.created_at IS 
  'First time this key was stored';

COMMENT ON COLUMN public.idempotency_keys.updated_at IS 
  'Last time this key was updated (for upsert operations)';

-- ── Optional: Cleanup Function ───────────────────────────────────────────────
-- 
-- You can create a periodic job (pg_cron or external scheduler) to delete
-- keys older than 24 hours to keep the table size manageable.
--
-- Example cleanup function:
--
-- CREATE OR REPLACE FUNCTION cleanup_old_idempotency_keys()
-- RETURNS void
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- AS $$
-- BEGIN
--   DELETE FROM public.idempotency_keys
--   WHERE created_at < NOW() - INTERVAL '24 hours';
-- END;
-- $$;
--
-- Schedule with pg_cron:
-- SELECT cron.schedule('cleanup-idempotency-keys', '0 * * * *', 'SELECT cleanup_old_idempotency_keys()');
