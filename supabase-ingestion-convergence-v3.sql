-- ============================================================================
-- Phase 3E: ingestion convergence and scholarship shadow metadata.
--
-- Additive and unapplied.  Existing application, catalogue, scholarship, and
-- queue tables remain available for compatibility.  This schema stores
-- metadata, assertions, and references only; raw HTML/PDF/CSV bodies stay in
-- the Slice A evidence stores and are never duplicated here.
-- ============================================================================

begin;

create table if not exists public.ingestion_sources_v3 (
  source_id text primary key,
  adapter text not null,
  adapter_version text not null,
  lifecycle text not null default 'SHADOWED',
  source_path text not null,
  source_url text,
  source_owner text,
  parser_version text,
  file_id text,
  file_hash text,
  row_locator text,
  observed_at timestamptz not null,
  raw_kind text not null default 'none',
  raw_document_id text,
  raw_locator text,
  raw_content_hash text,
  raw_retained boolean not null default false,
  provenance_limitations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  check (lifecycle in ('ACTIVE', 'SHADOWED', 'DEPRECATED', 'READY_FOR_CUTOVER')),
  check (raw_kind in ('remote_raw', 'structured_file', 'structured_record', 'none'))
);

create index if not exists idx_ingestion_sources_v3_adapter
  on public.ingestion_sources_v3(adapter, observed_at desc);
create index if not exists idx_ingestion_sources_v3_file
  on public.ingestion_sources_v3(file_id, file_hash);

create table if not exists public.ingestion_assertions_v3 (
  assertion_id text primary key,
  source_id text not null references public.ingestion_sources_v3(source_id) on delete restrict,
  entity_type text not null,
  entity_key text not null,
  field text not null,
  value_json jsonb,
  original_value_json jsonb,
  legacy_job_id text,
  parsed_field text not null,
  adaptation_timestamp timestamptz,
  epistemic text not null default 'OBSERVED',
  temporal text not null default 'UNKNOWN',
  verification text not null default 'UNVALIDATED',
  authority text,
  audience text,
  academic_cycle text,
  validated boolean not null default false,
  trusted_for_canonical_promotion boolean not null default false,
  raw_document_id text,
  provenance_limitations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  check (epistemic in ('OBSERVED', 'DERIVED', 'INFERRED')),
  check (temporal in ('CURRENT', 'HISTORICAL', 'UNKNOWN')),
  check (verification in ('VALIDATED', 'NEEDS_REVIEW', 'UNVALIDATED')),
  check (trusted_for_canonical_promotion = false)
);

create index if not exists idx_ingestion_assertions_v3_entity_field
  on public.ingestion_assertions_v3(entity_type, entity_key, field, academic_cycle);
create index if not exists idx_ingestion_assertions_v3_source
  on public.ingestion_assertions_v3(source_id, created_at desc);

