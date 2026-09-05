-- Additive repair for programme target-profile cache lineage.
-- Existing migrations are immutable; run this once in Supabase SQL editor.
alter table if exists public.programme_target_profile_versions
  add column if not exists schema_version text;

alter table if exists public.programme_target_profile_versions
  add column if not exists extraction_prompt_version text;

create index if not exists programme_target_profile_versions_cache_identity_idx
  on public.programme_target_profile_versions (programme_id, scholarship_key, source_fingerprint, schema_version, extraction_prompt_version, created_at desc);
