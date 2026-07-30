-- GlowBal university crawl staging schema.
-- Server-only by default: anon/authenticated users receive no table access.
-- Raw HTML/PDF bytes belong in object storage; only their paths are stored here.
-- Safe to run repeatedly in the Supabase SQL editor.

begin;

create table if not exists public.crawl_runs (
  id uuid primary key default gen_random_uuid(),
  run_key text not null unique,
  pipeline_version text,
  config_name text,
  status text not null default 'importing'
    check (status in ('importing', 'completed', 'failed', 'approved', 'rejected')),
  started_at timestamptz,
  finished_at timestamptz,
  imported_at timestamptz not null default now(),
  metrics jsonb not null default '{}'::jsonb,
  coverage_report jsonb not null default '{}'::jsonb,
  source_manifest jsonb not null default '{}'::jsonb,
  notes text
);

create table if not exists public.crawl_institutions (
  run_id uuid not null references public.crawl_runs(id) on delete cascade,
  institution_id text not null,
  university_id bigint,
  canonical_name text not null,
  country_code text,
  official_domain text,
  official_url text,
  verification_status text not null,
  last_checked_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  primary key (run_id, institution_id),
  check (country_code is null or country_code ~ '^[A-Z]{2}$')
);

create table if not exists public.crawl_organisation_units (
  run_id uuid not null references public.crawl_runs(id) on delete cascade,
  organisation_unit_id uuid not null,
  institution_id text not null,
  parent_organisation_unit_id uuid,
  unit_name text not null,
  unit_type text not null,
  official_url text,
  source_url text not null,
  evidence text not null,
  confidence double precision not null,
  verification_status text not null,
  retrieved_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  primary key (run_id, organisation_unit_id),
  foreign key (run_id, institution_id)
    references public.crawl_institutions(run_id, institution_id)
    on delete cascade,
  foreign key (run_id, parent_organisation_unit_id)
    references public.crawl_organisation_units(run_id, organisation_unit_id)
    on delete cascade,
  check (
    unit_type in (
      'school', 'college', 'faculty', 'division',
      'institute', 'department', 'other'
    )
  ),
  check (
    verification_status in (
      'DISCOVERED', 'FETCHED', 'AI_EXTRACTED', 'RULE_VALIDATED',
      'NEEDS_REVIEW', 'HUMAN_VERIFIED', 'REJECTED'
    )
  )
);

create table if not exists public.crawl_programmes (
  run_id uuid not null references public.crawl_runs(id) on delete cascade,
  programme_id uuid not null,
  institution_id text not null,
  programme_name text not null,
  official_url text not null,
  degree_level text,
  credential text,
  normalized_field text,
  organisation_unit_id text,
  language text,
  campus text,
  delivery_mode text,
  duration text,
  programme_status text,
  catalogue_source text,
  retrieved_at timestamptz not null,
  verification_status text not null,
  is_deep_selected boolean not null default false,
  selection_basis text,
  selection_rank integer,
  priority_source text,
  priority_rank integer,
  priority_label text,
  priority_taxonomy_code text,
  priority_completions_total integer,
  priority_degree_completions integer,
  priority_match_score double precision,
  payload jsonb not null default '{}'::jsonb,
  primary key (run_id, programme_id),
  foreign key (run_id, institution_id)
    references public.crawl_institutions(run_id, institution_id)
    on delete cascade,
  check (
    verification_status in (
      'DISCOVERED',
      'FETCHED',
      'AI_EXTRACTED',
      'RULE_VALIDATED',
      'NEEDS_REVIEW',
      'HUMAN_VERIFIED',
      'REJECTED'
    )
  )
);

create table if not exists public.crawl_programme_offerings (
  run_id uuid not null references public.crawl_runs(id) on delete cascade,
  programme_offering_id uuid not null,
  programme_id uuid not null,
  academic_cycle text,
  intake text,
  campus text,
  delivery_mode text,
  audience text,
  application_status text,
  payload jsonb not null default '{}'::jsonb,
  primary key (run_id, programme_offering_id),
  foreign key (run_id, programme_id)
    references public.crawl_programmes(run_id, programme_id)
    on delete cascade
);

