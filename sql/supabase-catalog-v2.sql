-- ============================================================================
-- GlowBal product catalogue v2
--
-- Keeps crawl_* as immutable staging/audit data and promotes reviewed,
-- product-safe projections into the existing courses catalogue plus normalized
-- academic-unit, offering, admission and provenance tables.
--
-- Prerequisites:
--   1. supabase-schema.sql / universities
--   2. supabase-apply-v2.sql / courses + course_applications
--   3. supabase-crawl-staging.sql
--   4. supabase-programme-ingestion-jobs.sql / crawl application links
--
-- Idempotent: safe to run repeatedly.
-- ============================================================================

begin;

do $$
begin
  if to_regclass('public.universities') is null
     or to_regclass('public.courses') is null
     or to_regclass('public.course_applications') is null
     or to_regclass('public.crawl_runs') is null
     or to_regclass('public.crawl_programmes') is null then
    raise exception
      'Catalog v2 prerequisites are missing. Apply university, Apply v2 and crawl staging schemas first.';
  end if;
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'course_applications'
      and column_name = 'crawl_programme_id'
  ) then
    raise exception
      'Catalog v2 requires supabase-programme-ingestion-jobs.sql first.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Existing product programme table
-- ---------------------------------------------------------------------------

alter table public.courses
  add column if not exists canonical_url text;
alter table public.courses
  add column if not exists credential text;
alter table public.courses
  add column if not exists normalized_field text;
alter table public.courses
  add column if not exists language text;
alter table public.courses
  add column if not exists campus text;
alter table public.courses
  add column if not exists programme_status text;
alter table public.courses
  add column if not exists catalogue_source text;
alter table public.courses
  add column if not exists verification_status text;
alter table public.courses
  add column if not exists source_run_id uuid;
alter table public.courses
  add column if not exists source_programme_id uuid;
alter table public.courses
  add column if not exists source_retrieved_at timestamptz;
alter table public.courses
  add column if not exists source_payload jsonb not null default '{}'::jsonb;

update public.courses
set canonical_url = course_url
where canonical_url is null;

create unique index if not exists idx_courses_canonical_url
  on public.courses(canonical_url)
  where canonical_url is not null;

create index if not exists idx_courses_source_programme
  on public.courses(source_programme_id)
  where source_programme_id is not null;

create index if not exists idx_courses_verification
  on public.courses(verification_status, programme_status);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'courses_source_programme_fkey'
      and conrelid = 'public.courses'::regclass
  ) then
    alter table public.courses
      add constraint courses_source_programme_fkey
      foreign key (source_run_id, source_programme_id)
      references public.crawl_programmes(run_id, programme_id);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- University profile and academic hierarchy
-- ---------------------------------------------------------------------------

create table if not exists public.university_profiles (
  university_id bigint primary key
    references public.universities(id) on delete cascade,
  fields jsonb not null default '{}'::jsonb,
  source_urls text[] not null default '{}',
  verification_status text not null default 'NEEDS_REVIEW',
  source_run_id uuid not null references public.crawl_runs(id),
  source_institution_id text not null,
  retrieved_at timestamptz not null,
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(fields) = 'object'),
  check (
    verification_status in (
      'DISCOVERED', 'FETCHED', 'AI_EXTRACTED', 'RULE_VALIDATED',
      'NEEDS_REVIEW', 'HUMAN_VERIFIED'
    )
  )
);

create table if not exists public.academic_units (
  id uuid primary key,
  university_id bigint not null
    references public.universities(id) on delete cascade,
  parent_id uuid references public.academic_units(id) on delete set null,
  unit_name text not null,
  unit_type text not null,
  official_url text,
  source_url text not null,
  evidence text,
  confidence double precision not null,
  verification_status text not null,
  source_run_id uuid not null references public.crawl_runs(id),
  source_organisation_unit_id uuid not null,
  retrieved_at timestamptz not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (university_id, source_organisation_unit_id),
  check (
    unit_type in (
      'school', 'college', 'faculty', 'division',
      'institute', 'department', 'other'
    )
  ),
  check (confidence between 0 and 1),
  check (
    verification_status in (
      'DISCOVERED', 'FETCHED', 'AI_EXTRACTED', 'RULE_VALIDATED',
      'NEEDS_REVIEW', 'HUMAN_VERIFIED'
    )
  ),
  check (parent_id is null or parent_id <> id)
);

