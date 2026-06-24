-- ============================================================================
-- GLOWBAL — cached document text
-- ----------------------------------------------------------------------------
-- Adds `parsed_text` to uploaded_documents so the extracted plain text of a
-- CV / statement can be cached after the first read (see src/lib/ai/document-
-- text.ts), instead of re-downloading + re-parsing the file on every match
-- analysis. Run once in the Supabase SQL editor; idempotent.
-- ============================================================================

alter table public.uploaded_documents
  add column if not exists parsed_text text;