create table if not exists public.crawl_programme_organisation_units (
  run_id uuid not null references public.crawl_runs(id) on delete cascade,
  programme_id uuid not null,
  organisation_unit_id uuid not null,
  relationship_type text not null,
  is_primary boolean not null default false,
  source_url text not null,
  evidence text not null,
  confidence double precision not null,
  verification_status text not null,
  payload jsonb not null default '{}'::jsonb,
  primary key (run_id, programme_id, organisation_unit_id),
  foreign key (run_id, programme_id)
    references public.crawl_programmes(run_id, programme_id)
    on delete cascade,
  foreign key (run_id, organisation_unit_id)
    references public.crawl_organisation_units(run_id, organisation_unit_id)
    on delete cascade,
  check (relationship_type in ('administered_by', 'offered_by', 'joint')),
  check (
    verification_status in (
      'DISCOVERED', 'FETCHED', 'AI_EXTRACTED', 'RULE_VALIDATED',
      'NEEDS_REVIEW', 'HUMAN_VERIFIED', 'REJECTED'
    )
  )
);

create table if not exists public.crawl_sources (
  run_id uuid not null references public.crawl_runs(id) on delete cascade,
  source_id uuid not null,
  institution_id text not null,
  url text not null,
  canonical_url text not null,
  page_type text not null,
  content_type text,
  http_status integer not null,
  retrieved_at timestamptz not null,
  content_hash text not null,
  raw_object_path text,
  title text,
  language text,
  text_length integer not null default 0,
  fetch_method text not null default 'http',
  rendered boolean not null default false,
  primary key (run_id, source_id),
  foreign key (run_id, institution_id)
    references public.crawl_institutions(run_id, institution_id)
    on delete cascade,
  check (http_status between 100 and 599),
  check (text_length >= 0)
);

create table if not exists public.crawl_field_assertions (
  run_id uuid not null references public.crawl_runs(id) on delete cascade,
  assertion_id uuid not null,
  entity_type text not null,
  entity_id text not null,
  field_name text not null,
  value_json jsonb,
  null_reason text,
  source_url text,
  source_type text,
  evidence text,
  evidence_locator text,
  scope text,
  audience text,
  academic_cycle text,
  retrieved_at timestamptz not null,
  confidence double precision not null,
  verification_status text not null,
  extractor_version text not null,
  model_name text,
  validation_errors text[] not null default '{}',
  extraction_group text,
  applicability_source_url text,
  applicability_evidence text,
  source_content_hash text,
  review_fingerprint uuid,
  inherited_from_assertion_id uuid,
  inherited_from_entity_id text,
  inheritance_key text,
  is_effective boolean not null default false,
  primary key (run_id, assertion_id),
  check (confidence between 0 and 1),
  check (
    verification_status in (
      'DISCOVERED',
      'FETCHED',
      'AI_EXTRACTED',
      'RULE_VALIDATED',
      'NEEDS_REVIEW',
      'HUMAN_VERIFIED',
      'REJECTED'
    )
  ),
  check (
    null_reason is null or null_reason in (
      'NOT_PUBLISHED',
      'NOT_APPLICABLE',
      'OUTDATED_ONLY',
      'BLOCKED_BY_POLICY',
      'FETCH_FAILED',
      'PARSE_FAILED',
      'AMBIGUOUS',
      'CONFLICTED'
    )
  ),
  check (value_json is not null or null_reason is not null)
);

alter table public.crawl_field_assertions
  add column if not exists source_content_hash text;

alter table public.crawl_field_assertions
  add column if not exists review_fingerprint uuid;

alter table public.crawl_field_assertions
  add column if not exists inherited_from_assertion_id uuid;

alter table public.crawl_field_assertions
  add column if not exists inherited_from_entity_id text;

alter table public.crawl_field_assertions
  add column if not exists inheritance_key text;

create table if not exists public.crawl_admission_packages (
  run_id uuid not null references public.crawl_runs(id) on delete cascade,
  programme_id uuid not null,
  institution_id text not null,
  programme_name text not null,
  official_url text not null,
  retrieved_at timestamptz not null,
  precheck jsonb not null,
  payload jsonb not null default '{}'::jsonb,
  primary key (run_id, programme_id),
  foreign key (run_id, programme_id)
    references public.crawl_programmes(run_id, programme_id)
    on delete cascade
);