create index if not exists idx_academic_units_university_parent
  on public.academic_units(university_id, parent_id, unit_type);

create table if not exists public.course_academic_units (
  course_id uuid not null references public.courses(id) on delete cascade,
  academic_unit_id uuid not null
    references public.academic_units(id) on delete cascade,
  relationship_type text not null,
  is_primary boolean not null default false,
  source_url text not null,
  evidence text,
  confidence double precision not null,
  verification_status text not null,
  source_run_id uuid not null references public.crawl_runs(id),
  retrieved_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (course_id, academic_unit_id, relationship_type),
  check (relationship_type in ('administered_by', 'offered_by', 'joint')),
  check (confidence between 0 and 1),
  check (
    verification_status in (
      'DISCOVERED', 'FETCHED', 'AI_EXTRACTED', 'RULE_VALIDATED',
      'NEEDS_REVIEW', 'HUMAN_VERIFIED'
    )
  )
);

create index if not exists idx_course_academic_units_primary
  on public.course_academic_units(course_id, is_primary);

-- ---------------------------------------------------------------------------
-- Programme offerings and versioned product facts
-- ---------------------------------------------------------------------------

create table if not exists public.course_offerings (
  id uuid primary key,
  course_id uuid not null references public.courses(id) on delete cascade,
  academic_cycle text,
  intake text,
  campus text,
  delivery_mode text,
  audience text,
  application_status text,
  source_run_id uuid not null references public.crawl_runs(id),
  source_programme_offering_id uuid not null,
  source_retrieved_at timestamptz not null,
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, source_programme_offering_id)
);

create index if not exists idx_course_offerings_lookup
  on public.course_offerings(course_id, academic_cycle, audience);

create table if not exists public.course_field_values (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
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
  display_mode text not null,
  use_for_eligibility boolean not null default false,
  validation_errors text[] not null default '{}',
  source_run_id uuid not null references public.crawl_runs(id),
  source_assertion_id uuid not null,
  source_content_hash text,
  created_at timestamptz not null default now(),
  unique (source_run_id, source_assertion_id),
  check (confidence between 0 and 1),
  check (
    verification_status in (
      'DISCOVERED', 'FETCHED', 'AI_EXTRACTED', 'RULE_VALIDATED',
      'NEEDS_REVIEW', 'HUMAN_VERIFIED'
    )
  ),
  check (
    display_mode in (
      'structured', 'source_excerpt', 'not_published', 'unavailable'
    )
  ),
  check (value_json is not null or null_reason is not null),
  check (
    not use_for_eligibility
    or (
      verification_status in ('RULE_VALIDATED', 'HUMAN_VERIFIED')
      and value_json is not null
      and null_reason is null
      and cardinality(validation_errors) = 0
    )
  )
);

create index if not exists idx_course_field_values_lookup
  on public.course_field_values(
    course_id,
    field_name,
    audience,
    academic_cycle,
    retrieved_at desc
  );

create index if not exists idx_course_field_values_eligibility
  on public.course_field_values(course_id, field_name)
  where use_for_eligibility;

create table if not exists public.course_admission_requirements (
  course_id uuid not null references public.courses(id) on delete cascade,
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
  display_mode text not null,
  use_for_eligibility boolean not null default false,
  source_run_id uuid not null references public.crawl_runs(id),
  source_programme_id uuid not null,
  source_retrieved_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (course_id, document_type),
  check (
    requirement_status in (
      'required', 'optional', 'conditional', 'not_required', 'unknown'
    )
  ),
  check (
    application_stage in (
      'initial_application', 'after_offer', 'enrollment', 'unknown'
    )
  ),
  check (
    count_scope in (
      'document_total', 'primary_component', 'component_breakdown'
    )
  ),
  check (required_count is null or required_count >= 0),
  check (jsonb_typeof(components) = 'array'),
  check (jsonb_typeof(evidence) = 'array'),
  check (
    display_mode in ('structured', 'source_excerpt', 'unavailable')
  ),
  check (not use_for_eligibility or display_mode = 'structured')
);

