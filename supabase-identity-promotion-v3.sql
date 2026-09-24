-- ============================================================================
-- GlowBal identity + quality-gated promotion v3 (Slice D)
--
-- Additive, unapplied shadow schema.  The existing promote_crawl_run RPC and
-- catalog-v2 tables remain available during the compatibility rollout.  Raw
-- HTML/PDF bodies are deliberately not copied here; fields retain assertion,
-- source, and raw-document references instead.
-- ============================================================================

begin;

create table if not exists public.programme_entities (
  programme_entity_id uuid primary key default gen_random_uuid(),
  university_id bigint references public.universities(id) on delete set null,
  canonical_title text not null,
  degree_level text,
  credential text,
  academic_unit text,
  lifecycle_state text not null default 'DISCOVERED',
  resolver_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (lifecycle_state in (
    'DISCOVERED', 'PARTIAL', 'REVIEWABLE', 'PRODUCT_SAFE',
    'REJECTED', 'RETIRED'
  ))
);

create index if not exists idx_programme_entities_university
  on public.programme_entities(university_id, lifecycle_state);

create table if not exists public.programme_identifiers (
  id uuid primary key default gen_random_uuid(),
  programme_entity_id uuid not null references public.programme_entities(programme_entity_id) on delete cascade,
  university_id bigint references public.universities(id) on delete set null,
  scheme text not null,
  value text not null,
  issuer text,
  authority text,
  valid_from timestamptz,
  valid_to timestamptz,
  source_assertion_id text,
  created_at timestamptz not null default now(),
  unique (programme_entity_id, scheme, value),
  unique (university_id, scheme, value)
);

create index if not exists idx_programme_identifiers_lookup
  on public.programme_identifiers(scheme, value);

create table if not exists public.programme_aliases (
  id uuid primary key default gen_random_uuid(),
  programme_entity_id uuid not null references public.programme_entities(programme_entity_id) on delete cascade,
  alias_url text not null,
  language text,
  academic_cycle text,
  discovery_source text,
  first_seen timestamptz not null,
  last_seen timestamptz not null,
  identity_evidence jsonb not null default '[]'::jsonb,
  unique (programme_entity_id, alias_url, academic_cycle)
);

create index if not exists idx_programme_aliases_url
  on public.programme_aliases(alias_url);

create unique index if not exists uq_programme_aliases_v3_identity
  on public.programme_aliases(
    programme_entity_id,
    alias_url,
    coalesce(academic_cycle, '')
  );

create table if not exists public.programme_offerings_v3 (
  offering_id uuid primary key default gen_random_uuid(),
  programme_entity_id uuid not null references public.programme_entities(programme_entity_id) on delete cascade,
  academic_cycle text,
  campus text,
  delivery_mode text,
  intake text,
  language text,
  source_observation_id text,
  created_at timestamptz not null default now(),
  unique (programme_entity_id, academic_cycle, campus, delivery_mode, intake, language)
);

create unique index if not exists uq_programme_offerings_v3_identity
  on public.programme_offerings_v3(
    programme_entity_id,
    coalesce(academic_cycle, ''),
    coalesce(campus, ''),
    coalesce(delivery_mode, ''),
    coalesce(intake, ''),
    coalesce(language, '')
  );

create table if not exists public.programme_relationships_v3 (
  id uuid primary key default gen_random_uuid(),
  from_programme_entity_id uuid not null references public.programme_entities(programme_entity_id) on delete cascade,
  to_programme_entity_id uuid not null references public.programme_entities(programme_entity_id) on delete cascade,
  relation_event text not null,
  supporting_assertion_ids jsonb not null default '[]'::jsonb,
  curator_approved boolean not null default false,
  resolver_version text not null,
  created_at timestamptz not null default now(),
  check (relation_event in (
    'RENAMED_TO', 'MERGED_INTO', 'SPLIT_FROM', 'SUCCESSOR_OF', 'EQUIVALENT_TO'
  )),
  check (from_programme_entity_id <> to_programme_entity_id),
  unique (from_programme_entity_id, to_programme_entity_id, relation_event)
);

create table if not exists public.programme_institution_roles_v3 (
  id uuid primary key default gen_random_uuid(),
  programme_entity_id uuid not null references public.programme_entities(programme_entity_id) on delete cascade,
  university_id bigint not null references public.universities(id) on delete cascade,
  role text not null,
  source_assertion_ids jsonb not null default '[]'::jsonb,
  unique (programme_entity_id, university_id, role),
  check (role in ('awarding', 'teaching', 'partner', 'lead'))
);

create table if not exists public.university_identifiers_v3 (
  id uuid primary key default gen_random_uuid(),
  university_id bigint not null references public.universities(id) on delete cascade,
  scheme text not null,
  value text not null,
  issuer text,
  authority text,
  valid_from timestamptz,
  valid_to timestamptz,
  source_assertion_id text,
  unique (scheme, value)
);