create table if not exists public.ingestion_curator_overrides_v3 (
  override_id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_key text not null,
  field text,
  actor_id text not null,
  actor_context text,
  reason text not null,
  previous_state jsonb,
  new_state jsonb not null,
  evidence_reference jsonb not null default '[]'::jsonb,
  policy_version text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ingestion_curator_overrides_v3_target
  on public.ingestion_curator_overrides_v3(entity_type, entity_key, created_at desc);

create table if not exists public.ingestion_write_audit_v3 (
  audit_id uuid primary key default gen_random_uuid(),
  source_path text not null,
  adapter text not null,
  identity_decision text,
  quality_decision text,
  promotion_id uuid,
  canonical_change jsonb,
  disposition text not null,
  actor text,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ingestion_write_audit_v3_time
  on public.ingestion_write_audit_v3(created_at desc, adapter);

create table if not exists public.ingestion_differential_reports_v3 (
  report_id uuid primary key default gen_random_uuid(),
  source_path text not null,
  adapter text not null,
  legacy_output jsonb not null default '{}'::jsonb,
  v3_assertion_fields jsonb not null default '[]'::jsonb,
  identity_decision text not null,
  quality_state text not null,
  promotion_eligible boolean not null default false,
  differences jsonb not null default '[]'::jsonb,
  blocking_reasons jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now()
);

create index if not exists idx_ingestion_differential_reports_v3_source
  on public.ingestion_differential_reports_v3(adapter, generated_at desc);

create table if not exists public.scholarship_entities_v3 (
  scholarship_id text primary key,
  provider_id text,
  scheme_id text,
  provider_name text,
  canonical_name text not null,
  academic_cycle text,
  identity_decision text not null,
  identity_method text not null,
  supporting_assertion_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  check (identity_decision in ('RESOLVED', 'CREATED', 'REVIEW_REQUIRED', 'UNMATCHED'))
);

create index if not exists idx_scholarship_entities_v3_strong_ids
  on public.scholarship_entities_v3(provider_id, scheme_id);

create table if not exists public.scholarship_mappings_v3 (
  mapping_id text primary key,
  scholarship_id text not null references public.scholarship_entities_v3(scholarship_id) on delete cascade,
  university_id bigint references public.universities(id) on delete set null,
  relationship_type text not null default 'ELIGIBLE_AT',
  mapping_state text not null,
  mapping_method text not null,
  evidence text,
  supporting_assertion_ids jsonb not null default '[]'::jsonb,
  confirmed boolean not null default false,
  review_required boolean not null default true,
  created_at timestamptz not null default now(),
  check (relationship_type in ('ELIGIBLE_AT', 'PROVIDED_BY', 'PARTNER')),
  check (mapping_state in ('CONFIRMED', 'CURATED', 'PROPOSED', 'UNRESOLVED')),
  check (confirmed = (mapping_state in ('CONFIRMED', 'CURATED'))),
  check (mapping_state not in ('CONFIRMED', 'CURATED') or evidence is not null),
  check (mapping_state not in ('CONFIRMED', 'CURATED') or university_id is not null)
);

create index if not exists idx_scholarship_mappings_v3_university
  on public.scholarship_mappings_v3(university_id, mapping_state);

-- These nullable columns let the durable job reference the common contract
-- once this additive migration is applied; existing queue writes remain valid.
do $$
begin
  if to_regclass('public.programme_ingestion_jobs') is not null then
    alter table public.programme_ingestion_jobs
      add column if not exists acquisition_intent_id text;
    alter table public.programme_ingestion_jobs
      add column if not exists policy_version text;
    alter table public.programme_ingestion_jobs
      add column if not exists failure_class text;
    alter table public.programme_ingestion_jobs
      add column if not exists attempt_fingerprint text;
    alter table public.programme_ingestion_jobs
      add column if not exists quality_evaluation_id text;

    create unique index if not exists idx_programme_ingestion_jobs_attempt_fingerprint_v3
      on public.programme_ingestion_jobs(attempt_fingerprint)
      where attempt_fingerprint is not null;
  end if;
end $$;

alter table public.ingestion_sources_v3 enable row level security;
alter table public.ingestion_assertions_v3 enable row level security;
alter table public.ingestion_curator_overrides_v3 enable row level security;
alter table public.ingestion_write_audit_v3 enable row level security;
alter table public.ingestion_differential_reports_v3 enable row level security;
alter table public.scholarship_entities_v3 enable row level security;
alter table public.scholarship_mappings_v3 enable row level security;

-- Shadow tables intentionally have no client-facing policies in this additive
-- migration.  Define and test least-privilege policies before any table or
-- adapter lifecycle is changed to READY_FOR_CUTOVER; service-role jobs may
-- access them during the unapplied shadow rollout.

comment on table public.ingestion_sources_v3 is
  'Common source/evidence metadata for converged ingestion; payload remains in durable evidence storage.';
comment on table public.ingestion_assertions_v3 is
  'Shadow assertions from crawler, legacy, manual, CSV, and scholarship adapters.';
comment on table public.scholarship_mappings_v3 is
  'Evidence-bearing scholarship relationships; fuzzy candidates remain proposed.';

commit;