create index if not exists idx_course_admission_package
  on public.course_admission_requirements(
    course_id,
    application_stage,
    requirement_status
  );

create table if not exists public.catalog_promotions (
  source_run_id uuid primary key references public.crawl_runs(id),
  source_run_key text not null,
  status text not null default 'completed',
  promoted_at timestamptz not null default now(),
  counts jsonb not null default '{}'::jsonb,
  check (status in ('completed', 'superseded'))
);

-- Existing applications retain crawl provenance while gaining the stable
-- product course relationship.
alter table public.course_applications
  add column if not exists catalog_linked_at timestamptz;

-- ---------------------------------------------------------------------------
-- Product-safe views
-- ---------------------------------------------------------------------------

create or replace view public.course_current_field_values
with (security_invoker = true)
as
select distinct on (
  value.course_id,
  value.field_name,
  coalesce(value.audience, '')
)
  value.id,
  value.course_id,
  value.field_name,
  value.value_json,
  value.null_reason,
  value.source_url,
  value.source_type,
  value.evidence,
  value.evidence_locator,
  value.scope,
  value.audience,
  value.academic_cycle,
  value.retrieved_at,
  value.confidence,
  value.verification_status,
  value.display_mode,
  value.use_for_eligibility,
  value.validation_errors,
  value.source_run_id,
  value.source_assertion_id
from public.course_field_values value
order by
  value.course_id,
  value.field_name,
  coalesce(value.audience, ''),
  case value.verification_status
    when 'HUMAN_VERIFIED' then 5
    when 'RULE_VALIDATED' then 4
    when 'AI_EXTRACTED' then 3
    when 'FETCHED' then 2
    when 'DISCOVERED' then 1
    else 0
  end desc,
  value.retrieved_at desc,
  value.confidence desc,
  value.id;

create or replace view public.catalog_programmes
with (security_invoker = true)
as
select
  course.id as programme_id,
  course.university_id,
  course.university_name,
  course.course_name as programme_name,
  course.course_url as official_url,
  course.canonical_url,
  course.degree_level,
  course.credential,
  course.subject,
  course.normalized_field,
  course.study_mode as delivery_mode,
  course.duration,
  course.language,
  course.campus,
  course.programme_status,
  course.verification_status,
  course.source_run_id,
  course.source_programme_id,
  course.source_retrieved_at,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', unit.id,
        'name', unit.unit_name,
        'type', unit.unit_type,
        'parent_id', unit.parent_id,
        'relationship_type', relation.relationship_type,
        'is_primary', relation.is_primary,
        'verification_status', relation.verification_status,
        'source_url', relation.source_url
      )
      order by relation.is_primary desc, unit.unit_name
    ) filter (where unit.id is not null),
    '[]'::jsonb
  ) as academic_units
from public.courses course
left join public.course_academic_units relation
  on relation.course_id = course.id
left join public.academic_units unit
  on unit.id = relation.academic_unit_id
group by course.id;

-- ---------------------------------------------------------------------------
-- Idempotent promotion RPC
-- ---------------------------------------------------------------------------