create index if not exists idx_university_identifiers_university
  on public.university_identifiers_v3(university_id);

create table if not exists public.university_domain_claims_v3 (
  id uuid primary key default gen_random_uuid(),
  university_id bigint not null references public.universities(id) on delete cascade,
  domain text not null,
  verification_method text not null,
  verified boolean not null default false,
  valid_from timestamptz,
  valid_to timestamptz,
  first_seen timestamptz not null,
  last_verified timestamptz not null,
  source_assertion_id text,
  unique (university_id, domain, first_seen)
);

create index if not exists idx_university_domain_claims_domain
  on public.university_domain_claims_v3(lower(domain), verified);

create table if not exists public.identity_decisions_v3 (
  decision_id uuid primary key,
  entity_type text not null,
  observation_id text not null,
  candidate_entity_id uuid,
  resolved_entity_id uuid,
  decision text not null,
  method text not null,
  supporting_identifiers jsonb not null default '[]'::jsonb,
  supporting_assertion_ids jsonb not null default '[]'::jsonb,
  confidence double precision not null default 0,
  resolver_version text not null,
  reason text,
  decided_at timestamptz not null,
  check (decision in ('RESOLVED', 'CREATED', 'REVIEW_REQUIRED', 'UNMATCHED')),
  check (confidence between 0 and 1)
);

create index if not exists idx_identity_decisions_observation
  on public.identity_decisions_v3(entity_type, observation_id, decided_at desc);

create table if not exists public.programme_quality_evaluations_v3 (
  evaluation_id uuid primary key default gen_random_uuid(),
  programme_entity_id uuid not null references public.programme_entities(programme_entity_id) on delete cascade,
  target_cycle text,
  audience text,
  state text not null,
  eligible boolean not null default false,
  blocking_reasons jsonb not null default '[]'::jsonb,
  blocking_fields jsonb not null default '[]'::jsonb,
  critical_fields jsonb not null default '[]'::jsonb,
  policy_versions jsonb not null default '{}'::jsonb,
  evaluation jsonb not null default '{}'::jsonb,
  evaluated_at timestamptz not null default now(),
  unique (programme_entity_id, target_cycle, audience, evaluated_at),
  check (state in ('DISCOVERED', 'PARTIAL', 'REVIEWABLE', 'PRODUCT_SAFE', 'REJECTED', 'RETIRED'))
);

create index if not exists idx_programme_quality_current
  on public.programme_quality_evaluations_v3(programme_entity_id, target_cycle, evaluated_at desc);

create table if not exists public.promotion_evaluations_v3 (
  promotion_id uuid primary key,
  run_id uuid references public.crawl_runs(id) on delete set null,
  programme_entity_id uuid references public.programme_entities(programme_entity_id) on delete set null,
  target_cycle text,
  fingerprint text not null unique,
  quality_state text not null,
  eligible boolean not null default false,
  dry_run boolean not null default true,
  blocking_reasons jsonb not null default '[]'::jsonb,
  proposed_projection jsonb not null default '[]'::jsonb,
  conflicts jsonb not null default '[]'::jsonb,
  policy_versions jsonb not null default '{}'::jsonb,
  evaluated_at timestamptz not null default now()
);

create index if not exists idx_promotion_evaluations_entity
  on public.promotion_evaluations_v3(programme_entity_id, target_cycle, evaluated_at desc);

create table if not exists public.promotion_audit_v3 (
  attempt_id uuid primary key,
  promotion_id uuid not null references public.promotion_evaluations_v3(promotion_id) on delete restrict,
  run_id uuid references public.crawl_runs(id) on delete set null,
  programme_entity_id uuid references public.programme_entities(programme_entity_id) on delete set null,
  target_cycle text,
  fingerprint text not null,
  quality_state text not null,
  eligible boolean not null default false,
  dry_run boolean not null default true,
  result text not null,
  changed_fields jsonb not null default '[]'::jsonb,
  previous_values jsonb not null default '{}'::jsonb,
  new_values jsonb not null default '{}'::jsonb,
  blocked_reasons jsonb not null default '[]'::jsonb,
  policy_versions jsonb not null default '{}'::jsonb,
  quality_evaluation jsonb not null default '{}'::jsonb,
  idempotent_noop boolean not null default false,
  attempted_at timestamptz not null default now()
);

create index if not exists idx_promotion_audit_entity_time
  on public.promotion_audit_v3(programme_entity_id, attempted_at desc);

create table if not exists public.canonical_field_projection_history_v3 (
  projection_id uuid primary key default gen_random_uuid(),
  programme_entity_id uuid not null references public.programme_entities(programme_entity_id) on delete cascade,
  target_cycle text,
  field_name text not null,
  value_json jsonb,
  assertion_id text,
  source_id text,
  raw_document_id text,
  epistemic_state text not null,
  temporal_state text not null,
  verification_status text not null,
  authority text,
  promotion_id uuid not null references public.promotion_evaluations_v3(promotion_id) on delete restrict,
  projected_at timestamptz not null default now()
);

