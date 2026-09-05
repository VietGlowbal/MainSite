-- ============================================================================
-- Programme Ingestion Jobs — Supabase migration
-- Idempotent: safe to run repeatedly.
-- ============================================================================
-- Provides:
--   public.programme_ingestion_jobs   — durable job queue
--   public.claim_programme_ingestion_jobs(worker_id, batch_size)  — atomic claim RPC
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table if not exists public.programme_ingestion_jobs (
  id                  uuid primary key default gen_random_uuid(),
  application_id      uuid not null,
  user_id             uuid not null,
  university_id       bigint,
  institution_id      text,
  submitted_url       text not null,
  canonical_url       text not null,
  status              text not null default 'pending'
    check (status in (
      'pending', 'processing', 'complete',
      'needs_review', 'retry', 'failed', 'cancelled'
    )),
  stage               text,
  progress_percentage integer not null default 0
    check (progress_percentage between 0 and 100),
  attempts            integer not null default 0,
  max_attempts        integer not null default 3,
  next_attempt_at     timestamptz not null default now(),
  locked_at           timestamptz,
  locked_by           text,
  result_run_id       uuid,
  result_programme_id uuid,
  cache_hit           boolean,
  error_code          text,
  error_message       text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  started_at          timestamptz,
  completed_at        timestamptz,
  -- one job per application (idempotent upsert)
  unique (application_id)
);

-- Product linkage on the Apply record. These are nullable because the
-- application exists while its ingestion job is still pending.
alter table public.course_applications
  add column if not exists course_url_canonical text;
alter table public.course_applications
  add column if not exists crawl_run_id uuid;
alter table public.course_applications
  add column if not exists crawl_programme_id uuid;
alter table public.course_applications
  add column if not exists ingestion_job_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname in (
        'programme_ingestion_jobs_application_fkey',
        'programme_ingestion_jobs_application_id_fkey'
      )
      and conrelid = 'public.programme_ingestion_jobs'::regclass
  ) then
    alter table public.programme_ingestion_jobs
      add constraint programme_ingestion_jobs_application_fkey
      foreign key (application_id)
      references public.course_applications(id)
      on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname in (
        'programme_ingestion_jobs_user_fkey',
        'programme_ingestion_jobs_user_id_fkey'
      )
      and conrelid = 'public.programme_ingestion_jobs'::regclass
  ) then
    alter table public.programme_ingestion_jobs
      add constraint programme_ingestion_jobs_user_fkey
      foreign key (user_id)
      references auth.users(id)
      on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname in (
        'programme_ingestion_jobs_university_fkey',
        'programme_ingestion_jobs_university_id_fkey'
      )
      and conrelid = 'public.programme_ingestion_jobs'::regclass
  ) then
    alter table public.programme_ingestion_jobs
      add constraint programme_ingestion_jobs_university_fkey
      foreign key (university_id)
      references public.universities(id)
      on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'programme_ingestion_jobs_result_programme_fkey'
      and conrelid = 'public.programme_ingestion_jobs'::regclass
  ) then
    alter table public.programme_ingestion_jobs
      add constraint programme_ingestion_jobs_result_programme_fkey
      foreign key (result_run_id, result_programme_id)
      references public.crawl_programmes(run_id, programme_id)
      on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'course_applications_crawl_programme_fkey'
      and conrelid = 'public.course_applications'::regclass
  ) then
    alter table public.course_applications
      add constraint course_applications_crawl_programme_fkey
      foreign key (crawl_run_id, crawl_programme_id)
      references public.crawl_programmes(run_id, programme_id)
      on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'course_applications_ingestion_job_fkey'
      and conrelid = 'public.course_applications'::regclass
  ) then
    alter table public.course_applications
      add constraint course_applications_ingestion_job_fkey
      foreign key (ingestion_job_id)
      references public.programme_ingestion_jobs(id)
      on delete set null;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- Claimable jobs: status + retry time
create index if not exists idx_programme_ingestion_jobs_claimable
  on public.programme_ingestion_jobs (next_attempt_at, created_at)
  where status in ('pending', 'retry') and attempts < max_attempts;

