-- ============================================================================
-- SAVED SCHOLARSHIPS — per-user scholarship "bucket"
-- ============================================================================
-- Backs the "Save to My Universities" button on the scholarships directory:
-- saving a scholarship records it here AND (in app code) idempotently adds the
-- scholarship's university to public.user_universities. Mirrors the
-- user_universities shape + RLS in supabase-schema.sql.
--
-- Run this in the Supabase SQL editor (the repo applies .sql files by hand).

create table if not exists public.user_scholarships (
  id              bigserial primary key,
  user_id         uuid   not null references auth.users(id) on delete cascade,
  scholarship_id  bigint not null references public.scholarships(id) on delete cascade,
  -- University this scholarship was saved under — used to nest it under the
  -- matching application / shortlisted university on the Apply page, and to
  -- decide which university to add to user_universities.
  university_id   bigint references public.universities(id) on delete set null,
  saved_at        timestamptz not null default now(),

  unique (user_id, scholarship_id)
);

alter table public.user_scholarships enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_scholarships'
      and policyname = 'Users manage own saved scholarships'
  ) then
    create policy "Users manage own saved scholarships"
      on public.user_scholarships for all
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_scholarships'
      and policyname = 'Service role full access to user_scholarships'
  ) then
    create policy "Service role full access to user_scholarships"
      on public.user_scholarships for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

create index if not exists idx_user_scholarships_user_id on public.user_scholarships(user_id);
create index if not exists idx_user_scholarships_university_id on public.user_scholarships(university_id);
