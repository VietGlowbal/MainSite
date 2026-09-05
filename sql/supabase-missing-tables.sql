-- ============================================================================
-- GLOWBAL — MISSING TABLES MIGRATION
-- Adds tables that were referenced by the app but not in supabase-schema.sql:
--   - uploaded_documents (CV/SOP upload, profile + onboarding)
--   - student_profiles columns: bio, location, nationality, achievements, skills
--
-- The personal_statements table is in supabase-schema.sql.
-- The waitlist_signups table is in supabase-waitlist.sql.
--
-- Run AFTER supabase-schema.sql. Safe to re-run.
-- ============================================================================

-- ── 1. Uploaded documents (CV / SOP / other) ───────────────────────────────

create table if not exists public.uploaded_documents (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  type            text not null check (type in ('cv','statement_of_purpose','personal_statement','other')),
  storage_key     text not null,
  file_name       text not null,
  mime_type       text,
  parsed_summary  text,
  created_at      timestamptz not null default now()
);

alter table public.uploaded_documents enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='uploaded_documents'
      and policyname='Users manage own documents'
  ) then
    create policy "Users manage own documents"
      on public.uploaded_documents for all
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='uploaded_documents'
      and policyname='Service role full access to uploaded_documents'
  ) then
    create policy "Service role full access to uploaded_documents"
      on public.uploaded_documents for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

create index if not exists idx_uploaded_documents_user_id on public.uploaded_documents(user_id);
create index if not exists idx_uploaded_documents_type on public.uploaded_documents(user_id, type);


-- ── 2. Extend student_profiles with profile-page columns ───────────────────
-- (These columns are now part of the canonical student_profiles definition
-- in supabase-schema.sql — these guards exist for older databases.)

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'student_profiles' and column_name = 'bio'
  ) then
    alter table public.student_profiles add column bio text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'student_profiles' and column_name = 'location'
  ) then
    alter table public.student_profiles add column location text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'student_profiles' and column_name = 'nationality'
  ) then
    alter table public.student_profiles add column nationality text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'student_profiles' and column_name = 'achievements'
  ) then
    alter table public.student_profiles add column achievements jsonb default '[]'::jsonb;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'student_profiles' and column_name = 'skills'
  ) then
    alter table public.student_profiles add column skills text[] default '{}';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'student_profiles' and column_name = 'profile_summary'
  ) then
    alter table public.student_profiles add column profile_summary text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'student_profiles' and column_name = 'grades_summary'
  ) then
    alter table public.student_profiles add column grades_summary jsonb;
  end if;
end $$;


-- ── 3. Storage policies for the student-documents and avatars buckets ─────
-- Create the buckets in Supabase Dashboard → Storage before running:
--   • student-documents (private)
--   • avatars (public read)

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Users upload own documents'
  ) then
    create policy "Users upload own documents"
      on storage.objects for insert
      to authenticated
      with check (
        bucket_id = 'student-documents'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Users read own documents'
  ) then
    create policy "Users read own documents"
      on storage.objects for select
      to authenticated
      using (
        bucket_id = 'student-documents'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Users delete own documents'
  ) then
    create policy "Users delete own documents"
      on storage.objects for delete
      to authenticated
      using (
        bucket_id = 'student-documents'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  -- Avatars bucket policies (public read, authenticated write)
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Anyone can read avatars'
  ) then
    create policy "Anyone can read avatars"
      on storage.objects for select
      to public
      using (bucket_id = 'avatars');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Authenticated users upload avatars'
  ) then
    create policy "Authenticated users upload avatars"
      on storage.objects for insert
      to authenticated
      with check (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Users update own avatars'
  ) then
    create policy "Users update own avatars"
      on storage.objects for update
      to authenticated
      using (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;