-- Cache lookup by canonical URL
create index if not exists idx_programme_ingestion_jobs_canonical_url
  on public.programme_ingestion_jobs (canonical_url);

-- Application lookup
create index if not exists idx_programme_ingestion_jobs_application_id
  on public.programme_ingestion_jobs (application_id);

-- User's own jobs
create index if not exists idx_programme_ingestion_jobs_user_id
  on public.programme_ingestion_jobs (user_id);

create unique index if not exists idx_course_applications_active_canonical_url
  on public.course_applications (user_id, course_url_canonical)
  where course_url_canonical is not null
    and status <> 'archived';

-- ---------------------------------------------------------------------------
-- Atomic claim RPC (FOR UPDATE SKIP LOCKED)
-- ---------------------------------------------------------------------------
drop function if exists public.claim_programme_ingestion_jobs(text, int);

create or replace function public.claim_programme_ingestion_jobs(
  p_worker_id text,
  p_batch_size int default 1
)
returns setof public.programme_ingestion_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_worker_id is null or p_worker_id = '' then
    raise exception 'worker_id cannot be null or empty';
  end if;
  if p_batch_size is null or p_batch_size < 1 then
    raise exception 'batch_size must be at least 1';
  end if;
  if p_batch_size > 10 then
    raise exception 'batch_size cannot exceed 10';
  end if;

  -- Exhausted retries must become terminal, including a worker that died
  -- during its final attempt. A 20-minute processing lease is longer than
  -- the default bounded 10-minute pipeline runtime.
  update public.programme_ingestion_jobs
  set
    status = 'failed',
    stage = 'failed',
    progress_percentage = 100,
    error_code = coalesce(error_code, 'MAX_ATTEMPTS_EXCEEDED'),
    error_message = coalesce(error_message, 'Maximum attempts exceeded.'),
    locked_at = null,
    locked_by = null,
    completed_at = coalesce(completed_at, now()),
    updated_at = now()
  where attempts >= max_attempts
    and (
      status = 'retry'
      or (
        status = 'processing'
        and locked_at < now() - interval '20 minutes'
      )
    );

  return query
  update public.programme_ingestion_jobs
  set
    status           = 'processing',
    stage            = 'cache_lookup',
    attempts         = attempts + 1,
    locked_at        = now(),
    locked_by        = p_worker_id,
    started_at       = coalesce(started_at, now()),
    next_attempt_at  = now() + interval '20 minutes',
    updated_at       = now()
  where id in (
    select id
    from public.programme_ingestion_jobs
    where (
        status in ('pending', 'retry')
        or (
          status = 'processing'
          and locked_at < now() - interval '20 minutes'
        )
      )
      and attempts < max_attempts
      and (
        next_attempt_at <= now()
        or (
          status = 'processing'
          and locked_at < now() - interval '20 minutes'
        )
      )
    order by next_attempt_at asc, created_at asc
    limit p_batch_size
    for update skip locked
  )
  returning *;
end;
$$;

-- Only service role may call this
revoke all on function public.claim_programme_ingestion_jobs(text, int) from public, anon, authenticated;
grant execute on function public.claim_programme_ingestion_jobs(text, int) to service_role;

comment on function public.claim_programme_ingestion_jobs(text, int) is
'Atomically claim pending programme ingestion jobs. Uses FOR UPDATE SKIP LOCKED.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.programme_ingestion_jobs enable row level security;

-- Service role: full access (no RLS policy needed — bypasses RLS by default)
-- Authenticated users: read their own job status only
drop policy if exists "Users can read own ingestion jobs" on public.programme_ingestion_jobs;
create policy "Users can read own ingestion jobs"
  on public.programme_ingestion_jobs
  for select
  to authenticated
  using (user_id = auth.uid());

-- No authenticated insert/update — server-side only
revoke insert, update, delete on public.programme_ingestion_jobs from anon, authenticated;
grant select on public.programme_ingestion_jobs to authenticated;
grant all on public.programme_ingestion_jobs to service_role;

commit;
