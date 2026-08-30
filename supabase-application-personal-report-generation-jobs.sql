-- Durable Personal Report AI-generation queue.
--
-- Run after supabase-application-personal-report-state.sql and before
-- deploying the accompanying worker route. One live job per application is a
-- deliberately stricter deduplication key than (application, snapshot, hash):
-- a re-confirmed snapshot is always generated from the latest frozen inputs.

create table if not exists public.application_personal_report_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null unique references public.course_applications(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'processing', 'retry', 'complete', 'blocked')),
  trigger text not null default 'manual' check (trigger in ('manual', 'matching_report', 'supplement_answer')),
  force_requested boolean not null default false,
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  confirmed_snapshot_id uuid references public.confirmed_candidate_snapshots(id) on delete set null,
  input_hash text,
  report_version_id uuid references public.student_personal_report_versions(id) on delete set null,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.application_personal_report_generation_jobs
  add column if not exists idempotency_key text;

create index if not exists idx_application_personal_report_generation_jobs_claimable
  on public.application_personal_report_generation_jobs(next_attempt_at, created_at)
  where status in ('pending', 'retry');

-- One initial run plus at most five automatic retries. Make old runaway rows
-- terminal before the claim RPC can see them.
update public.application_personal_report_generation_jobs
set
  status = 'blocked',
  force_requested = false,
  locked_at = null,
  locked_by = null,
  error_code = 'MAX_RETRIES_EXCEEDED',
  error_message = 'Automatic retry limit (5) reached.',
  completed_at = coalesce(completed_at, now()),
  updated_at = now()
where status in ('pending', 'processing', 'retry')
  and attempts >= 6;

alter table public.application_personal_report_generation_jobs enable row level security;

drop policy if exists "application_personal_report_generation_jobs_select_own" on public.application_personal_report_generation_jobs;
create policy "application_personal_report_generation_jobs_select_own"
  on public.application_personal_report_generation_jobs for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "application_personal_report_generation_jobs_insert_own" on public.application_personal_report_generation_jobs;
create policy "application_personal_report_generation_jobs_insert_own"
  on public.application_personal_report_generation_jobs for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.course_applications
      where course_applications.id = application_id
        and course_applications.user_id = auth.uid()
    )
  );

drop policy if exists "application_personal_report_generation_jobs_update_own" on public.application_personal_report_generation_jobs;
create policy "application_personal_report_generation_jobs_update_own"
  on public.application_personal_report_generation_jobs for update to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.course_applications
      where course_applications.id = application_id
        and course_applications.user_id = auth.uid()
    )
  );

drop function if exists public.claim_application_personal_report_generation_jobs(text, integer);
create function public.claim_application_personal_report_generation_jobs(
  p_worker_id text,
  p_batch_size integer default 1
)
returns setof public.application_personal_report_generation_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_worker_id is null or p_worker_id = '' then
    raise exception 'worker_id cannot be null or empty';
  end if;
  if p_batch_size is null or p_batch_size < 1 or p_batch_size > 10 then
    raise exception 'batch_size must be between 1 and 10';
  end if;

  return query
  update public.application_personal_report_generation_jobs
  set
    status = 'processing',
    attempts = attempts + 1,
    locked_at = now(),
    locked_by = p_worker_id,
    next_attempt_at = now() + interval '10 minutes',
    updated_at = now()
  where id in (
    select id
    from public.application_personal_report_generation_jobs
    where (
      (status in ('pending', 'retry') and next_attempt_at <= now())
      or (status = 'processing' and locked_at < now() - interval '10 minutes')
    )
      and attempts < 6
    order by next_attempt_at asc, created_at asc
    limit p_batch_size
    for update skip locked
  )
  returning *;
end;
$$;

revoke all on function public.claim_application_personal_report_generation_jobs(text, integer) from public, anon, authenticated;
grant execute on function public.claim_application_personal_report_generation_jobs(text, integer) to service_role;

comment on function public.claim_application_personal_report_generation_jobs(text, integer) is
  'Atomically claims Personal Report generation jobs using FOR UPDATE SKIP LOCKED.';