create index if not exists idx_projection_history_lookup
  on public.canonical_field_projection_history_v3(programme_entity_id, target_cycle, field_name, projected_at desc);

-- Additive compatibility link.  Existing course primary keys and URL columns
-- remain unchanged for legacy readers and applications.
do $$
begin
  if to_regclass('public.courses') is not null then
    alter table public.courses
      add column if not exists programme_entity_id uuid;
    if not exists (
      select 1 from pg_constraint
      where conname = 'courses_programme_entity_v3_fkey'
        and conrelid = 'public.courses'::regclass
    ) then
      alter table public.courses
        add constraint courses_programme_entity_v3_fkey
        foreign key (programme_entity_id)
        references public.programme_entities(programme_entity_id)
        on delete set null;
    end if;
    create index if not exists idx_courses_programme_entity_v3
      on public.courses(programme_entity_id)
      where programme_entity_id is not null;
  end if;
end $$;

-- Product-safe current read surface.  It only exposes the latest successful
-- v3 projection for an entity/cycle; partial/reviewable/advisory records stay
-- available through the audit tables and are never silently promoted here.
create or replace view public.v_product_safe_programmes_v3
with (security_invoker = true)
as
select
  entity.programme_entity_id,
  entity.university_id,
  entity.canonical_title,
  entity.degree_level,
  entity.credential,
  entity.lifecycle_state,
  quality.target_cycle,
  quality.audience,
  quality.policy_versions,
  quality.evaluated_at
from public.programme_entities entity
join lateral (
  select evaluation.*
  from public.programme_quality_evaluations_v3 evaluation
  where evaluation.programme_entity_id = entity.programme_entity_id
  order by evaluation.evaluated_at desc
  limit 1
) quality on quality.state = 'PRODUCT_SAFE' and quality.eligible;

create or replace view public.v_product_safe_programme_fields_v3
with (security_invoker = true)
as
select distinct on (projection.programme_entity_id, projection.target_cycle, projection.field_name)
  projection.programme_entity_id,
  projection.target_cycle,
  projection.field_name,
  projection.value_json,
  projection.assertion_id,
  projection.source_id,
  projection.raw_document_id,
  projection.epistemic_state,
  projection.temporal_state,
  projection.verification_status,
  projection.authority,
  projection.projected_at
from public.canonical_field_projection_history_v3 projection
join public.v_product_safe_programmes_v3 safe
  on safe.programme_entity_id = projection.programme_entity_id
 and safe.target_cycle is not distinct from projection.target_cycle
where projection.epistemic_state <> 'INFERRED'
  and projection.temporal_state = 'CURRENT'
order by projection.programme_entity_id, projection.target_cycle, projection.field_name, projection.projected_at desc;

alter table public.programme_entities enable row level security;
alter table public.programme_identifiers enable row level security;
alter table public.programme_aliases enable row level security;
alter table public.programme_offerings_v3 enable row level security;
alter table public.programme_relationships_v3 enable row level security;
alter table public.programme_institution_roles_v3 enable row level security;
alter table public.university_identifiers_v3 enable row level security;
alter table public.university_domain_claims_v3 enable row level security;
alter table public.identity_decisions_v3 enable row level security;
alter table public.programme_quality_evaluations_v3 enable row level security;
alter table public.promotion_evaluations_v3 enable row level security;
alter table public.promotion_audit_v3 enable row level security;
alter table public.canonical_field_projection_history_v3 enable row level security;

revoke all on table
  public.programme_entities,
  public.programme_identifiers,
  public.programme_aliases,
  public.programme_offerings_v3,
  public.programme_relationships_v3,
  public.programme_institution_roles_v3,
  public.university_identifiers_v3,
  public.university_domain_claims_v3,
  public.identity_decisions_v3,
  public.programme_quality_evaluations_v3,
  public.promotion_evaluations_v3,
  public.promotion_audit_v3,
  public.canonical_field_projection_history_v3
from anon, authenticated;

grant all on table
  public.programme_entities,
  public.programme_identifiers,
  public.programme_aliases,
  public.programme_offerings_v3,
  public.programme_relationships_v3,
  public.programme_institution_roles_v3,
  public.university_identifiers_v3,
  public.university_domain_claims_v3,
  public.identity_decisions_v3,
  public.programme_quality_evaluations_v3,
  public.promotion_evaluations_v3,
  public.promotion_audit_v3,
  public.canonical_field_projection_history_v3
to service_role;

grant select on public.v_product_safe_programmes_v3,
  public.v_product_safe_programme_fields_v3 to anon, authenticated, service_role;

commit;
