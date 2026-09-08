-- Slice A additive acquisition/evidence metadata.
-- Raw payloads remain in MongoDB/object storage; this migration stores only
-- durable references and structured audit metadata in Supabase staging.
-- Assumption: public.crawl_runs and public.crawl_sources already exist.

begin;

create table if not exists public.crawl_acquisition_intents (
  run_id uuid not null references public.crawl_runs(id) on delete cascade,
  intent_id uuid not null,
  entity_type text not null,
  entity_id text not null,
  field_groups text[] not null default '{}',
  target_cycle text,
  audience text,
  preferred_source_classes text[] not null default '{}',
  minimum_authority text,
  freshness_requirement text,
  reason text not null,
  priority integer not null default 0,
  budget_policy_id text,
  policy_version text not null default 'acquisition-intent/v1',
  created_at timestamptz not null default now(),
  primary key (run_id, intent_id),
  check (minimum_authority is null or minimum_authority in (
    'OFFICIAL', 'GOVERNMENT', 'OFFICIAL_PARTNER', 'ACCREDITED_PROVIDER',
    'TRUSTED_AGGREGATOR', 'ARCHIVE', 'OTHER'
  ))
);

create table if not exists public.crawl_source_candidates (
  run_id uuid not null references public.crawl_runs(id) on delete cascade,
  candidate_id uuid not null,
  intent_id uuid,
  canonical_locator text not null,
  locator_type text not null,
  source_class text not null,
  publisher_key text,
  source_authority text,
  source_relationship text,
  relationship_evidence jsonb not null default '[]'::jsonb,
  expected_field_groups text[] not null default '{}',
  language text,
  academic_cycle text,
  estimated_freshness text,
  discovery_method text,
  discovery_evidence text,
  fetch_strategy text,
  cost_class text,
  adapter_id text,
  adapter_version text,
  provider_id text,
  dataset_id text,
  retrieved_at timestamptz,
  temporal_state text not null default 'UNKNOWN',
  -- Provider/resource identities are stable opaque strings; URL identities
  -- happen to be UUIDs today, but structured providers need not be.
  source_identity text,
  raw_document_id uuid,
  created_at timestamptz not null default now(),
  primary key (run_id, candidate_id),
  foreign key (run_id, intent_id)
    references public.crawl_acquisition_intents(run_id, intent_id),
  check (source_authority is null or source_authority in (
    'OFFICIAL', 'GOVERNMENT', 'OFFICIAL_PARTNER', 'ACCREDITED_PROVIDER',
    'TRUSTED_AGGREGATOR', 'ARCHIVE', 'OTHER'
  )),
  check (source_relationship is null or source_relationship in (
    'DIRECT_OFFICIAL', 'PARENT_INSTITUTION', 'DEPARTMENT',
    'CENTRAL_ADMISSIONS', 'INTERNATIONAL_ADMISSIONS', 'FINANCE_OFFICE',
    'GOVERNMENT', 'SCHOLARSHIP_PROVIDER', 'PARTNER_INSTITUTION',
    'CONSORTIUM', 'CATALOGUE_PROVIDER', 'ACCREDITATION_BODY', 'ARCHIVE',
    'AGGREGATOR', 'OTHER_RELATED'
  )),
  check (temporal_state in ('CURRENT', 'HISTORICAL', 'FUTURE', 'UNKNOWN'))
);

create table if not exists public.crawl_acquisition_attempts (
  run_id uuid not null references public.crawl_runs(id) on delete cascade,
  attempt_id uuid not null,
  intent_id uuid,
  candidate_id uuid,
  raw_document_id uuid,
  status text not null,
  error_code text,
  retryable boolean not null default false,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  primary key (run_id, attempt_id),
  foreign key (run_id, intent_id)
    references public.crawl_acquisition_intents(run_id, intent_id),
  foreign key (run_id, candidate_id)
    references public.crawl_source_candidates(run_id, candidate_id)
);

alter table public.crawl_sources
  add column if not exists raw_document_id uuid;
alter table public.crawl_sources
  add column if not exists parser_id text;
alter table public.crawl_sources
  add column if not exists parser_version text;
alter table public.crawl_sources
  add column if not exists source_authority text;
alter table public.crawl_sources
  add column if not exists source_relationship text;
alter table public.crawl_sources
  add column if not exists temporal_state text;

alter table public.crawl_field_assertions
  add column if not exists epistemic_state text not null default 'OBSERVED';
alter table public.crawl_field_assertions
  add column if not exists temporal_state text not null default 'UNKNOWN';
alter table public.crawl_field_assertions
  add column if not exists source_authority text;
alter table public.crawl_field_assertions
  add column if not exists source_relationship text;
alter table public.crawl_field_assertions
  add column if not exists raw_document_id uuid;
alter table public.crawl_field_assertions
  add column if not exists parser_id text;
alter table public.crawl_field_assertions
  add column if not exists parser_version text;
alter table public.crawl_field_assertions
  add column if not exists provider_id text;
alter table public.crawl_field_assertions
  add column if not exists prompt_version text;
alter table public.crawl_field_assertions
  add column if not exists schema_version text;

create index if not exists idx_crawl_source_candidates_intent
  on public.crawl_source_candidates(run_id, intent_id, created_at desc);
create index if not exists idx_crawl_source_candidates_locator
  on public.crawl_source_candidates(run_id, md5(canonical_locator));
create index if not exists idx_crawl_source_candidates_raw_document
  on public.crawl_source_candidates(raw_document_id)
  where raw_document_id is not null;
create index if not exists idx_crawl_acquisition_attempts_candidate
  on public.crawl_acquisition_attempts(run_id, candidate_id, started_at desc);
create index if not exists idx_crawl_sources_raw_document
  on public.crawl_sources(raw_document_id)
  where raw_document_id is not null;
create index if not exists idx_crawl_assertions_raw_document
  on public.crawl_field_assertions(raw_document_id)
  where raw_document_id is not null;

alter table public.crawl_acquisition_intents enable row level security;
alter table public.crawl_source_candidates enable row level security;
alter table public.crawl_acquisition_attempts enable row level security;

comment on table public.crawl_acquisition_intents is
  'Structured acquisition requests only; raw bodies are not stored in Supabase.';
comment on table public.crawl_source_candidates is
  'Discovered potential sources, not verified facts or raw bodies.';
comment on table public.crawl_acquisition_attempts is
  'Fetch/persistence attempt metadata; raw_document_id references remote evidence by identifier only.';

commit;
