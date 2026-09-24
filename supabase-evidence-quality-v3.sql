-- Phase 3C: additive, unapplied staging quality metadata.
-- Raw HTML/PDF/JSON bodies remain in Slice A remote evidence stores. These
-- tables reference assertion and raw-document identifiers only; they do not
-- alter promotion, canonical tables, or product reads.
-- Assumption: supabase-crawl-staging.sql and supabase-crawl-acquisition-v3.sql
-- are applied before this migration.

begin;

create table if not exists public.crawl_quality_policy_versions_v3 (
  policy_version text primary key,
  policy_kind text not null,
  policy_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (length(trim(policy_version)) > 0),
  check (policy_kind in ('FIELD', 'RECOVERY', 'INFERENCE'))
);

insert into public.crawl_quality_policy_versions_v3
  (policy_version, policy_kind, policy_json)
values
  ('field-policy/v1', 'FIELD', '{}'::jsonb),
  ('recovery-budget/v1', 'RECOVERY', '{}'::jsonb),
  ('inference-policy/v1', 'INFERENCE', '{}'::jsonb)
on conflict (policy_version) do nothing;

create table if not exists public.crawl_quality_coverage_assessments_v3 (
  run_id uuid not null references public.crawl_runs(id) on delete cascade,
  assessment_id uuid not null,
  entity_type text not null,
  entity_id text not null,
  field text not null,
  field_group text not null,
  target_cycle text,
  audience text,
  state text not null,
  critical boolean not null default false,
  terminal boolean not null default false,
  acceptable boolean not null default false,
  supporting_assertion_ids text[] not null default '{}',
  blocking_reason text,
  next_action text,
  policy_version text not null,
  evaluated_at timestamptz not null default now(),
  temporal_state text not null default 'UNKNOWN',
  epistemic_state text,
  verification text,
  authority text,
  relationship text,
  applicability text not null default 'UNKNOWN',
  conflict_state text not null default 'NONE',
  verification_required boolean not null default false,
  primary key (run_id, assessment_id),
  foreign key (policy_version) references public.crawl_quality_policy_versions_v3(policy_version),
  check (state in (
    'NOT_EVALUATED', 'FOUND', 'NOT_PUBLISHED', 'NOT_REQUIRED',
    'SOURCE_NOT_FOUND', 'ACCESS_BLOCKED', 'FETCH_FAILED', 'PARSE_FAILED',
    'EXTRACTION_FAILED', 'STALE_ONLY', 'CONFLICTING_SOURCES', 'NEEDS_REVIEW'
  )),
  check (temporal_state in ('CURRENT', 'HISTORICAL', 'FUTURE', 'TARGET_CYCLE_ESTIMATE', 'UNKNOWN')),
  check (epistemic_state is null or epistemic_state in ('OBSERVED', 'DERIVED', 'INFERRED')),
  check (applicability in ('APPLICABLE', 'NOT_APPLICABLE', 'UNKNOWN')),
  check (conflict_state in ('NONE', 'DETECTED', 'AUTO_RESOLVED', 'NEEDS_REVIEW'))
);

create table if not exists public.crawl_quality_conflicts_v3 (
  run_id uuid not null references public.crawl_runs(id) on delete cascade,
  conflict_id uuid not null,
  entity_type text not null,
  entity_id text not null,
  field text not null,
  scope text,
  audience text,
  academic_cycle text,
  competing_assertion_ids text[] not null,
  policy_version text not null,
  state text not null default 'NEEDS_REVIEW',
  resolved_assertion_id text,
  resolution_reason text,
  detected_at timestamptz not null default now(),
  primary key (run_id, conflict_id),
  foreign key (policy_version) references public.crawl_quality_policy_versions_v3(policy_version),
  check (state in ('DETECTED', 'AUTO_RESOLVED', 'NEEDS_REVIEW'))
);

create table if not exists public.crawl_quality_inferences_v3 (
  run_id uuid not null references public.crawl_runs(id) on delete cascade,
  inference_id uuid not null,
  entity_type text not null,
  entity_id text not null,
  field text not null,
  target_cycle text not null,
  predicted_value jsonb not null,
  predicted_state text,
  supporting_assertion_ids text[] not null default '{}',
  supporting_raw_document_ids text[] not null default '{}',
  method text not null,
  method_version text not null,
  confidence numeric(5,4) not null,
  generated_at timestamptz not null default now(),
  volatility text not null,
  horizon integer not null default 0,
  verification_required boolean not null default true,
  allowed_exposure text not null default 'ADVISORY',
  product_safe boolean not null default false,
  status text not null default 'ACTIVE',
  supersedes_inference_id uuid,
  invalidation_reason text,
  primary key (run_id, inference_id),
  check (confidence >= 0 and confidence <= 1),
  check (volatility in ('LOW', 'MEDIUM', 'HIGH')),
  check (status in ('ACTIVE', 'CONFIRMED', 'SUPERSEDED', 'CONTRADICTED', 'INVALIDATED')),
  check (product_safe = false),
  check (verification_required = true),
  check (allowed_exposure <> 'VERIFIED_CURRENT')
);

create table if not exists public.crawl_quality_inference_support_v3 (
  run_id uuid not null references public.crawl_runs(id) on delete cascade,
  support_id uuid not null,
  inference_id uuid not null,
  assertion_id text,
  raw_document_id text,
  support_role text not null default 'HISTORICAL_SUPPORT',
  primary key (run_id, support_id),
  foreign key (run_id, inference_id)
    references public.crawl_quality_inferences_v3(run_id, inference_id)
    on delete cascade,
  check (assertion_id is not null or raw_document_id is not null)
);

create index if not exists crawl_quality_coverage_entity_field_v3_idx
  on public.crawl_quality_coverage_assessments_v3(run_id, entity_type, entity_id, field);
create index if not exists crawl_quality_coverage_state_v3_idx
  on public.crawl_quality_coverage_assessments_v3(run_id, state, critical);
create index if not exists crawl_quality_conflicts_entity_field_v3_idx
  on public.crawl_quality_conflicts_v3(run_id, entity_type, entity_id, field, state);
create index if not exists crawl_quality_inferences_target_v3_idx
  on public.crawl_quality_inferences_v3(run_id, entity_type, entity_id, field, target_cycle);

alter table public.crawl_quality_policy_versions_v3 enable row level security;
alter table public.crawl_quality_coverage_assessments_v3 enable row level security;
alter table public.crawl_quality_conflicts_v3 enable row level security;
alter table public.crawl_quality_inferences_v3 enable row level security;
alter table public.crawl_quality_inference_support_v3 enable row level security;

comment on table public.crawl_quality_coverage_assessments_v3 is
  'Versioned field quality state; references assertion ids and contains no raw body.';
comment on table public.crawl_quality_conflicts_v3 is
  'Applicability-aware competing assertion identity and resolution audit.';
comment on table public.crawl_quality_inferences_v3 is
  'Advisory historical projections; inferred values are never product-safe.';
comment on table public.crawl_quality_inference_support_v3 is
  'Lineage links to existing assertions and remote raw-document identifiers only.';

commit;