create or replace function public.promote_crawl_run(
  p_run_id uuid,
  p_dry_run boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_run public.crawl_runs%rowtype;
  profile_count integer := 0;
  unit_count integer := 0;
  programme_count integer := 0;
  relation_count integer := 0;
  offering_count integer := 0;
  fact_count integer := 0;
  requirement_count integer := 0;
  application_count integer := 0;
  planned jsonb;
begin
  select *
  into selected_run
  from public.crawl_runs
  where id = p_run_id;

  if not found then
    raise exception 'crawl run % does not exist', p_run_id;
  end if;
  if selected_run.status not in ('completed', 'approved') then
    raise exception
      'crawl run % must be completed or approved, current status=%',
      p_run_id,
      selected_run.status;
  end if;
  if exists (
    select 1
    from public.crawl_institutions
    where run_id = p_run_id
      and university_id is null
  ) then
    raise exception
      'crawl run % contains institutions that are not linked to universities',
      p_run_id;
  end if;

  select jsonb_build_object(
    'university_profiles', (
      select count(*)
      from public.crawl_institutions
      where run_id = p_run_id
        and payload ? 'school_profile'
    ),
    'academic_units', (
      select count(*)
      from public.crawl_organisation_units
      where run_id = p_run_id
        and verification_status <> 'REJECTED'
    ),
    'programmes', (
      select count(*)
      from public.crawl_programmes
      where run_id = p_run_id
        and verification_status <> 'REJECTED'
    ),
    'programme_academic_units', (
      select count(*)
      from public.crawl_programme_organisation_units
      where run_id = p_run_id
        and verification_status <> 'REJECTED'
    ),
    'offerings', (
      select count(*)
      from public.crawl_programme_offerings
      where run_id = p_run_id
    ),
    'field_values', (
      select count(*)
      from public.crawl_field_assertions
      where run_id = p_run_id
        and entity_type = 'programme'
        and is_effective
        and verification_status <> 'REJECTED'
    ),
    'admission_requirements', (
      select count(*)
      from public.crawl_admission_requirements
      where run_id = p_run_id
    )
  )
  into planned;

  if p_dry_run then
    return jsonb_build_object(
      'ok', true,
      'dry_run', true,
      'run_id', p_run_id,
      'run_key', selected_run.run_key,
      'planned', planned
    );
  end if;

  insert into public.university_profiles (
    university_id,
    fields,
    source_urls,
    verification_status,
    source_run_id,
    source_institution_id,
    retrieved_at,
    updated_at
  )
  select
    institution.university_id,
    coalesce(
      institution.payload #> '{school_profile,fields}',
      '{}'::jsonb
    ),
    coalesce(
      array(
        select jsonb_array_elements_text(
          coalesce(
            institution.payload #> '{school_profile,source_urls}',
            '[]'::jsonb
          )
        )
      ),
      '{}'
    ),
    case
      when institution.verification_status in (
        'HUMAN_VERIFIED', 'RULE_VALIDATED'
      ) then institution.verification_status
      else 'NEEDS_REVIEW'
    end,
    p_run_id,
    institution.institution_id,
    coalesce(
      institution.last_checked_at,
      selected_run.finished_at,
      selected_run.imported_at
    ),
    now()
  from public.crawl_institutions institution
  where institution.run_id = p_run_id
    and institution.university_id is not null
    and institution.payload ? 'school_profile'
  on conflict (university_id) do update
  set
    fields = excluded.fields,
    source_urls = excluded.source_urls,
    verification_status = excluded.verification_status,
    source_run_id = excluded.source_run_id,
    source_institution_id = excluded.source_institution_id,
    retrieved_at = excluded.retrieved_at,
    updated_at = now()
  where excluded.retrieved_at >= university_profiles.retrieved_at;
  get diagnostics profile_count = row_count;

  -- Insert units without parents first so arbitrary JSONL ordering cannot
  -- violate the self-referencing foreign key.
  insert into public.academic_units (
    id,
    university_id,
    parent_id,
    unit_name,
    unit_type,
    official_url,
    source_url,
    evidence,
    confidence,
    verification_status,
    source_run_id,
    source_organisation_unit_id,
    retrieved_at,
    updated_at
  )
  select
    unit.organisation_unit_id,
    institution.university_id,
    null,
    unit.unit_name,
    unit.unit_type,
    unit.official_url,
    unit.source_url,
    unit.evidence,
    unit.confidence,
    unit.verification_status,
    p_run_id,
    unit.organisation_unit_id,
    coalesce(
      unit.retrieved_at,
      selected_run.finished_at,
      selected_run.imported_at
    ),
    now()
  from public.crawl_organisation_units unit
  join public.crawl_institutions institution
    on institution.run_id = unit.run_id
   and institution.institution_id = unit.institution_id
  where unit.run_id = p_run_id
    and unit.verification_status <> 'REJECTED'
    and institution.university_id is not null
  on conflict (id) do update
  set
    university_id = excluded.university_id,
    unit_name = excluded.unit_name,
    unit_type = excluded.unit_type,
    official_url = excluded.official_url,
    source_url = excluded.source_url,
    evidence = excluded.evidence,
    confidence = excluded.confidence,
    verification_status = excluded.verification_status,
    source_run_id = excluded.source_run_id,
    source_organisation_unit_id = excluded.source_organisation_unit_id,
    retrieved_at = excluded.retrieved_at,
    is_active = true,
    updated_at = now()
  where excluded.retrieved_at >= academic_units.retrieved_at;
  get diagnostics unit_count = row_count;

  update public.academic_units child
  set
    parent_id = parent.id,
    updated_at = now()
  from public.crawl_organisation_units source_child
  join public.academic_units parent
    on parent.id = source_child.parent_organisation_unit_id
  where source_child.run_id = p_run_id
    and source_child.organisation_unit_id = child.id
    and source_child.parent_organisation_unit_id is not null
    and child.university_id = parent.university_id
    and child.id <> parent.id;

  insert into public.courses (
    university_id,
    university_name,
    course_name,
    course_url,
    canonical_url,
    degree_level,
    subject,
    study_mode,
    duration,
    country,
    credential,
    normalized_field,
    language,
    campus,
    programme_status,
    catalogue_source,
    source_confidence,
    extraction_status,
    verification_status,
    source_run_id,
    source_programme_id,
    source_retrieved_at,
    source_payload,
    last_extracted_at,
    updated_at
  )
  select
    institution.university_id,
    institution.canonical_name,
    programme.programme_name,
    programme.official_url,
    programme.official_url,
    programme.degree_level,
    programme.normalized_field,
    programme.delivery_mode,
    programme.duration,
    institution.country_code,
    programme.credential,
    programme.normalized_field,
    programme.language,
    programme.campus,
    programme.programme_status,
    programme.catalogue_source,
    case programme.verification_status
      when 'HUMAN_VERIFIED' then 1.0
      when 'RULE_VALIDATED' then 0.9
      when 'AI_EXTRACTED' then 0.75
      when 'FETCHED' then 0.65
      when 'DISCOVERED' then 0.55
      else 0.5
    end,
    case
      when programme.verification_status = 'NEEDS_REVIEW'
        then 'needs_review'
      else 'extracted'
    end,
    programme.verification_status,
    p_run_id,
    programme.programme_id,
    programme.retrieved_at,
    programme.payload,
    programme.retrieved_at,
    now()
  from public.crawl_programmes programme
  join public.crawl_institutions institution
    on institution.run_id = programme.run_id
   and institution.institution_id = programme.institution_id
  where programme.run_id = p_run_id
    and programme.verification_status <> 'REJECTED'
    and institution.university_id is not null
  on conflict (course_url) do update
  set
    university_id = excluded.university_id,
    university_name = excluded.university_name,
    course_name = excluded.course_name,
    canonical_url = excluded.canonical_url,
    degree_level = excluded.degree_level,
    subject = excluded.subject,
    study_mode = excluded.study_mode,
    duration = excluded.duration,
    country = excluded.country,
    credential = excluded.credential,
    normalized_field = excluded.normalized_field,
    language = excluded.language,
    campus = excluded.campus,
    programme_status = excluded.programme_status,
    catalogue_source = excluded.catalogue_source,
    source_confidence = excluded.source_confidence,
    extraction_status = excluded.extraction_status,
    verification_status = excluded.verification_status,
    source_run_id = excluded.source_run_id,
    source_programme_id = excluded.source_programme_id,
    source_retrieved_at = excluded.source_retrieved_at,
    source_payload = excluded.source_payload,
    last_extracted_at = excluded.last_extracted_at,
    updated_at = now()
  where courses.source_retrieved_at is null
     or excluded.source_retrieved_at >= courses.source_retrieved_at;
  get diagnostics programme_count = row_count;

  insert into public.course_academic_units (
    course_id,
    academic_unit_id,
    relationship_type,
    is_primary,
    source_url,
    evidence,
    confidence,
    verification_status,
    source_run_id,
    retrieved_at,
    updated_at
  )
  select
    course.id,
    unit.id,
    relation.relationship_type,
    relation.is_primary,
    relation.source_url,
    relation.evidence,
    relation.confidence,
    relation.verification_status,
    p_run_id,
    programme.retrieved_at,
    now()
  from public.crawl_programme_organisation_units relation
  join public.crawl_programmes programme
    on programme.run_id = relation.run_id
   and programme.programme_id = relation.programme_id
  join public.courses course
    on course.course_url = programme.official_url
  join public.academic_units unit
    on unit.id = relation.organisation_unit_id
  where relation.run_id = p_run_id
    and relation.verification_status <> 'REJECTED'
    and programme.verification_status <> 'REJECTED'
  on conflict (course_id, academic_unit_id, relationship_type) do update
  set
    is_primary = excluded.is_primary,
    source_url = excluded.source_url,
    evidence = excluded.evidence,
    confidence = excluded.confidence,
    verification_status = excluded.verification_status,
    source_run_id = excluded.source_run_id,
    retrieved_at = excluded.retrieved_at,
    updated_at = now()
  where excluded.retrieved_at >= course_academic_units.retrieved_at;
  get diagnostics relation_count = row_count;

  insert into public.course_offerings (
    id,
    course_id,
    academic_cycle,
    intake,
    campus,
    delivery_mode,
    audience,
    application_status,
    source_run_id,
    source_programme_offering_id,
    source_retrieved_at,
    source_payload,
    updated_at
  )
  select
    offering.programme_offering_id,
    course.id,
    offering.academic_cycle,
    offering.intake,
    offering.campus,
    offering.delivery_mode,
    offering.audience,
    offering.application_status,
    p_run_id,
    offering.programme_offering_id,
    programme.retrieved_at,
    offering.payload,
    now()
  from public.crawl_programme_offerings offering
  join public.crawl_programmes programme
    on programme.run_id = offering.run_id
   and programme.programme_id = offering.programme_id
  join public.courses course
    on course.course_url = programme.official_url
  where offering.run_id = p_run_id
    and programme.verification_status <> 'REJECTED'
  on conflict (id) do update
  set
    course_id = excluded.course_id,
    academic_cycle = excluded.academic_cycle,
    intake = excluded.intake,
    campus = excluded.campus,
    delivery_mode = excluded.delivery_mode,
    audience = excluded.audience,
    application_status = excluded.application_status,
    source_run_id = excluded.source_run_id,
    source_programme_offering_id =
      excluded.source_programme_offering_id,
    source_retrieved_at = excluded.source_retrieved_at,
    source_payload = excluded.source_payload,
    updated_at = now()
  where excluded.source_retrieved_at >= course_offerings.source_retrieved_at;
  get diagnostics offering_count = row_count;

  insert into public.course_field_values (
    course_id,
    field_name,
    value_json,
    null_reason,
    source_url,
    source_type,
    evidence,
    evidence_locator,
    scope,
    audience,
    academic_cycle,
    retrieved_at,
    confidence,
    verification_status,
    display_mode,
    use_for_eligibility,
    validation_errors,
    source_run_id,
    source_assertion_id,
    source_content_hash
  )
  select
    course.id,
    assertion.field_name,
    assertion.value_json,
    assertion.null_reason,
    assertion.source_url,
    assertion.source_type,
    assertion.evidence,
    assertion.evidence_locator,
    assertion.scope,
    assertion.audience,
    assertion.academic_cycle,
    assertion.retrieved_at,
    assertion.confidence,
    assertion.verification_status,
    case
      when assertion.null_reason = 'NOT_PUBLISHED'
        then 'not_published'
      when assertion.verification_status in (
        'HUMAN_VERIFIED', 'RULE_VALIDATED'
      )
        and assertion.value_json is not null
        and cardinality(assertion.validation_errors) = 0
        then 'structured'
      when assertion.source_url is not null
        and assertion.evidence is not null
        then 'source_excerpt'
      else 'unavailable'
    end,
    assertion.field_name in (
      'programme_status',
      'minimum_degree',
      'minimum_gpa',
      'gpa_scale',
      'subject_prerequisites',
      'ielts_overall',
      'ielts_subscores',
      'toefl',
      'duolingo',
      'standardized_tests',
      'work_experience',
      'portfolio',
      'required_documents',
      'recommendation_letters',
      'sop_essay_requirements',
      'graduation_certificate',
      'academic_transcript'
    )
      and assertion.verification_status in (
        'HUMAN_VERIFIED', 'RULE_VALIDATED'
      )
      and assertion.value_json is not null
      and assertion.null_reason is null
      and cardinality(assertion.validation_errors) = 0,
    assertion.validation_errors,
    p_run_id,
    assertion.assertion_id,
    assertion.source_content_hash
  from public.crawl_field_assertions assertion
  join public.crawl_programmes programme
    on programme.run_id = assertion.run_id
   and programme.programme_id::text = assertion.entity_id
  join public.courses course
    on course.course_url = programme.official_url
  where assertion.run_id = p_run_id
    and assertion.entity_type = 'programme'
    and assertion.is_effective
    and assertion.verification_status <> 'REJECTED'
    and programme.verification_status <> 'REJECTED'
  on conflict (source_run_id, source_assertion_id) do update
  set
    course_id = excluded.course_id,
    field_name = excluded.field_name,
    value_json = excluded.value_json,
    null_reason = excluded.null_reason,
    source_url = excluded.source_url,
    source_type = excluded.source_type,
    evidence = excluded.evidence,
    evidence_locator = excluded.evidence_locator,
    scope = excluded.scope,
    audience = excluded.audience,
    academic_cycle = excluded.academic_cycle,
    retrieved_at = excluded.retrieved_at,
    confidence = excluded.confidence,
    verification_status = excluded.verification_status,
    display_mode = excluded.display_mode,
    use_for_eligibility = excluded.use_for_eligibility,
    validation_errors = excluded.validation_errors,
    source_content_hash = excluded.source_content_hash;
  get diagnostics fact_count = row_count;

  insert into public.course_admission_requirements (
    course_id,
    document_type,
    source_field,
    requirement_status,
    required_count,
    count_scope,
    application_stage,
    accepted_alternatives,
    components,
    conflict,
    conflict_reasons,
    evidence,
    display_mode,
    use_for_eligibility,
    source_run_id,
    source_programme_id,
    source_retrieved_at,
    updated_at
  )
  select
    course.id,
    requirement.document_type,
    requirement.source_field,
    requirement.requirement_status,
    requirement.required_count,
    requirement.count_scope,
    requirement.application_stage,
    requirement.accepted_alternatives,
    requirement.components,
    requirement.conflict,
    requirement.conflict_reasons,
    requirement.evidence,
    case
      when requirement.requirement_status <> 'unknown'
        and not requirement.conflict
        and exists (
          select 1
          from jsonb_array_elements(requirement.evidence) evidence_item
          where evidence_item->>'verification_status'
            in ('HUMAN_VERIFIED', 'RULE_VALIDATED')
        )
        then 'structured'
      when jsonb_array_length(requirement.evidence) > 0
        then 'source_excerpt'
      else 'unavailable'
    end,
    requirement.requirement_status <> 'unknown'
      and not requirement.conflict
      and exists (
        select 1
        from jsonb_array_elements(requirement.evidence) evidence_item
        where evidence_item->>'verification_status'
          in ('HUMAN_VERIFIED', 'RULE_VALIDATED')
      ),
    p_run_id,
    requirement.programme_id,
    programme.retrieved_at,
    now()
  from public.crawl_admission_requirements requirement
  join public.crawl_programmes programme
    on programme.run_id = requirement.run_id
   and programme.programme_id = requirement.programme_id
  join public.courses course
    on course.course_url = programme.official_url
  where requirement.run_id = p_run_id
    and programme.verification_status <> 'REJECTED'
  on conflict (course_id, document_type) do update
  set
    source_field = excluded.source_field,
    requirement_status = excluded.requirement_status,
    required_count = excluded.required_count,
    count_scope = excluded.count_scope,
    application_stage = excluded.application_stage,
    accepted_alternatives = excluded.accepted_alternatives,
    components = excluded.components,
    conflict = excluded.conflict,
    conflict_reasons = excluded.conflict_reasons,
    evidence = excluded.evidence,
    display_mode = excluded.display_mode,
    use_for_eligibility = excluded.use_for_eligibility,
    source_run_id = excluded.source_run_id,
    source_programme_id = excluded.source_programme_id,
    source_retrieved_at = excluded.source_retrieved_at,
    updated_at = now()
  where excluded.source_retrieved_at >=
    course_admission_requirements.source_retrieved_at;
  get diagnostics requirement_count = row_count;

  update public.course_applications application
  set
    course_id = course.id,
    catalog_linked_at = now(),
    updated_at = now()
  from public.courses course
  where application.crawl_programme_id = course.source_programme_id
    and application.course_id is distinct from course.id;
  get diagnostics application_count = row_count;

  insert into public.catalog_promotions (
    source_run_id,
    source_run_key,
    status,
    promoted_at,
    counts
  )
  values (
    p_run_id,
    selected_run.run_key,
    'completed',
    now(),
    jsonb_build_object(
      'university_profiles', profile_count,
      'academic_units', unit_count,
      'programmes', programme_count,
      'programme_academic_units', relation_count,
      'offerings', offering_count,
      'field_values', fact_count,
      'admission_requirements', requirement_count,
      'applications_linked', application_count
    )
  )
  on conflict (source_run_id) do update
  set
    source_run_key = excluded.source_run_key,
    status = excluded.status,
    promoted_at = excluded.promoted_at,
    counts = excluded.counts;

  return jsonb_build_object(
    'ok', true,
    'dry_run', false,
    'run_id', p_run_id,
    'run_key', selected_run.run_key,
    'counts', jsonb_build_object(
      'university_profiles', profile_count,
      'academic_units', unit_count,
      'programmes', programme_count,
      'programme_academic_units', relation_count,
      'offerings', offering_count,
      'field_values', fact_count,
      'admission_requirements', requirement_count,
      'applications_linked', application_count
    )
  );
end;
$$;

revoke all on function public.promote_crawl_run(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.promote_crawl_run(uuid, boolean)
  to service_role;

create or replace function public.promote_crawl_run_by_key(
  p_run_key text,
  p_dry_run boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_run_id uuid;
begin
  select id
  into resolved_run_id
  from public.crawl_runs
  where run_key = p_run_key;

  if resolved_run_id is null then
    raise exception 'crawl run key % does not exist', p_run_key;
  end if;

  return public.promote_crawl_run(
    resolved_run_id,
    p_dry_run
  );
end;
$$;

revoke all on function public.promote_crawl_run_by_key(text, boolean)
  from public, anon, authenticated;
grant execute on function public.promote_crawl_run_by_key(text, boolean)
  to service_role;

-- ---------------------------------------------------------------------------
-- RLS: product catalogue is readable by signed-in users, writable by service
-- ---------------------------------------------------------------------------

alter table public.courses enable row level security;
alter table public.university_profiles enable row level security;
alter table public.academic_units enable row level security;
alter table public.course_academic_units enable row level security;
alter table public.course_offerings enable row level security;
alter table public.course_field_values enable row level security;
alter table public.course_admission_requirements enable row level security;
alter table public.catalog_promotions enable row level security;

do $$
declare
  v_table_name text;
  policy_name text;
begin
  foreach v_table_name in array array[
    'courses',
    'university_profiles',
    'academic_units',
    'course_academic_units',
    'course_offerings',
    'course_field_values',
    'course_admission_requirements'
  ]
  loop
    policy_name := 'Authenticated users can read ' || v_table_name;
    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = v_table_name
        and policyname = policy_name
    ) then
      execute format(
        'create policy %I on public.%I for select to authenticated using (true)',
        policy_name,
        v_table_name
      );
    end if;
  end loop;
end $$;

revoke insert, update, delete on
  public.university_profiles,
  public.academic_units,
  public.course_academic_units,
  public.course_offerings,
  public.course_field_values,
  public.course_admission_requirements,
  public.catalog_promotions
from anon, authenticated;

grant select on
  public.courses,
  public.university_profiles,
  public.academic_units,
  public.course_academic_units,
  public.course_offerings,
  public.course_field_values,
  public.course_admission_requirements,
  public.course_current_field_values,
  public.catalog_programmes
to authenticated;

grant all on
  public.university_profiles,
  public.academic_units,
  public.course_academic_units,
  public.course_offerings,
  public.course_field_values,
  public.course_admission_requirements,
  public.catalog_promotions
to service_role;

grant select on
  public.course_current_field_values,
  public.catalog_programmes
to service_role;

commit;