create table if not exists public.crawl_admission_requirements (
  run_id uuid not null,
  programme_id uuid not null,
  document_type text not null,
  source_field text not null,
  requirement_status text not null,
  required_count integer,
  count_scope text not null default 'document_total',
  application_stage text not null,
  accepted_alternatives text[] not null default '{}',
  components jsonb not null default '[]'::jsonb,
  conflict boolean not null default false,
  conflict_reasons text[] not null default '{}',
  evidence jsonb not null default '[]'::jsonb,
  primary key (run_id, programme_id, document_type),
  foreign key (run_id, programme_id)
    references public.crawl_admission_packages(run_id, programme_id)
    on delete cascade,
  check (
    requirement_status in (
      'required',
      'optional',
      'conditional',
      'not_required',
      'unknown'
    )
  ),
  check (
    application_stage in (
      'initial_application',
      'after_offer',
      'enrollment',
      'unknown'
    )
  ),
  check (
    count_scope in (
      'document_total',
      'primary_component',
      'component_breakdown'
    )
  ),
  check (jsonb_typeof(components) = 'array'),
  check (required_count is null or required_count >= 0)
);

alter table public.crawl_admission_requirements
  add column if not exists count_scope text not null
  default 'document_total';

alter table public.crawl_admission_requirements
  add column if not exists components jsonb not null
  default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'crawl_admission_requirements_count_scope_check'
      and conrelid = 'public.crawl_admission_requirements'::regclass
  ) then
    alter table public.crawl_admission_requirements
      add constraint crawl_admission_requirements_count_scope_check
      check (
        count_scope in (
          'document_total',
          'primary_component',
          'component_breakdown'
        )
      );
  end if;
end $$;

create table if not exists public.crawl_policy_checks (
  run_id uuid not null references public.crawl_runs(id) on delete cascade,
  institution_id text not null,
  domain text not null,
  robots_url text not null,
  robots_reachable boolean not null,
  robots_allowed boolean not null,
  terms_status text not null,
  terms_url text,
  policy_status text not null,
  checked_at timestamptz not null,
  notes text[] not null default '{}',
  sitemaps text[] not null default '{}',
  primary key (run_id, institution_id, domain),
  foreign key (run_id, institution_id)
    references public.crawl_institutions(run_id, institution_id)
    on delete cascade,
  check (
    policy_status in (
      'ALLOWED',
      'ALLOWED_TERMS_UNREVIEWED',
      'BLOCKED_BY_ROBOTS',
      'PROHIBITED',
      'UNREACHABLE'
    )
  )
);

create table if not exists public.crawl_url_edges (
  id bigint generated by default as identity primary key,
  run_id uuid not null references public.crawl_runs(id) on delete cascade,
  institution_id text not null,
  discovered_from text not null,
  target_url text not null,
  relation text not null,
  depth integer,
  anchor_text text,
  retrieved_at timestamptz not null,
  foreign key (run_id, institution_id)
    references public.crawl_institutions(run_id, institution_id)
    on delete cascade,
  check (depth is null or depth >= 0)
);

create table if not exists public.crawl_errors (
  run_id uuid not null references public.crawl_runs(id) on delete cascade,
  error_id uuid not null,
  institution_id text,
  url text,
  stage text not null,
  error_code text not null,
  message text not null,
  retryable boolean not null,
  created_at timestamptz not null,
  primary key (run_id, error_id)
);

create table if not exists public.crawl_review_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.crawl_runs(id) on delete cascade,
  programme_id uuid,
  assertion_id uuid,
  field_name text,
  review_fingerprint uuid,
  reason text not null,
  priority smallint not null default 50,
  status text not null default 'pending',
  assigned_to uuid,
  resolution jsonb not null default '{}'::jsonb,
  reviewer_notes text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  check (priority between 0 and 100),
  check (status in ('pending', 'approved', 'rejected', 'superseded')),
  foreign key (run_id, programme_id)
    references public.crawl_programmes(run_id, programme_id)
    on delete cascade,
  foreign key (run_id, assertion_id)
    references public.crawl_field_assertions(run_id, assertion_id)
    on delete cascade
);

alter table public.crawl_review_items
  add column if not exists review_fingerprint uuid;

create index if not exists idx_crawl_programmes_institution
  on public.crawl_programmes(run_id, institution_id);

create index if not exists idx_crawl_programmes_deep
  on public.crawl_programmes(run_id, is_deep_selected)
  where is_deep_selected;

create index if not exists idx_crawl_offerings_programme
  on public.crawl_programme_offerings(run_id, programme_id);

create index if not exists idx_crawl_sources_institution_page_type
  on public.crawl_sources(run_id, institution_id, page_type);

create index if not exists idx_crawl_sources_canonical_url
  on public.crawl_sources(run_id, md5(canonical_url));

create index if not exists idx_crawl_assertions_entity_field
  on public.crawl_field_assertions(run_id, entity_type, entity_id, field_name);

create index if not exists idx_crawl_assertions_effective
  on public.crawl_field_assertions(run_id, entity_id, field_name)
  where is_effective and verification_status <> 'REJECTED';

create index if not exists idx_crawl_assertions_review
  on public.crawl_field_assertions(run_id, verification_status, field_name)
  where verification_status = 'NEEDS_REVIEW';

create index if not exists idx_crawl_admission_requirement_lookup
  on public.crawl_admission_requirements(
    run_id,
    requirement_status,
    application_stage,
    document_type
  );

create index if not exists idx_crawl_url_edges_institution
  on public.crawl_url_edges(run_id, institution_id, depth);

create index if not exists idx_crawl_review_queue
  on public.crawl_review_items(run_id, status, priority desc, created_at)
  where status = 'pending';

create index if not exists idx_crawl_assertions_review_fingerprint
  on public.crawl_field_assertions(
    run_id,
    review_fingerprint,
    is_effective
  )
  where review_fingerprint is not null;

create index if not exists idx_crawl_review_group
  on public.crawl_review_items(
    run_id,
    review_fingerprint,
    status
  )
  where review_fingerprint is not null;

create or replace function public.resolve_crawl_review_group(
  p_run_id uuid,
  p_review_fingerprint uuid,
  p_status text,
  p_reviewer_notes text default null
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  resolved_count integer;
begin
  if p_status not in ('approved', 'rejected', 'superseded') then
    raise exception 'Unsupported review status: %', p_status;
  end if;

  update public.crawl_review_items
  set
    status = p_status,
    reviewer_notes = p_reviewer_notes,
    reviewed_at = now(),
    resolution = jsonb_build_object(
      'decision', p_status,
      'grouped_approval', true,
      'review_fingerprint', p_review_fingerprint,
      'resolved_at', now()
    )
  where run_id = p_run_id
    and review_fingerprint = p_review_fingerprint
    and status = 'pending';

  get diagnostics resolved_count = row_count;

  if p_status in ('approved', 'rejected') then
    update public.crawl_field_assertions
    set verification_status = case
      when p_status = 'approved' then 'HUMAN_VERIFIED'
      else 'REJECTED'
    end
    where run_id = p_run_id
      and review_fingerprint = p_review_fingerprint
      and is_effective;
  end if;

  return resolved_count;
end;
$$;

revoke all on function public.resolve_crawl_review_group(
  uuid,
  uuid,
  text,
  text
) from public, anon, authenticated;

grant execute on function public.resolve_crawl_review_group(
  uuid,
  uuid,
  text,
  text
) to service_role;

alter table public.crawl_runs enable row level security;
alter table public.crawl_institutions enable row level security;
alter table public.crawl_organisation_units enable row level security;
alter table public.crawl_programmes enable row level security;
alter table public.crawl_programme_offerings enable row level security;
alter table public.crawl_programme_organisation_units enable row level security;
alter table public.crawl_sources enable row level security;
alter table public.crawl_field_assertions enable row level security;
alter table public.crawl_admission_packages enable row level security;
alter table public.crawl_admission_requirements enable row level security;
alter table public.crawl_policy_checks enable row level security;
alter table public.crawl_url_edges enable row level security;
alter table public.crawl_errors enable row level security;
alter table public.crawl_review_items enable row level security;

revoke all on table
  public.crawl_runs,
  public.crawl_institutions,
  public.crawl_organisation_units,
  public.crawl_programmes,
  public.crawl_programme_offerings,
  public.crawl_programme_organisation_units,
  public.crawl_sources,
  public.crawl_field_assertions,
  public.crawl_admission_packages,
  public.crawl_admission_requirements,
  public.crawl_policy_checks,
  public.crawl_url_edges,
  public.crawl_errors,
  public.crawl_review_items
from anon, authenticated;

grant all on table
  public.crawl_runs,
  public.crawl_institutions,
  public.crawl_organisation_units,
  public.crawl_programmes,
  public.crawl_programme_offerings,
  public.crawl_programme_organisation_units,
  public.crawl_sources,
  public.crawl_field_assertions,
  public.crawl_admission_packages,
  public.crawl_admission_requirements,
  public.crawl_policy_checks,
  public.crawl_url_edges,
  public.crawl_errors,
  public.crawl_review_items
to service_role;

grant usage, select on all sequences in schema public to service_role;

commit;
